/**
 * WebSocket message protocol v1.5 between phone and companion.
 * Launch-hardened companions require an authenticated hello handshake before
 * accepting any PC-control messages.
 */

import semver from 'semver';
import type { Action, ProfileConfig, ProfileSwitchRule, ProStatus } from './types';

// --- Handshake (v1.1+) ---

export interface HelloMessage {
  type: 'hello';
  protocolVersion: string;
  clientVersion: string;
  deviceName: string;
  deviceId: string;
  /** QR/manual pairing bearer secret. Required by launch-hardened companions. */
  pairingSecret?: string;
  proStatus?: ProStatus;
}

export interface HelloAckMessage {
  type: 'hello_ack';
  protocolVersion: string;
  companionVersion: string;
  companionName: string;
  capabilities: CompanionCapability[];
  /**
   * v1.4+ — companion-issued credentials for the iOS Widget /
   * Apple Watch `/intent-execute` HTTP path. Phones running older
   * companions or unable to provision a key will see this as null.
   * The mobile app stores the pair-key + port into iOS Keychain so
   * the WidgetKit extension and Watch relay can sign HMAC requests.
   */
  intentEndpoint?: {
    /** TCP port of the companion's HMAC HTTP listener (typically 9878). */
    port: number;
    /** 64-character hex string of the 32-byte per-device HMAC key. */
    pairKey: string;
  } | null;
}

export type CompanionCapability =
  | 'keybind'
  | 'app_launch'
  | 'system_action'
  | 'multi_action'
  | 'text_input'
  | 'obs'
  | 'discord'
  | 'macro'
  | 'window_monitor'
  | 'auto_profile'
  | 'trackpad';

// --- Client → Companion Messages ---

export type ClientMessage =
  | HelloMessage
  | ExecuteActionMessage
  | PingMessage
  | PairRequestMessage
  | TextInputMessage
  | MacroExecuteMessage
  | ClipboardSetMessage
  | RequestCapabilitiesMessage
  | ProfileSyncMessage
  | SubscribeProfileMessage
  | MouseMoveMessage
  | MouseClickMessage
  | MouseScrollMessage
  | MouseDragMessage;

// --- Trackpad / mouse messages (v1.4.0+) ---------------------------------
//
// Mouse events are high-frequency (capped at ~60Hz on the client). They
// bypass the normal `execute` flow because (a) wrapping each tick in an
// Action+id+result envelope would 5x the wire cost, and (b) we don't need
// per-event ack — if a packet drops the user just keeps moving and the
// next move corrects the cursor naturally.
//
// All move/scroll deltas are RELATIVE in screen pixels (post-sensitivity
// multiplier on the client side). The companion clamps to its primary
// monitor by default; multi-monitor lock is a v1.2.1 setting.

export interface MouseMoveMessage {
  type: 'mouse_move';
  /** Relative cursor delta in pixels. Client applies sensitivity before send. */
  dx: number;
  dy: number;
  /**
   * v1.2.1: when true the companion clamps the resulting cursor position
   * to the primary monitor bounds after applying the delta. Stateless per
   * message so a malicious client can't sticky-lock the cursor.
   */
  lock?: boolean;
}

export type MouseButton = 'left' | 'right' | 'middle';

export interface MouseClickMessage {
  type: 'mouse_click';
  button: MouseButton;
  /** 'click' = down+up combined (default tap); 'down'/'up' for hold-and-drag. */
  state: 'click' | 'down' | 'up';
}

export interface MouseScrollMessage {
  type: 'mouse_scroll';
  /** Vertical wheel delta. Positive = scroll up. Client respects naturalScroll. */
  dy: number;
  /** Horizontal wheel delta (rarely used on phones). Default 0. */
  dx?: number;
}

export interface MouseDragMessage {
  type: 'mouse_drag';
  /** 'start' = left-button-down (cursor stays where it is); 'end' = button-up. */
  phase: 'start' | 'end';
}

export interface SubscribeProfileMessage {
  type: 'subscribe_profile';
}

export interface ExecuteActionMessage {
  type: 'execute';
  id: string;
  action: Action;
}

export interface PingMessage {
  type: 'ping';
  timestamp: number;
}

export interface PairRequestMessage {
  type: 'pair_request';
  deviceName: string;
  deviceId: string;
  pairingSecret?: string;
}

export interface TextInputMessage {
  type: 'text_input';
  id: string;
  text: string;
}

export interface MacroExecuteMessage {
  type: 'macro_execute';
  id: string;
  macroId: string;
  params?: Record<string, string>;
}

export interface RequestCapabilitiesMessage {
  type: 'request_capabilities';
}

/**
 * v1.5+ — Shared clipboard sync. Either side can publish a fresh
 * clipboard value; the receiver applies it to its own clipboard.
 *
 * Both directions use the SAME message type. Phone publishes when its
 * clipboard changes (via `expo-clipboard` polling), companion publishes
 * when Windows clipboard sequence number advances. Cycles are broken by
 * the receiver: if the inbound text matches its own current clipboard,
 * it skips re-publishing.
 *
 * Privacy: this is opt-in on the phone side. The user toggles "Share
 * clipboard with PC" in Settings; the companion-side toggle lives in
 * Studio. When either side has the toggle off, neither publishes.
 */
export interface ClipboardSetMessage {
  type: 'clipboard_set';
  /** Plain text — image / file clipboards aren't synced (privacy + scope). */
  text: string;
  /** Origin marker so receivers can show "from your phone" / "from your PC" UI. */
  source: 'phone' | 'pc';
}

export interface ProfileSyncMessage {
  type: 'profile_sync';
  rules: ProfileSwitchRule[];
}

// --- Companion → Client Messages ---

export type CompanionMessage =
  | HelloAckMessage
  | ExecuteResultMessage
  | PongMessage
  | PairResponseMessage
  | ErrorMessage
  | DeviceRevokedMessage
  | ActiveWindowMessage
  | ProfileSwitchMessage
  | CapabilitiesMessage
  | MacroStatusMessage
  | ProfileUpdateMessage
  | PluginStateMessage
  | ClipboardSetMessage;

/**
 * Sent by the companion when the user edits the active profile in Studio
 * (drag/drop in the desktop editor). Only delivered to clients that
 * (a) negotiated `protocolVersion` satisfying `MIN_FEATURE_PROFILE_UPDATE`
 * and (b) sent a `subscribe_profile` message after the hello handshake.
 */
export interface ProfileUpdateMessage {
  type: 'profile_update';
  profile: ProfileConfig;
  source: 'studio' | 'mobile';
}

export interface ExecuteResultMessage {
  type: 'execute_result';
  id: string;
  success: boolean;
  error?: string;
}

export interface PongMessage {
  type: 'pong';
  timestamp: number;
  serverTime: number;
}

export interface PairResponseMessage {
  type: 'pair_response';
  accepted: boolean;
  companionName: string;
  reason?: string;
}

export interface ErrorMessage {
  type: 'error';
  code: ErrorCode;
  message: string;
}

export interface DeviceRevokedMessage {
  type: 'device_revoked';
  reason: string;
}

export interface ActiveWindowMessage {
  type: 'active_window';
  processName: string;
  windowTitle: string;
}

export interface ProfileSwitchMessage {
  type: 'profile_switch';
  profileId: string;
  reason: string;
}

export interface CapabilitiesMessage {
  type: 'capabilities';
  capabilities: CompanionCapability[];
}

export interface MacroStatusMessage {
  type: 'macro_status';
  macroId: string;
  status: 'running' | 'paused' | 'stopped' | 'completed' | 'error';
  progress?: number;
  error?: string;
}

export interface PluginInfo {
  name: string;
  available: boolean;
  capabilities: string[];
}

export interface PluginStateMessage {
  type: 'plugin_state';
  plugins: PluginInfo[];
}

// --- Error Codes ---

export type ErrorCode =
  | 'INVALID_ACTION'
  | 'INVALID_KEY'
  | 'RATE_LIMITED'
  | 'UNAUTHORIZED'
  | 'DEVICE_LIMIT'
  | 'INTERNAL_ERROR'
  | 'UNSUPPORTED_ACTION'
  | 'INTEGRATION_UNAVAILABLE';

// --- Protocol Constants ---

/** Current companion protocol version. Bump on any wire-incompatible change. */
export const PROTOCOL_VERSION = '1.5.0';

/** Range of client protocolVersion values this companion will accept. */
export const MIN_CLIENT_PROTOCOL = '>=1.1.0 <2.0.0';

/** Minimum client protocolVersion required to receive `profile_update` pushes. */
export const MIN_FEATURE_PROFILE_UPDATE = '>=1.2.0';

/** Minimum client protocolVersion required to use mouse / trackpad messages. */
export const MIN_FEATURE_TRACKPAD = '>=1.4.0';

/** Minimum client protocolVersion required to receive `intentEndpoint` in hello_ack. */
export const MIN_FEATURE_INTENT_ENDPOINT = '>=1.5.0';

/**
 * True if `clientProtocolVersion` satisfies `range` (semver). Returns false
 * — never throws — when the version string is not parseable, so callers can
 * use it directly in conditionals without wrapping in try/catch.
 */
export function isClientCompatible(clientProtocolVersion: string, range: string): boolean {
  const parsed = semver.coerce(clientProtocolVersion);
  if (!parsed) return false;
  return semver.satisfies(parsed, range);
}

export const HEARTBEAT_INTERVAL_MS = 2000;
export const HEARTBEAT_MISS_THRESHOLD = 3;

export const RECONNECT_DELAYS_MS = [500, 1000, 2000, 4000, 8000, 16000, 30000] as const;
export const RECONNECT_MAX_DELAY_MS = 30000;

export const RATE_LIMIT_ACTIONS_PER_SECOND = 50;

export const MAX_PAIRED_DEVICES = 5;

export const DEFAULT_PORT = 9876;
export const PLAIN_WS_PORT = 9877;
