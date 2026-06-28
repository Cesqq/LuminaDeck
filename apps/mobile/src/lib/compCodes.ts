/**
 * Comp/promo code redemption client.
 *
 * Lets users redeem a code at first-launch (no auth required) to unlock Pro.
 * The Supabase edge function `luminadeck-redeem-code` does the validation.
 *
 * Used for: dev/test devices, app reviewers, influencers, founder lifetime.
 */

import { Platform } from 'react-native';
import type { ProStatus, ProPlan } from '@luminadeck/shared';
import { saveProStatus } from './pro';
import { getDeviceId } from './deviceId';

export type RedeemTier = 'lifetime' | 'pro_1y' | 'pro_30d';

/**
 * Maps a comp-code tier to the local ProPlan. Single source of truth shared by
 * the persist path and proStatusFromRedeem so the stored and in-memory plan
 * can never diverge.
 */
const TIER_TO_PLAN: Record<RedeemTier, ProPlan> = {
  lifetime: 'lifetime',
  pro_1y: 'yearly',
  pro_30d: 'monthly',
};

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

export type RedeemReason =
  | 'not_found'
  | 'expired'
  | 'exhausted'
  | 'already_redeemed'
  | 'invalid_request'
  | 'network'
  | 'not_configured';

export type RedeemResult =
  | { ok: true; tier: RedeemTier; expiresAt: string | null; idempotent?: boolean }
  | { ok: false; reason: RedeemReason };

/**
 * Submit a comp code to the backend. On success, the local Pro cache is
 * written and the caller should flip ProContext.isPro = true.
 */
export async function redeemCompCode(args: { code: string }): Promise<RedeemResult> {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return { ok: false, reason: 'not_configured' };
  }

  const code = args.code.trim();
  if (!code) {
    return { ok: false, reason: 'invalid_request' };
  }

  const deviceId = await getDeviceId();

  let response: Response;
  try {
    response = await fetch(`${SUPABASE_URL}/functions/v1/luminadeck-redeem-code`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({
        code,
        deviceId,
        platform: Platform.OS === 'ios' ? 'ios' : Platform.OS === 'android' ? 'android' : null,
        // appVersion intentionally omitted — expo-application isn't a dep yet;
        // can add if/when we want client-version telemetry on redemptions.
      }),
    });
  } catch {
    return { ok: false, reason: 'network' };
  }

  let body: any;
  try {
    body = await response.json();
  } catch {
    return { ok: false, reason: 'network' };
  }

  if (!body || typeof body !== 'object') {
    return { ok: false, reason: 'network' };
  }

  if (body.ok === true && typeof body.tier === 'string') {
    const expiresAt: string | null = body.expiresAt ?? null;
    // Persist locally so subsequent app launches see Pro without round-tripping.
    // Thread the server entitlement through verbatim: the plan implied by the
    // tier and the server-issued expiry. A `lifetime` code has expiresAt=null,
    // so no expiry is persisted and Pro is permanent; `pro_1y` / `pro_30d` codes
    // carry a real expiry that loadProStatus enforces (previously this saved a
    // rolling 7-day grace as the expiry, granting permanent Pro after restart —
    // 2026-06-27 hardening finding).
    await saveProStatus({
      isPro: true,
      source: 'comp_code',
      plan: TIER_TO_PLAN[body.tier as RedeemTier] ?? 'lifetime',
      expiresAt,
    });
    return {
      ok: true,
      tier: body.tier,
      expiresAt,
      idempotent: body.idempotent === true,
    };
  }

  return { ok: false, reason: (body.reason as RedeemReason) ?? 'invalid_request' };
}

export function describeRedeemFailure(reason: RedeemReason): string {
  switch (reason) {
    case 'not_found':
      return "We don't recognize that code. Double-check the letters and try again.";
    case 'expired':
      return 'This code has expired.';
    case 'exhausted':
      return 'This code has already been fully redeemed.';
    case 'already_redeemed':
      return 'This device has already redeemed this code.';
    case 'network':
      return "Couldn't reach the server. Check your connection and try again.";
    case 'not_configured':
      return 'Code redemption is not available in this build.';
    case 'invalid_request':
    default:
      return 'Something went wrong with that code. Please try again.';
  }
}

/**
 * Build a Pro status object from a successful redemption result.
 */
export function proStatusFromRedeem(result: Extract<RedeemResult, { ok: true }>): ProStatus {
  return {
    isPro: true,
    plan: TIER_TO_PLAN[result.tier],
    source: 'comp_code',
    purchaseDate: new Date().toISOString(),
    expiresAt: result.expiresAt ?? undefined,
  };
}
