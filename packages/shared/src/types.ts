/**
 * Core types for LuminaDeck protocol and data models.
 * Protocol v1.1 — extended action types, subscription pricing, iPad layouts.
 */

// --- Action Types ---

export type ActionType =
  | 'keybind'
  | 'app_launch'
  | 'system_action'
  | 'multi_action'
  | 'text_input'
  | 'folder'
  | 'timer'
  | 'counter'
  | 'obs'
  | 'discord'
  | 'macro';

export interface KeybindAction {
  type: 'keybind';
  keys: string[];
}

export interface AppLaunchAction {
  type: 'app_launch';
  path: string;
  args?: string[];
}

export type SystemActionName =
  | 'volume_up' | 'volume_down' | 'volume_mute'
  | 'media_play_pause' | 'media_next' | 'media_prev' | 'media_stop'
  | 'screenshot' | 'lock_screen' | 'sleep'
  | 'brightness_up' | 'brightness_down'
  | 'mic_mute'
  | 'minimize_window' | 'snap_left' | 'snap_right' | 'switch_window' | 'close_window';

export interface SystemAction {
  type: 'system_action';
  action: SystemActionName;
}

export interface MultiAction {
  type: 'multi_action';
  actions: (KeybindAction | AppLaunchAction | SystemAction | TextInputAction)[];
  delays?: number[];
}

export interface TextInputAction {
  type: 'text_input';
  text: string;
}

export interface FolderAction {
  type: 'folder';
  folderId: string;
  folderName: string;
  buttons: ButtonConfig[];
  layout: GridLayout;
}

export interface TimerAction {
  type: 'timer';
  durationMs: number;
  countUp: boolean;
  label?: string;
}

export interface CounterAction {
  type: 'counter';
  initialValue: number;
  step: number;
  label?: string;
}

export type OBSCommand =
  | 'switch_scene'
  | 'toggle_record'
  | 'toggle_stream'
  | 'toggle_source'
  | 'replay_buffer'
  | 'obs_screenshot';

export interface OBSAction {
  type: 'obs';
  command: OBSCommand;
  sceneName?: string;
  sourceName?: string;
  filterName?: string;
}

export type DiscordCommand = 'toggle_mute' | 'toggle_deafen' | 'push_to_talk';

export interface DiscordAction {
  type: 'discord';
  command: DiscordCommand;
}

export interface MacroAction {
  type: 'macro';
  macroId: string;
  macroName: string;
}

export type Action =
  | KeybindAction
  | AppLaunchAction
  | SystemAction
  | MultiAction
  | TextInputAction
  | FolderAction
  | TimerAction
  | CounterAction
  | OBSAction
  | DiscordAction
  | MacroAction;

// --- Button ---

export interface ButtonConfig {
  id: string;
  action: Action | null;
  label?: string;
  labelSize?: number;
  labelPosition?: 'top' | 'bottom' | 'hidden';
  icon?: string;
  customImage?: string;
  color?: string;
  page: number;
  position: number;
}

// --- Layout ---

export type GridLayout = '2x4' | '3x4' | '4x5' | '5x3' | '8x4' | '8x8';

export const GRID_DIMENSIONS: Record<GridLayout, { cols: number; rows: number }> = {
  '2x4': { cols: 2, rows: 4 },
  '3x4': { cols: 3, rows: 4 },
  '4x5': { cols: 4, rows: 5 },
  '5x3': { cols: 5, rows: 3 },
  '8x4': { cols: 8, rows: 4 },
  '8x8': { cols: 8, rows: 8 },
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
  theme: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProfileSwitchRule {
  processName: string;
  profileId: string;
}

// --- Themes ---

export type ThemeId = string;

export interface ThemeColors {
  background: string;
  buttonBackground: string;
  buttonBorder: string;
  accent: string;
  accentSecondary?: string;
  text: string;
  textSecondary: string;
  statusGreen: string;
  statusYellow: string;
  statusRed: string;
}

export interface ThemeConfig {
  id: string;
  name: string;
  colors: ThemeColors;
  iconPack: string;
  customBackground?: string;
  buttonCornerRadius?: number;
  gridGap?: number;
}

// --- Connection ---

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface PairedDevice {
  id: string;
  name: string;
  ip: string;
  port: number;
  certFingerprint: string;
  pairedAt: string;
  lastSeen?: string;
}

// --- Pairing ---

export interface QRPairingPayload {
  ip: string;
  port: number;
  certFingerprint: string;
  companionName: string;
  version: string;
}

// --- Pro / License ---

export type ProPlan = 'free' | 'monthly' | 'yearly' | 'lifetime';

export interface ProStatus {
  isPro: boolean;
  plan: ProPlan;
  purchaseDate?: string;
  expiresAt?: string;
  source: 'apple_iap' | 'google_play' | 'stripe' | 'none';
}

// --- Limits ---

export const FREE_LIMITS = {
  maxButtons: 12,
  maxPages: 2,
  maxPairedDevices: 1,
  maxProfiles: 1,
  themes: ['obsidian'] as string[],
  customImages: false,
  gifIcons: false,
  multiAction: false,
  macros: false,
  obsIntegration: false,
  discordIntegration: false,
  profileExport: false,
  folderSupport: false,
  autoProfileSwitch: false,
} as const;

export const PRO_LIMITS = {
  maxButtons: 64,
  maxPages: 50,
  maxPairedDevices: 5,
  maxProfiles: 20,
  themes: 'all' as const,
  customImages: true,
  gifIcons: true,
  multiAction: true,
  macros: true,
  obsIntegration: true,
  discordIntegration: true,
  profileExport: true,
  folderSupport: true,
  autoProfileSwitch: true,
} as const;
