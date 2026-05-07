/**
 * Comp/promo code redemption client.
 *
 * Lets users redeem a code at first-launch (no auth required) to unlock Pro.
 * The Supabase edge function `luminadeck-redeem-code` does the validation.
 *
 * Used for: dev/test devices, app reviewers, influencers, founder lifetime.
 */

import { Platform } from 'react-native';
import type { ProStatus } from '@luminadeck/shared';
import { saveProStatus } from './pro';
import { getDeviceId } from './deviceId';

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
  | { ok: true; tier: 'lifetime' | 'pro_1y' | 'pro_30d'; expiresAt: string | null; idempotent?: boolean }
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
    // Persist locally so subsequent app launches see Pro without round-tripping
    await saveProStatus(true, 'comp_code');
    return {
      ok: true,
      tier: body.tier,
      expiresAt: body.expiresAt ?? null,
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
  const planMap = { lifetime: 'lifetime', pro_1y: 'yearly', pro_30d: 'monthly' } as const;
  return {
    isPro: true,
    plan: planMap[result.tier],
    source: 'comp_code',
    purchaseDate: new Date().toISOString(),
    expiresAt: result.expiresAt ?? undefined,
  };
}
