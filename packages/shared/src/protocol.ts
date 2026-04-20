/**
 * WebSocket message protocol v1.1 between phone and companion.
 * Backward compatible: v1.0 clients work without hello handshake.
 */

import type { Action, ProfileSwitchRule } from './types';

// --- Handshake (v1.1+) ---

export interface HelloMessage {
  type: 'hello';
  protocolVersion: string;
  clientVersion: string;
  deviceName: string;
  deviceId: string;
}

export interface HelloAckMessage {
  type: 'hello_ack';
  protocolVersion: string;
  companionVersion: string;
  companionName: string;
  capabilities: CompanionCapability[];
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
  | 'auto_profile';

// --- Client → Companion Messages ---

export type ClientMessage =
  | HelloMessage
  | ExecuteActionMessage
  | PingMessage
  | PairRequestMessage
  | TextInputMessage
  | MacroExecuteMessage
  | RequestCapabilitiesMessage
  | ProfileSyncMessage;

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
  | MacroStatusMessage;

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

export const PROTOCOL_VERSION = '1.1.0';

export const HEARTBEAT_INTERVAL_MS = 2000;
export const HEARTBEAT_MISS_THRESHOLD = 3;

export const RECONNECT_DELAYS_MS = [500, 1000, 2000, 4000, 8000, 16000, 30000] as const;
export const RECONNECT_MAX_DELAY_MS = 30000;

export const RATE_LIMIT_ACTIONS_PER_SECOND = 50;

export const MAX_PAIRED_DEVICES = 5;

export const DEFAULT_PORT = 9876;
export const PLAIN_WS_PORT = 9877;
