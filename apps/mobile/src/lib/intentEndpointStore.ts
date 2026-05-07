/**
 * iOS Keychain bridge for the v1.4 widget / watch /intent-execute path.
 *
 * The companion sends `intentEndpoint = { port, pairKey }` inside hello_ack
 * once the device has been registered with a fresh per-device pair-key.
 * We persist that key plus the companion's host/port in the iOS Keychain
 * so the WidgetKit extension and the Watch app's relay (both run outside
 * the React Native runtime) can read them and sign /intent-execute calls
 * via HMAC-SHA256 — see `apps/mobile/targets/shared/CompanionEndpoint.swift`.
 *
 * Storage contract — must match the `CompanionEndpoint` Swift reader:
 *   keychainService = "com.luminadeck.pairing"
 *   account "pairKey"        → 64-char hex string of the 32-byte HMAC key
 *   account "companionHost"  → "10.0.0.114" or whatever the phone connected to
 *   account "companionPort"  → "9878" (always — the intent HTTP port)
 *
 * Android: this module no-ops. The widget surfaces are iOS-only for v1.4
 * (a future Wear OS or Quick Settings tile would need a separate bridge).
 */

import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const KEYCHAIN_SERVICE = 'com.luminadeck.pairing';
const ACCOUNT_PAIR_KEY = 'pairKey';
const ACCOUNT_HOST = 'companionHost';
const ACCOUNT_PORT = 'companionPort';
const ACCOUNT_DEVICE_ID = 'deviceId';

export interface IntentEndpoint {
  /** 64-character hex string. The Swift side decodes this back to 32 bytes. */
  pairKey: string;
  /** Bare host or IP — same value the WS connection used. */
  host: string;
  /** Numeric port (typically 9878). Stored as string because Keychain
   *  values are bytes; the Swift side parses with `Int(_:)`. */
  port: number;
  /** Phone's deviceId (the same one sent in the WS `hello` handshake).
   *  The widget includes this in its HMAC POST body so the companion can
   *  look up the right pair-key for verification. */
  deviceId: string;
}

const SECURE_STORE_OPTIONS: SecureStore.SecureStoreOptions = {
  keychainService: KEYCHAIN_SERVICE,
  // Allow read after first unlock so the widget can fire while the screen
  // is locked but the device has been unlocked once since boot. Stricter
  // than the default `WHEN_UNLOCKED` would block Lock-Screen widgets.
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
};

/**
 * Persist the intent endpoint into iOS Keychain. No-ops on Android.
 *
 * Failures here are non-fatal — the WS path keeps working without the
 * widget. We log and degrade silently because hello_ack arrives in a hot
 * path that shouldn't surface UX errors for an optional surface.
 */
export async function saveIntentEndpoint(endpoint: IntentEndpoint): Promise<void> {
  if (Platform.OS !== 'ios') return;
  try {
    await Promise.all([
      SecureStore.setItemAsync(ACCOUNT_PAIR_KEY, endpoint.pairKey, SECURE_STORE_OPTIONS),
      SecureStore.setItemAsync(ACCOUNT_HOST, endpoint.host, SECURE_STORE_OPTIONS),
      SecureStore.setItemAsync(ACCOUNT_PORT, String(endpoint.port), SECURE_STORE_OPTIONS),
      SecureStore.setItemAsync(ACCOUNT_DEVICE_ID, endpoint.deviceId, SECURE_STORE_OPTIONS),
    ]);
  } catch (err) {
    // Don't throw — see module docblock.
    if (__DEV__) {
      console.warn('[intentEndpointStore] save failed', err);
    }
  }
}

/**
 * Read the saved endpoint. Mostly used for diagnostics in the mobile app's
 * Settings screen ("Widget paired with PC at X"). Returns null when no
 * endpoint has been stored yet, or on Android.
 */
export async function loadIntentEndpoint(): Promise<IntentEndpoint | null> {
  if (Platform.OS !== 'ios') return null;
  try {
    const [pairKey, host, portStr, deviceId] = await Promise.all([
      SecureStore.getItemAsync(ACCOUNT_PAIR_KEY, SECURE_STORE_OPTIONS),
      SecureStore.getItemAsync(ACCOUNT_HOST, SECURE_STORE_OPTIONS),
      SecureStore.getItemAsync(ACCOUNT_PORT, SECURE_STORE_OPTIONS),
      SecureStore.getItemAsync(ACCOUNT_DEVICE_ID, SECURE_STORE_OPTIONS),
    ]);
    if (!pairKey || !host || !portStr || !deviceId) return null;
    const port = Number(portStr);
    if (!Number.isFinite(port) || port <= 0) return null;
    return { pairKey, host, port, deviceId };
  } catch {
    return null;
  }
}

/**
 * Wipe the endpoint — invoked when the user unpairs a device or factory-
 * resets the app. The Swift widget will then no-op until a new pairing
 * round provisions a fresh key.
 */
export async function clearIntentEndpoint(): Promise<void> {
  if (Platform.OS !== 'ios') return;
  try {
    await Promise.all([
      SecureStore.deleteItemAsync(ACCOUNT_PAIR_KEY, SECURE_STORE_OPTIONS),
      SecureStore.deleteItemAsync(ACCOUNT_HOST, SECURE_STORE_OPTIONS),
      SecureStore.deleteItemAsync(ACCOUNT_PORT, SECURE_STORE_OPTIONS),
      SecureStore.deleteItemAsync(ACCOUNT_DEVICE_ID, SECURE_STORE_OPTIONS),
    ]);
  } catch {
    // ignore
  }
}
