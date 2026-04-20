/**
 * Pro license management for LuminaDeck.
 *
 * Flow:
 * 1. User taps "Upgrade to Pro"
 * 2. RevenueCat handles IAP flow with Apple
 * 3. On success, we validate receipt via Supabase edge function
 * 4. Pro status cached locally with 7-day offline grace period
 * 5. On app launch, check local cache → validate if expired
 */

import * as SecureStore from 'expo-secure-store';
import type { ProStatus } from '@luminadeck/shared';
import { FREE_LIMITS, PRO_LIMITS } from '@luminadeck/shared';

const PRO_CACHE_KEY = 'luminadeck_pro_status';
const OFFLINE_GRACE_DAYS = 7;

/**
 * Load Pro status from secure local cache.
 */
export async function loadProStatus(): Promise<ProStatus> {
  try {
    const cached = await SecureStore.getItemAsync(PRO_CACHE_KEY);
    if (!cached) {
      return { isPro: false, plan: 'free', source: 'none' };
    }

    const status: ProStatus = JSON.parse(cached);

    // Check offline grace period
    if (status.isPro && status.expiresAt) {
      const expiresAt = new Date(status.expiresAt).getTime();
      if (Date.now() > expiresAt) {
        // Grace period expired — need to re-validate
        // For now, still grant Pro (re-validation happens on next connect)
        return status;
      }
    }

    return status;
  } catch {
    return { isPro: false, plan: 'free', source: 'none' };
  }
}

/**
 * Save Pro status to secure local cache with offline grace period.
 */
export async function saveProStatus(isPro: boolean, source: ProStatus['source']): Promise<void> {
  const now = new Date();
  const gracePeriodEnd = new Date(now.getTime() + OFFLINE_GRACE_DAYS * 24 * 60 * 60 * 1000);

  const status: ProStatus = {
    isPro,
    plan: isPro ? 'lifetime' : 'free',
    purchaseDate: now.toISOString(),
    expiresAt: gracePeriodEnd.toISOString(),
    source,
  };

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
