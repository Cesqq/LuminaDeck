/**
 * Single source of truth for telemetry event names and payload shapes.
 * Both `apps/mobile/src/lib/telemetry.ts` and
 * `apps/companion/src-tauri/src/telemetry.rs` import from here so the two
 * runtimes can't drift out of sync on event names.
 *
 * Privacy contract: NO user-generated strings (tile labels, folder names,
 * macro names, window titles, IP addresses) ever appear in payloads.
 * Allowed values are enums, counts, durations, and device-ID hashes with
 * a per-install random salt that rotates every 90 days.
 */

export const TELEMETRY_EVENTS = {
  APP_OPEN: 'app_open',
  TILE_PRESS: 'tile_press',
  PROFILE_CREATE: 'profile_create',
  PROFILE_SWITCH_AUTO: 'profile_switch_auto',
  PROFILE_SWITCH_MANUAL: 'profile_switch_manual',
  PLUGIN_CONFIGURED: 'plugin_configured',
  EDITOR_SESSION: 'editor_session',
  IMPORT_STREAMDECK_PROFILE: 'import_streamdeck_profile',
  PAYWALL_VIEW: 'paywall_view',
  PURCHASE_ATTEMPTED: 'purchase_attempted',
} as const;

export type TelemetryEventName = typeof TELEMETRY_EVENTS[keyof typeof TELEMETRY_EVENTS];

export type AppOpenSurface = 'home' | 'connection' | 'onboarding' | 'studio';
export type EditorSurface = 'studio' | 'mobile';

export interface TelemetryPayloads {
  app_open: { surface: AppOpenSurface };
  tile_press: { actionType: string };
  profile_create: Record<string, never>;
  profile_switch_auto: Record<string, never>;
  profile_switch_manual: Record<string, never>;
  plugin_configured: { plugin: 'obs' | 'discord' | 'window_monitor' | string };
  editor_session: { surface: EditorSurface; durationMs: number };
  import_streamdeck_profile: { success: boolean; importedCount?: number; unsupportedCount?: number };
  paywall_view: { source: string };
  purchase_attempted: { sku: string };
}

/** Type-level mapping from event name to payload type. */
export type TelemetryPayload<E extends TelemetryEventName> =
  E extends keyof TelemetryPayloads ? TelemetryPayloads[E] : never;
