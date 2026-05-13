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
  | 'macro'
  | 'trackpad';

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

/**
 * Trackpad action (v1.2.0+). Tapping the tile opens a full-screen trackpad
 * overlay on the phone; while open, the overlay streams `mouse_*` messages
 * to the companion outside the standard `execute` flow (high-frequency).
 *
 * `sensitivity` is a 0.5–2x multiplier on cursor velocity. `naturalScroll`
 * inverts the scroll axis to match macOS-style trackpads.
 *
 * v1.2.1 additions:
 *   - `haptics`: per-action toggle so users on a quiet phone can silence
 *     the click feedback without globally disabling haptics.
 *   - `accelCurve`: acceleration profile applied to the move delta. Linear
 *     keeps the raw delta; 'classic' applies the OS-trackpad feel where
 *     small flicks stay precise but big swipes amplify.
 *   - `lockToPrimary`: when true, the companion clamps the cursor to the
 *     primary monitor (prevents accidental jumps to second screens).
 */
export interface TrackpadAction {
  type: 'trackpad';
  sensitivity?: number;
  naturalScroll?: boolean;
  haptics?: boolean;
  accelCurve?: 'linear' | 'classic';
  lockToPrimary?: boolean;
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
  | MacroAction
  | TrackpadAction;

// --- Button ---

/**
 * Optional per-gesture bindings. Each slot fires the given Action when the
 * corresponding gesture is recognised on the tile. Tap remains the primary
 * activation path (always fires `ButtonConfig.action`); these are additive.
 *
 * UX contract (Phase B4 plan, UX judge revision): the Editor surfaces these
 * progressively — default view is "Press only"; a "Multi-gesture" toggle
 * reveals slots one at a time to avoid overwhelming the user.
 */
export interface ButtonGestures {
  longPress?: Action;
  swipeUp?: Action;
  swipeDown?: Action;
  pinchIn?: Action;
  pinchOut?: Action;
}

/**
 * Which gesture was used to activate the tile. Primary tap uses 'tap'; used
 * as the `gesture` key when firing an execute message so the companion (and
 * telemetry) can distinguish one trigger from another.
 */
export type GestureName = 'tap' | 'longPress' | 'swipeUp' | 'swipeDown' | 'pinchIn' | 'pinchOut';

export interface ButtonConfig {
  id: string;
  action: Action | null;
  gestures?: ButtonGestures;
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

/** v1.3.0: tile shape controls the corner radius style without
 *  hard-coding a single radius — themes can ship 'pill' (high radius) for
 *  a soft chaotic feel, 'square' for crisp Coder vibes, etc. */
export type TileShape = 'square' | 'rounded' | 'squircle' | 'pill';

export interface ThemeConfig {
  id: string;
  name: string;
  colors: ThemeColors;
  iconPack: string;
  customBackground?: string;
  buttonCornerRadius?: number;
  gridGap?: number;
  /** v1.3.0: tile shape preset. Overrides buttonCornerRadius if set. */
  tileShape?: TileShape;
  /** v1.3.0: optional rim glow color. Themes with high-energy palettes
   *  (neon-rgb, chaos) use it to give tiles a subtle outer glow. */
  accentGlow?: string;
  /** v1.3.0: optional tag exposed to telemetry + theming animations. */
  mood?: 'calm' | 'energetic' | 'chaotic' | 'pro' | 'retro';
}

// --- Connection ---

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface PairedDevice {
  id: string;
  name: string;
  ip: string;
  port: number;
  certFingerprint: string;
  /** Stored in SecureStore on mobile. Required for authenticated LAN control. */
  pairingSecret?: string;
  pairedAt: string;
  lastSeen?: string;
}

// --- Pairing ---

export interface QRPairingPayload {
  ip: string;
  port: number;
  certFingerprint: string;
  pairingSecret: string;
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
  source: 'apple_iap' | 'google_play' | 'stripe' | 'comp_code' | 'none';
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
  obsIntegration: false,
  discordIntegration: true,
  profileExport: true,
  folderSupport: true,
  autoProfileSwitch: true,
} as const;
