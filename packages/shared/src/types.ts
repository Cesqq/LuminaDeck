/**
 * Core types for LuminaDeck protocol and data models.
 */

// --- Action Types ---

export type ActionType = 'keybind' | 'app_launch' | 'system_action' | 'multi_action';

export interface KeybindAction {
  type: 'keybind';
  keys: string[]; // Key names from allowlist, e.g. ["ctrl", "shift", "m"]
}

export interface AppLaunchAction {
  type: 'app_launch';
  path: string;        // Validated executable path
  args?: string[];     // Optional arguments
}

export type SystemActionName =
  | 'volume_up' | 'volume_down' | 'volume_mute'
  | 'media_play_pause' | 'media_next' | 'media_prev' | 'media_stop'
  | 'screenshot' | 'lock_screen' | 'sleep'
  | 'brightness_up' | 'brightness_down'
  | 'mic_mute';

export interface SystemAction {
  type: 'system_action';
  action: SystemActionName;
}

export interface MultiAction {
  type: 'multi_action';
  actions: (KeybindAction | AppLaunchAction | SystemAction)[];
  delays?: number[]; // Delay in ms between each action (length = actions.length - 1)
}

export type Action = KeybindAction | AppLaunchAction | SystemAction | MultiAction;

// --- Button ---

export interface ButtonConfig {
  id: string;
  action: Action | null;
  label?: string;       // Max 16 chars
  icon?: string;        // Icon pack reference or custom image URI
  customImage?: string; // Base64 or file URI for user-uploaded image
  color?: string;       // Hex color for button background
  page: number;         // Page index (0-based)
  position: number;     // Grid position index
}

// --- Layout ---

export type GridLayout = '2x4' | '3x4' | '4x5';

export const GRID_DIMENSIONS: Record<GridLayout, { cols: number; rows: number }> = {
  '2x4': { cols: 2, rows: 4 },
  '3x4': { cols: 3, rows: 4 },
  '4x5': { cols: 4, rows: 5 },
};

export interface PageConfig {
  id: string;
  name: string;
  buttons: ButtonConfig[];
  layout: GridLayout;
}

export interface ProfileConfig {
  id: string;
  name: string;
  pages: PageConfig[];
  theme: ThemeId;
  createdAt: string;  // ISO 8601
  updatedAt: string;  // ISO 8601
}

// --- Themes ---

export type ThemeId = 'obsidian' | 'aurora' | 'daylight' | 'retro-neon' | 'slate';

export interface ThemeColors {
  background: string;
  buttonBackground: string;
  buttonBorder: string;
  accent: string;
  accentSecondary?: string; // For gradient themes
  text: string;
  textSecondary: string;
  statusGreen: string;
  statusYellow: string;
  statusRed: string;
}

export interface ThemeConfig {
  id: ThemeId;
  name: string;
  colors: ThemeColors;
  iconPack: string; // Icon pack directory name
}

// --- Connection ---

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface PairedDevice {
  id: string;
  name: string;         // Companion hostname or user label
  ip: string;
  port: number;
  certFingerprint: string; // SHA-256 of companion TLS cert
  pairedAt: string;     // ISO 8601
  lastSeen?: string;    // ISO 8601
}

// --- Pairing ---

export interface QRPairingPayload {
  ip: string;
  port: number;
  certFingerprint: string;
  companionName: string;
  version: string;      // Protocol version
}

// --- Pro / License ---

export interface ProStatus {
  isPro: boolean;
  purchaseDate?: string;   // ISO 8601
  expiresAt?: string;      // For offline grace period (7 days)
  source: 'apple_iap' | 'stripe' | 'none';
}

// --- Limits ---

export const FREE_LIMITS = {
  maxButtons: 8,
  maxPages: 1,
  maxPairedDevices: 1,
  themes: ['obsidian'] as ThemeId[],
  customImages: false,
  multiAction: false,
  profileExport: false,
} as const;

export const PRO_LIMITS = {
  maxButtons: 30, // Per page
  maxPages: 20,
  maxPairedDevices: 5,
  themes: ['obsidian', 'aurora', 'daylight', 'retro-neon', 'slate'] as ThemeId[],
  customImages: true,
  multiAction: true,
  profileExport: true,
} as const;
