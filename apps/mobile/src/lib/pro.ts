/**
 * Pro license management for LuminaDeck.
 *
 * Flow:
 * 1. User taps "Upgrade to Pro"
 * 2. RevenueCat handles IAP flow with Apple
 * 3. On success, we validate receipt via Supabase edge function
 * 4. Pro status cached locally
 * 5. On app launch, check local cache → validate if expired
 *
 * Expiry model:
 *   - A lifetime / permanent entitlement has NO `expiresAt`. It is granted
 *     forever and `loadProStatus` never revokes it offline.
 *   - A time-limited entitlement (e.g. a `pro_1y` / `pro_30d` comp code) carries
 *     the server-issued `expiresAt`. Once `expiresAt` passes, `loadProStatus`
 *     keeps granting Pro only through a short OFFLINE_GRACE_DAYS window (so a
 *     user who is briefly offline at the boundary isn't yanked mid-session),
 *     then fails closed to Free until a fresh server entitlement arrives.
 */

import * as SecureStore from 'expo-secure-store';
import type { ProStatus, ProPlan } from '@luminadeck/shared';
import { FREE_LIMITS, PRO_LIMITS, isEntitlementActive } from '@luminadeck/shared';

const PRO_CACHE_KEY = 'luminadeck_pro_status';

/**
 * The entitlement we persist. `expiresAt` is the REAL server entitlement
 * expiry (or undefined for lifetime/permanent). Distinct from the offline
 * grace window, which is applied at read time — we never bake the grace window
 * into the stored expiry, or a rolling grace would masquerade as the real one.
 */
export interface SaveProStatusInput {
  isPro: boolean;
  source: ProStatus['source'];
  /** Defaults to 'lifetime' when isPro and no plan is given, 'free' otherwise. */
  plan?: ProPlan;
  /** Server entitlement expiry. Omit/undefined => permanent (no expiry). */
  expiresAt?: string | null;
  /** Defaults to now. */
  purchaseDate?: string;
}

/**
 * Load Pro status from secure local cache, enforcing expiry.
 *
 * A stored entitlement with no `expiresAt` is permanent. A stored entitlement
 * whose `expiresAt` (plus the offline grace window) has passed is downgraded to
 * Free here, so an expired time-limited code can't grant Pro indefinitely.
 */
export async function loadProStatus(): Promise<ProStatus> {
  try {
    const cached = await SecureStore.getItemAsync(PRO_CACHE_KEY);
    if (!cached) {
      return { isPro: false, plan: 'free', source: 'none' };
    }

    const status: ProStatus = JSON.parse(cached);

    // Enforce expiry. A permanent entitlement (no expiresAt) is always active;
    // a time-limited one is active only through the offline grace window past
    // its real expiry, after which we fail closed to Free so an expired
    // comp code can't keep granting Pro. Shared helper = single source of truth.
    if (!isEntitlementActive(status)) {
      return { isPro: false, plan: 'free', source: 'none' };
    }

    return status;
  } catch {
    return { isPro: false, plan: 'free', source: 'none' };
  }
}

/**
 * Save Pro status to secure local cache.
 *
 * Pass the real entitlement: the granting `source`, the `plan`, and the
 * server-issued `expiresAt` for time-limited grants (omit it for lifetime).
 * The offline grace window is applied at read time, never persisted here.
 */
export async function saveProStatus(input: SaveProStatusInput): Promise<void> {
  const { isPro, source } = input;
  const plan: ProPlan = input.plan ?? (isPro ? 'lifetime' : 'free');

  const status: ProStatus = {
    isPro,
    plan,
    purchaseDate: input.purchaseDate ?? new Date().toISOString(),
    source,
  };

  // Only time-limited entitlements carry an expiry. A null/undefined expiresAt
  // means permanent — leave the field off entirely so loadProStatus treats it
  // as never-expiring.
  if (isPro && input.expiresAt) {
    status.expiresAt = input.expiresAt;
  }

  await SecureStore.setItemAsync(PRO_CACHE_KEY, JSON.stringify(status));
}

/**
 * Get the appropriate limits based on Pro status.
 */
export function getLimits(isPro: boolean) {
  return isPro ? PRO_LIMITS : FREE_LIMITS;
}

/**
 * Clear Pro status (for testing or if purchase is revoked).
 */
export async function clearProStatus(): Promise<void> {
  await SecureStore.deleteItemAsync(PRO_CACHE_KEY);
}
