/**
 * Shared deviceId helper.
 *
 * The mobile app generates a stable per-install identifier and persists it in
 * SecureStore. The WebSocket client and the comp-code redemption client both
 * need it; this module is the single source of truth so they don't drift.
 *
 * Resilient to SecureStore failures: if persistence fails, the in-memory id
 * is still returned so callers don't break (matches the websocket.ts policy
 * landed in v1.3.4).
 */

import * as SecureStore from 'expo-secure-store';

const DEVICE_ID_KEY = '@luminadeck/device_id';

let cached: string | null = null;

export function generateDeviceId(): string {
  return 'ld-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export async function getDeviceId(): Promise<string> {
  if (cached) return cached;

  try {
    const existing = await SecureStore.getItemAsync(DEVICE_ID_KEY);
    if (existing) {
      cached = existing;
      return existing;
    }
  } catch (e) {
    console.warn('[deviceId] SecureStore read failed, falling back to in-memory:', e);
  }

  const generated = generateDeviceId();
  cached = generated;

  try {
    await SecureStore.setItemAsync(DEVICE_ID_KEY, generated);
  } catch (e) {
    console.warn('[deviceId] SecureStore write failed, id will not persist:', e);
  }

  return generated;
}

/** For tests only — do not call in app code. */
export function _resetDeviceIdCache(): void {
  cached = null;
}
