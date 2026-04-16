/**
 * WebSocket message protocol between iPhone app and Windows companion.
 */

// --- Client → Companion Messages ---

export type ClientMessage =
  | ExecuteActionMessage
  | PingMessage
  | PairRequestMessage;

export interface ExecuteActionMessage {
  type: 'execute';
  id: string;          // Unique message ID for ack tracking
  action: {
    type: 'keybind';
    keys: string[];
  } | {
    type: 'app_launch';
    path: string;
    args?: string[];
  } | {
    type: 'system_action';
    action: string;
  } | {
    type: 'multi_action';
    actions: Array<{
      type: 'keybind' | 'app_launch' | 'system_action';
      [key: string]: unknown;
    }>;
    delays?: number[];
  };
}

export interface PingMessage {
  type: 'ping';
  timestamp: number; // Unix ms
}

export interface PairRequestMessage {
  type: 'pair_request';
  deviceName: string;
  deviceId: string;
}

// --- Companion → Client Messages ---

export type CompanionMessage =
  | ExecuteResultMessage
  | PongMessage
  | PairResponseMessage
  | ErrorMessage
  | DeviceRevokedMessage;

export interface ExecuteResultMessage {
  type: 'execute_result';
  id: string;          // Echoed message ID
  success: boolean;
  error?: string;
}

export interface PongMessage {
  type: 'pong';
  timestamp: number;   // Echoed from ping
  serverTime: number;  // Companion's current time
}

export interface PairResponseMessage {
  type: 'pair_response';
  accepted: boolean;
  companionName: string;
  reason?: string;     // If rejected
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

// --- Error Codes ---

export type ErrorCode =
  | 'INVALID_ACTION'
  | 'INVALID_KEY'
  | 'RATE_LIMITED'
  | 'UNAUTHORIZED'
  | 'DEVICE_LIMIT'
  | 'INTERNAL_ERROR';

// --- Protocol Constants ---

export const PROTOCOL_VERSION = '1.0.0';

export const HEARTBEAT_INTERVAL_MS = 2000;
export const HEARTBEAT_MISS_THRESHOLD = 3;

export const RECONNECT_DELAYS_MS = [500, 1000, 2000, 4000, 8000, 16000, 30000] as const;
export const RECONNECT_MAX_DELAY_MS = 30000;

export const RATE_LIMIT_ACTIONS_PER_SECOND = 50;

export const MAX_PAIRED_DEVICES = 5;

export const DEFAULT_PORT = 9876;
