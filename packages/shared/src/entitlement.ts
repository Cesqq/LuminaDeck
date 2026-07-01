/**
 * Entitlement expiry semantics — the single source of truth for "is this Pro
 * status still active?", shared by the mobile cache reader and any other
 * surface that needs to reason about a stored entitlement.
 *
 * Rules:
 *   - A non-Pro status is never active.
 *   - A Pro status with NO `expiresAt` is permanent (lifetime / one-time IAP)
 *     and is always active.
 *   - A Pro status WITH an `expiresAt` is time-limited (e.g. a `pro_1y` /
 *     `pro_30d` comp code). It stays active until `expiresAt` plus an offline
 *     grace window, then goes inactive — so an expired time-limited grant can't
 *     keep unlocking Pro forever, while a briefly-offline user isn't cut off at
 *     the exact boundary.
 */

import type { ProStatus } from './types';

/** Default offline grace past a time-limited entitlement's real expiry. */
export const DEFAULT_OFFLINE_GRACE_MS = 7 * 24 * 60 * 60 * 1000;

export function isEntitlementActive(
  status: Pick<ProStatus, 'isPro' | 'expiresAt'>,
  now: number = Date.now(),
  graceMs: number = DEFAULT_OFFLINE_GRACE_MS,
): boolean {
  if (!status.isPro) return false;
  // Permanent entitlement — no expiry to enforce.
  if (!status.expiresAt) return true;

  const expiresAt = new Date(status.expiresAt).getTime();
  // Unparseable expiry: treat as permanent rather than locking the user out on
  // bad data (fail open to the user's benefit, never the reverse).
  if (!Number.isFinite(expiresAt)) return true;

  return now <= expiresAt + graceMs;
}
