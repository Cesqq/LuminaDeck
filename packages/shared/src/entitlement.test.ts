import { describe, it, expect } from 'vitest';
import { isEntitlementActive, DEFAULT_OFFLINE_GRACE_MS } from './entitlement';

const NOW = Date.UTC(2026, 5, 27, 12, 0, 0); // 2026-06-27T12:00:00Z
const iso = (ms: number) => new Date(ms).toISOString();

describe('isEntitlementActive', () => {
  it('a non-Pro status is never active', () => {
    expect(isEntitlementActive({ isPro: false, expiresAt: undefined }, NOW)).toBe(false);
    // Even a future expiry can't make a non-Pro status active.
    expect(isEntitlementActive({ isPro: false, expiresAt: iso(NOW + 1_000_000) }, NOW)).toBe(false);
  });

  it('Pro with no expiry is permanent (lifetime / one-time IAP)', () => {
    expect(isEntitlementActive({ isPro: true, expiresAt: undefined }, NOW)).toBe(true);
    expect(isEntitlementActive({ isPro: true }, NOW)).toBe(true);
  });

  it('time-limited Pro is active before its expiry', () => {
    expect(isEntitlementActive({ isPro: true, expiresAt: iso(NOW + 60_000) }, NOW)).toBe(true);
  });

  it('time-limited Pro stays active inside the offline grace window', () => {
    const justInsideGrace = iso(NOW - DEFAULT_OFFLINE_GRACE_MS + 60_000);
    expect(isEntitlementActive({ isPro: true, expiresAt: justInsideGrace }, NOW)).toBe(true);
  });

  it('time-limited Pro fails closed once expiry + grace has passed', () => {
    // This is the bug being guarded: an expired pro_1y / pro_30d code must NOT
    // keep granting Pro after a restart.
    const wellPastGrace = iso(NOW - DEFAULT_OFFLINE_GRACE_MS - 60_000);
    expect(isEntitlementActive({ isPro: true, expiresAt: wellPastGrace }, NOW)).toBe(false);
  });

  it('honors a custom grace window', () => {
    const expiredYesterday = iso(NOW - 24 * 60 * 60 * 1000);
    // Zero grace => already inactive the instant after expiry.
    expect(isEntitlementActive({ isPro: true, expiresAt: expiredYesterday }, NOW, 0)).toBe(false);
    // A 2-day grace keeps it active a day past expiry.
    expect(
      isEntitlementActive({ isPro: true, expiresAt: expiredYesterday }, NOW, 2 * 24 * 60 * 60 * 1000),
    ).toBe(true);
  });

  it('treats an unparseable expiry as permanent (fails open, never locks out on bad data)', () => {
    expect(isEntitlementActive({ isPro: true, expiresAt: 'not-a-date' }, NOW)).toBe(true);
  });
});
