/**
 * Supabase Edge Function: luminadeck-redeem-code
 *
 * Validates a comp/promo code and grants Pro entitlement to the calling
 * device. No auth required — this runs before users have a Supabase session.
 * Anti-abuse is per-device: a single code+device pair can only redeem once
 * (uniqueness enforced by the DB), and the code's max_redemptions cap stops
 * unlimited redemption across many devices.
 *
 * POST /functions/v1/luminadeck-redeem-code
 * Body: { code: string, deviceId: string, platform?: string, appVersion?: string }
 * Response (success): { ok: true, tier: 'lifetime'|'pro_1y'|'pro_30d', expiresAt: string|null }
 * Response (failure): { ok: false, reason: 'not_found'|'expired'|'exhausted'|'already_redeemed'|'invalid_request' }
 */

import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

interface RedeemRequestBody {
  code?: string;
  deviceId?: string;
  platform?: string;
  appVersion?: string;
}

const VALID_PLATFORMS = new Set(['ios', 'android', 'windows']);

/**
 * Strict charset gates for comp codes. Codes are letters/digits with optional
 * hyphen/space separators (e.g. "LUMI-2026-XYZ"); after normalization they
 * must be pure uppercase alphanumerics. Anything else is rejected BEFORE the
 * value reaches the database query, so user input can never be interpreted as
 * PostgREST filter grammar (a raw `.or(...)` interpolation here previously
 * allowed `code=x,code.not.is.null` to match an arbitrary stored code —
 * 2026-06-10 security sweep, paywall-bypass finding).
 */
const RAW_CODE_RE = /^[A-Za-z0-9][A-Za-z0-9\s-]{2,62}[A-Za-z0-9]$/;
const NORMALIZED_CODE_RE = /^[A-Z0-9]{4,32}$/;
const TIER_DURATION_DAYS: Record<string, number | null> = {
  lifetime: null,
  pro_1y: 365,
  pro_30d: 30,
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, content-type',
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
}

function isUuidLike(v: string): boolean {
  return /^[a-z0-9-]{8,128}$/i.test(v);
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return jsonResponse({ ok: false, reason: 'invalid_request' }, 405);
  }

  let body: RedeemRequestBody;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ ok: false, reason: 'invalid_request' }, 400);
  }

  const rawCode = (body.code ?? '').trim();
  const deviceId = (body.deviceId ?? '').trim();
  const platform = (body.platform ?? '').toLowerCase();
  const appVersion = (body.appVersion ?? '').slice(0, 32);

  if (!rawCode || !deviceId) {
    return jsonResponse({ ok: false, reason: 'invalid_request' }, 400);
  }
  if (!isUuidLike(deviceId)) {
    return jsonResponse({ ok: false, reason: 'invalid_request' }, 400);
  }
  if (platform && !VALID_PLATFORMS.has(platform)) {
    return jsonResponse({ ok: false, reason: 'invalid_request' }, 400);
  }

  // Reject any code whose charset could carry filter syntax. Same end-user
  // outcome as a typo'd code: it does not exist.
  if (!RAW_CODE_RE.test(rawCode)) {
    return jsonResponse({ ok: false, reason: 'not_found' });
  }

  // Normalize: uppercase + strip spaces and hyphens for matching, but match
  // both the as-stored code and the normalized form
  const normalized = rawCode.toUpperCase().replace(/[\s-]/g, '');

  if (!NORMALIZED_CODE_RE.test(normalized)) {
    return jsonResponse({ ok: false, reason: 'not_found' });
  }

  const supabase: SupabaseClient = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  );

  // Single atomic call. `redeem_comp_code` (migration 003) does lookup,
  // idempotency, expiry, cap enforcement, insert and counter bump inside one
  // transaction with `SELECT ... FOR UPDATE` on the code row. That row lock is
  // what makes the cap race-proof: two devices redeeming the same limited-use
  // code concurrently are serialized, so only `max_redemptions` of them ever
  // succeed. The cap is never checked in JS, where a check-then-insert window
  // let concurrent requests both pass (2026-06-27 hardening finding).
  //
  // We send the normalized (uppercase, dash/space-stripped) code as the match
  // key; that is the canonical form codes are stored in. The charset gates
  // above already guarantee it is pure [A-Z0-9].
  const { data: rpcData, error: rpcErr } = await supabase
    .rpc('redeem_comp_code', {
      p_code: normalized,
      p_device_id: deviceId,
      p_platform: platform || null,
      p_app_version: appVersion || null,
    })
    .single();

  if (rpcErr) {
    // 23505 = unique-violation: a concurrent retry from this same device beat
    // us to the redemption row. Surface it as already-redeemed rather than 500.
    if ((rpcErr as { code?: string }).code === '23505') {
      return jsonResponse({ ok: false, reason: 'already_redeemed' });
    }
    console.error('[redeem-code] redeem error:', rpcErr);
    return jsonResponse({ ok: false, reason: 'invalid_request' }, 500);
  }

  const outcome = rpcData as {
    result: 'redeemed' | 'already_redeemed' | 'not_found' | 'expired' | 'exhausted';
    tier: string | null;
    redeemed_at: string | null;
  } | null;

  if (!outcome) {
    console.error('[redeem-code] empty redeem result');
    return jsonResponse({ ok: false, reason: 'invalid_request' }, 500);
  }

  switch (outcome.result) {
    case 'not_found':
      return jsonResponse({ ok: false, reason: 'not_found' });
    case 'expired':
      return jsonResponse({ ok: false, reason: 'expired' });
    case 'exhausted':
      return jsonResponse({ ok: false, reason: 'exhausted' });
    case 'already_redeemed':
      // Idempotent success — same device, same code. Expiry is computed from
      // the ORIGINAL redemption time so the granted window doesn't slide.
      return jsonResponse({
        ok: true,
        tier: outcome.tier,
        expiresAt: tierExpiry(outcome.tier ?? '', outcome.redeemed_at ?? new Date().toISOString()),
        idempotent: true,
      });
    case 'redeemed':
      return jsonResponse({
        ok: true,
        tier: outcome.tier,
        expiresAt: tierExpiry(outcome.tier ?? '', outcome.redeemed_at ?? new Date().toISOString()),
      });
    default:
      console.error('[redeem-code] unexpected redeem result:', outcome.result);
      return jsonResponse({ ok: false, reason: 'invalid_request' }, 500);
  }
});

function tierExpiry(tier: string, redeemedAtIso: string): string | null {
  const days = TIER_DURATION_DAYS[tier];
  if (days === null || days === undefined) return null;
  const t = new Date(redeemedAtIso).getTime();
  return new Date(t + days * 86400_000).toISOString();
}
