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

  // Look up the code (case-insensitive, dash-insensitive). Parameterized
  // `.in()` — candidate values are passed as data, never interpolated into
  // filter grammar (and the charset gates above guarantee they contain no
  // reserved characters anyway).
  const candidates = [...new Set([rawCode, normalized, rawCode.toUpperCase()])];
  const { data: codeRow, error: lookupErr } = await supabase
    .from('luminadeck_comp_codes')
    .select('code, tier, max_redemptions, redemptions_used, expires_at')
    .in('code', candidates)
    .limit(1)
    .maybeSingle();

  if (lookupErr) {
    console.error('[redeem-code] lookup error:', lookupErr);
    return jsonResponse({ ok: false, reason: 'invalid_request' }, 500);
  }
  if (!codeRow) {
    return jsonResponse({ ok: false, reason: 'not_found' });
  }

  if (codeRow.expires_at && new Date(codeRow.expires_at).getTime() < Date.now()) {
    return jsonResponse({ ok: false, reason: 'expired' });
  }

  // Has this device already redeemed this code? (idempotency for retries)
  const { data: priorRedemption } = await supabase
    .from('luminadeck_comp_redemptions')
    .select('id, redeemed_at')
    .eq('code', codeRow.code)
    .eq('device_id', deviceId)
    .maybeSingle();

  if (priorRedemption) {
    // Idempotent return — same device redeeming same code is treated as success
    return jsonResponse({
      ok: true,
      tier: codeRow.tier,
      expiresAt: tierExpiry(codeRow.tier, priorRedemption.redeemed_at),
      idempotent: true,
    });
  }

  if (codeRow.redemptions_used >= codeRow.max_redemptions) {
    return jsonResponse({ ok: false, reason: 'exhausted' });
  }

  // Insert redemption (the unique index on (code, device_id) is the final
  // guard against race conditions if two devices hit the cap concurrently)
  const { error: insertErr } = await supabase
    .from('luminadeck_comp_redemptions')
    .insert({
      code: codeRow.code,
      device_id: deviceId,
      platform: platform || null,
      app_version: appVersion || null,
    });

  if (insertErr) {
    // Could be the uniqueness race; treat as already redeemed
    if (insertErr.code === '23505') {
      return jsonResponse({ ok: false, reason: 'already_redeemed' });
    }
    console.error('[redeem-code] insert error:', insertErr);
    return jsonResponse({ ok: false, reason: 'invalid_request' }, 500);
  }

  // Bump the counter (best-effort; if this fails, the redemption row still
  // exists and the code is functionally consumed)
  await supabase.rpc('increment_redemption', { p_code: codeRow.code }).catch(() => {});
  // Fallback if RPC isn't installed: do an arithmetic update
  await supabase
    .from('luminadeck_comp_codes')
    .update({ redemptions_used: codeRow.redemptions_used + 1 })
    .eq('code', codeRow.code)
    .eq('redemptions_used', codeRow.redemptions_used);

  return jsonResponse({
    ok: true,
    tier: codeRow.tier,
    expiresAt: tierExpiry(codeRow.tier, new Date().toISOString()),
  });
});

function tierExpiry(tier: string, redeemedAtIso: string): string | null {
  const days = TIER_DURATION_DAYS[tier];
  if (days === null || days === undefined) return null;
  const t = new Date(redeemedAtIso).getTime();
  return new Date(t + days * 86400_000).toISOString();
}
