/**
 * Privacy-first telemetry client for LuminaDeck mobile.
 *
 * Design contract (matches `packages/shared/src/telemetry-events.ts`):
 *   - Off by default. Never fires until the user flips the Privacy toggle.
 *   - Per-install random salt lives in SecureStore and rotates every 90 days,
 *     so we never have a stable cross-install identifier.
 *   - We force `$ip: null` at the client; PostHog ingress still sees the
 *     request IP, which is why the deployment contract also pins the EU host
 *     and requires a signed DPA before the API key is populated.
 *   - No user-generated strings (tile labels, folder names, window titles)
 *     ever leave the device — enums/counts/durations only.
 *   - Network failure MUST silently no-op. Telemetry can never break a flow.
 *
 * The module also keeps a 20-event ring buffer in memory so the hidden debug
 * overlay (long-press the Settings version row 5x) can show what we'd send.
 */

import * as SecureStore from 'expo-secure-store';
import {
  type TelemetryEventName,
  type TelemetryPayload,
} from '@luminadeck/shared';

const POSTHOG_HOST = 'https://eu.i.posthog.com';
// Deliberately read at call time from EXPO_PUBLIC_POSTHOG_KEY. Left empty
// until the PostHog EU DPA is signed — with no key, sendEvent short-circuits.
const getApiKey = (): string => process.env.EXPO_PUBLIC_POSTHOG_KEY ?? '';

const SALT_KEY = 'luminadeck_telemetry_salt';
const SALT_CREATED_AT_KEY = 'luminadeck_telemetry_salt_created_at';
const SALT_ROTATION_MS = 90 * 24 * 60 * 60 * 1000;
const RING_BUFFER_SIZE = 20;
const LIB_NAME = 'luminadeck-mobile';
const REQUEST_TIMEOUT_MS = 5000;

/**
 * Outbound throttle — the WS layer lets a connected client fire tiles at
 * up to 50/sec (RATE_LIMIT_MAX_ACTIONS in server.rs). Each tile press
 * calls track(TILE_PRESS, ...) so without throttling we'd pound PostHog
 * ingress at the same rate. Cap sends at 10/sec per process; drops are
 * silent — the ring buffer still records them for the debug overlay, so
 * a burst is locally observable even if the remote side is throttled.
 */
const OUTBOUND_RATE_WINDOW_MS = 1000;
const OUTBOUND_RATE_MAX = 10;
let outboundWindowStart = 0;
let outboundInWindow = 0;

function consumeOutboundToken(): boolean {
  const now = Date.now();
  if (now - outboundWindowStart >= OUTBOUND_RATE_WINDOW_MS) {
    outboundWindowStart = now;
    outboundInWindow = 1;
    return true;
  }
  if (outboundInWindow < OUTBOUND_RATE_MAX) {
    outboundInWindow += 1;
    return true;
  }
  return false;
}

export interface TelemetryEventRecord {
  event: TelemetryEventName;
  properties: Record<string, unknown>;
  timestamp: string;
  sent: boolean;
  error?: string;
}

let distinctId: string | null = null;
let optInEnabled = false;
let appVersion = '1.1.0';
const ring: TelemetryEventRecord[] = [];

function randomHex(bytes: number): string {
  const chars = '0123456789abcdef';
  let out = '';
  for (let i = 0; i < bytes * 2; i++) {
    out += chars[Math.floor(Math.random() * 16)];
  }
  return out;
}

async function getOrRotateSalt(): Promise<string> {
  const now = Date.now();
  try {
    const existing = await SecureStore.getItemAsync(SALT_KEY);
    const createdAtRaw = await SecureStore.getItemAsync(SALT_CREATED_AT_KEY);
    const createdAt = createdAtRaw ? Number.parseInt(createdAtRaw, 10) : 0;

    if (existing && createdAt && now - createdAt < SALT_ROTATION_MS) {
      return existing;
    }

    const fresh = randomHex(32);
    await SecureStore.setItemAsync(SALT_KEY, fresh);
    await SecureStore.setItemAsync(SALT_CREATED_AT_KEY, String(now));
    return fresh;
  } catch {
    // SecureStore unavailable (simulator quirks, etc.) — fall back to
    // in-memory ID. No telemetry persists across restarts in that case.
    return randomHex(32);
  }
}

/**
 * Call once at app launch (from App.tsx) after settings have loaded.
 * Pulls/rotates the salt and seeds the opt-in state.
 */
export async function initTelemetry(opts: {
  optIn: boolean;
  version: string;
}): Promise<void> {
  optInEnabled = opts.optIn;
  appVersion = opts.version;
  distinctId = await getOrRotateSalt();
}

export function setOptIn(value: boolean): void {
  optInEnabled = value;
}

export function isOptInEnabled(): boolean {
  return optInEnabled;
}

/**
 * Fire-and-forget event emit. Always records into the ring buffer (so the
 * debug overlay reflects real app behaviour even when opt-out); only POSTs
 * to PostHog when the user has opted in AND an API key is configured.
 */
export function track<E extends TelemetryEventName>(
  event: E,
  properties: TelemetryPayload<E>,
): void {
  const record: TelemetryEventRecord = {
    event,
    properties: { ...(properties as Record<string, unknown>) },
    timestamp: new Date().toISOString(),
    sent: false,
  };
  ring.push(record);
  if (ring.length > RING_BUFFER_SIZE) ring.shift();

  const apiKey = getApiKey();
  if (!optInEnabled || !distinctId || !apiKey) return;

  // Client-side rate limit on outbound HTTP. Dropped events still land in
  // the ring buffer above, so the debug overlay reflects the true press
  // rate while PostHog only gets up to OUTBOUND_RATE_MAX per window.
  if (!consumeOutboundToken()) {
    record.error = 'rate-limited-client';
    return;
  }

  void sendEvent(record, apiKey);
}

async function sendEvent(
  record: TelemetryEventRecord,
  apiKey: string,
): Promise<void> {
  const body = {
    api_key: apiKey,
    event: record.event,
    distinct_id: distinctId,
    properties: {
      ...record.properties,
      $lib: LIB_NAME,
      $lib_version: appVersion,
      $ip: null,
    },
    timestamp: record.timestamp,
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(`${POSTHOG_HOST}/capture/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (res.ok) {
      record.sent = true;
    } else {
      record.error = `HTTP ${res.status}`;
    }
  } catch (err) {
    record.error = err instanceof Error ? err.message : String(err);
  } finally {
    clearTimeout(timer);
  }
}

export function getRecentEvents(): readonly TelemetryEventRecord[] {
  return ring.slice();
}

/** Testing / dev-tools only. */
export function _clearRing(): void {
  ring.length = 0;
}
