/**
 * Crash/error reporting (Sentry) wrapper for LuminaDeck mobile.
 *
 * Privacy contract — matches docs/APP-STORE-REVIEW-NOTES.md ("optional
 * diagnostics/telemetry is off by default"):
 *   - OFF by default. Sentry is initialized in a disabled state at launch and
 *     never sends a crash/error/trace until the user opts in via Settings →
 *     Privacy → "Share crash diagnostics".
 *   - Opt-in is its own setting (`crashReportingOptIn`), separate from the
 *     analytics toggle (`telemetryOptIn`) — they go to different processors
 *     (Sentry vs. PostHog) in different regions, so they get separate consent.
 *   - A `beforeSend`/`beforeSendTransaction` guard is the hard gate: even if
 *     the SDK is enabled, nothing leaves the device while opt-in is false.
 *
 * Sentry.init must run once, synchronously, before the app renders so the
 * error boundary is in place. We can't know the persisted opt-in that early
 * (it's an async SecureStore/AsyncStorage read), so we init disabled and flip
 * the in-memory gate from App.tsx once settings have loaded.
 */

import * as Sentry from '@sentry/react-native';

// The DSN is a public client key, so an inline fallback is safe;
// EXPO_PUBLIC_SENTRY_DSN can override it per build/env.
// NOTE: source-map upload is intentionally NOT configured here — the
// build-scoped auth token is being rotated. Wire it via the
// @sentry/react-native Metro/EAS plugin (and a SENTRY_AUTH_TOKEN env var,
// never committed) once the new token is issued.
const SENTRY_DSN =
  process.env.EXPO_PUBLIC_SENTRY_DSN ??
  'https://e9cbe8afcf5f48672ee954986c070423@o4511429577146368.ingest.us.sentry.io/4511431806746624';

// In-memory consent gate. Defaults to false (off by default). Flipped by
// setCrashReportingOptIn once the persisted setting has loaded, and whenever
// the user toggles the Settings switch.
let optedIn = false;

/**
 * Initialize Sentry in a disabled-by-default state. Call once at module load,
 * before the app renders.
 *
 * `enabled` follows the live consent flag and `beforeSend`/
 * `beforeSendTransaction` drop everything while consent is false — so a crash
 * during the brief window before settings load is never transmitted.
 */
export function initCrashReporting(): void {
  Sentry.init({
    dsn: SENTRY_DSN,
    enabled: optedIn,
    // Modest, fixed trace sampling instead of 1.0 — full tracing is both a
    // volume and a privacy cost, and is only relevant once the user has opted
    // into diagnostics at all.
    tracesSampleRate: 0.1,
    // Hard consent gate: no event or trace leaves the device unless the user
    // has opted into crash diagnostics.
    beforeSend: (event) => (optedIn ? event : null),
    beforeSendTransaction: (event) => (optedIn ? event : null),
  });
}

/**
 * Reflect the user's crash-diagnostics consent. Called from App.tsx after the
 * persisted setting loads, and from Settings when the toggle changes.
 */
export function setCrashReportingOptIn(value: boolean): void {
  optedIn = value;
  const client = Sentry.getClient();
  // getOptions() is mutable; flipping `enabled` lets the SDK stop/start
  // capturing without a full re-init. The beforeSend guard above is the
  // belt-and-suspenders backstop if a client isn't available yet.
  const options = client?.getOptions();
  if (options) {
    options.enabled = value;
  }
}

export function isCrashReportingOptIn(): boolean {
  return optedIn;
}

/** Re-export wrap so App.tsx keeps a single Sentry import surface. */
export const wrap = Sentry.wrap;
