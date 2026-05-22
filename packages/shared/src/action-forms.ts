/**
 * Typed form specs for each action type. Studio (vanilla HTML) and mobile
 * (React Native) render the inspector from the same ActionFormSpec, so
 * both surfaces stay in sync when action types change.
 *
 * Why a typed discriminated union instead of JSON Schema: JSON Schema can
 * describe fields but not BEHAVIOR (dependent fields, async-populated
 * dropdowns like OBS scenes, validators tied to key allowlists). We keep
 * structure here and let each platform's renderer own behavior via
 * `RendererId`.
 */

import type { ActionType } from './types';
import { FEATURE_GATES } from './feature-gates';

export type FieldType =
  | 'text'
  | 'textarea'
  | 'number'
  | 'boolean'
  | 'select'
  | 'key-capture'
  | 'file-path'
  | 'color'
  | 'icon-picker'
  | 'scene-picker'
  | 'source-picker'
  | 'folder-buttons'
  | 'action-list'
  | 'macro-picker';

/**
 * Opaque identifier each platform maps to a concrete renderer component.
 * Platforms register a handler per id; unknown ids fall back to a generic
 * form built from `fields`.
 */
export type RendererId =
  | 'keybind'
  | 'app-launch'
  | 'system-action'
  | 'multi-action'
  | 'text-input'
  | 'folder'
  | 'timer'
  | 'counter'
  | 'obs'
  | 'discord'
  | 'macro'
  | 'trackpad';

export interface FormField {
  /** Path into the action object (supports simple dotted paths for nested fields). */
  id: string;
  label: string;
  type: FieldType;
  required?: boolean;
  /** For `number`: inclusive bounds. For strings: length bounds. */
  min?: number;
  max?: number;
  /** For `select`. */
  options?: Array<{ value: string; label: string }>;
  placeholder?: string;
  /** Shown under or beside the field as tooltip copy. */
  help?: string;
}

export interface ActionFormSpec {
  actionType: ActionType;
  renderer: RendererId;
  /** User-visible action name (e.g. "Keyboard Shortcut"). */
  label: string;
  /** One-line description for the tile library card. */
  description: string;
  /** Category used to group tiles in the library UI. */
  category: 'input' | 'system' | 'app' | 'integration' | 'flow' | 'time';
  /** Whether this action type is free-tier accessible. Mirrors FREE_LIMITS. */
  free: boolean;
  fields: FormField[];
}

export const ACTION_FORM_SPECS: Record<ActionType, ActionFormSpec> = {
  keybind: {
    actionType: 'keybind',
    renderer: 'keybind',
    label: 'Keyboard Shortcut',
    description: 'Send a key combo (Ctrl+C, Alt+Tab…) to your PC.',
    category: 'input',
    free: FEATURE_GATES.keybind.free,
    fields: [
      {
        id: 'keys',
        label: 'Keys',
        type: 'key-capture',
        required: true,
        min: 1,
        max: 4,
        help: 'Tap a key on your keyboard to capture. Up to 4 keys per combo.',
      },
    ],
  },
  app_launch: {
    actionType: 'app_launch',
    renderer: 'app-launch',
    label: 'Launch App',
    description: 'Start a program or open a shortcut on your PC.',
    category: 'app',
    free: FEATURE_GATES.app_launch.free,
    fields: [
      {
        id: 'path',
        label: 'Executable path',
        type: 'file-path',
        required: true,
        max: 260,
        placeholder: 'C:\\Program Files\\App\\app.exe',
      },
      {
        id: 'args',
        label: 'Arguments (optional)',
        type: 'text',
        max: 1024,
        placeholder: '--flag value',
        help: 'Space-separated. Leave empty for most apps.',
      },
    ],
  },
  system_action: {
    actionType: 'system_action',
    renderer: 'system-action',
    label: 'System Action',
    description: 'Volume, media, screenshot, lock screen, window snap…',
    category: 'system',
    free: FEATURE_GATES.system_action.free,
    fields: [
      {
        id: 'action',
        label: 'Action',
        type: 'select',
        required: true,
        options: [
          { value: 'volume_up', label: 'Volume Up' },
          { value: 'volume_down', label: 'Volume Down' },
          { value: 'volume_mute', label: 'Mute' },
          { value: 'media_play_pause', label: 'Play / Pause' },
          { value: 'media_next', label: 'Next Track' },
          { value: 'media_prev', label: 'Previous Track' },
          { value: 'media_stop', label: 'Stop' },
          { value: 'screenshot', label: 'Screenshot' },
          { value: 'lock_screen', label: 'Lock Screen' },
          { value: 'sleep', label: 'Sleep' },
          { value: 'brightness_up', label: 'Brightness Up' },
          { value: 'brightness_down', label: 'Brightness Down' },
          { value: 'mic_mute', label: 'Mic Mute' },
          { value: 'minimize_window', label: 'Minimize Window' },
          { value: 'snap_left', label: 'Snap Left' },
          { value: 'snap_right', label: 'Snap Right' },
          { value: 'switch_window', label: 'Switch Window (Alt+Tab)' },
          { value: 'close_window', label: 'Close Window' },
        ],
      },
    ],
  },
  multi_action: {
    actionType: 'multi_action',
    renderer: 'multi-action',
    label: 'Multi-Action',
    description: 'Run a sequence of actions with optional delays.',
    category: 'flow',
    free: FEATURE_GATES.multi_action.free,
    fields: [
      {
        id: 'actions',
        label: 'Steps',
        type: 'action-list',
        required: true,
        max: 20,
        help: 'Up to 20 steps. Only Keybind, Launch, System, and Text Input are allowed inside a multi-action.',
      },
    ],
  },
  text_input: {
    actionType: 'text_input',
    renderer: 'text-input',
    label: 'Type Text',
    description: 'Paste or type a snippet into the focused window.',
    category: 'input',
    free: FEATURE_GATES.text_input.free,
    fields: [
      {
        id: 'text',
        label: 'Text',
        type: 'textarea',
        required: true,
        max: 4096,
      },
    ],
  },
  folder: {
    actionType: 'folder',
    renderer: 'folder',
    label: 'Folder',
    description: 'Group buttons into a nested grid.',
    category: 'flow',
    free: FEATURE_GATES.folder.free,
    fields: [
      { id: 'folderName', label: 'Folder name', type: 'text', required: true, min: 1, max: 32 },
      {
        id: 'layout',
        label: 'Inner layout',
        type: 'select',
        required: true,
        options: [
          { value: '2x4', label: '2×4' },
          { value: '3x4', label: '3×4' },
          { value: '4x5', label: '4×5' },
          { value: '5x3', label: '5×3' },
          { value: '8x4', label: '8×4' },
          { value: '8x8', label: '8×8' },
        ],
      },
      { id: 'buttons', label: 'Buttons', type: 'folder-buttons' },
    ],
  },
  timer: {
    actionType: 'timer',
    renderer: 'timer',
    label: 'Timer',
    description: 'Countdown or count-up displayed on the tile face.',
    category: 'time',
    free: FEATURE_GATES.timer.free,
    fields: [
      { id: 'durationMs', label: 'Duration (ms)', type: 'number', required: true, min: 1000, max: 86400000 },
      { id: 'countUp', label: 'Count up', type: 'boolean' },
      { id: 'label', label: 'Label', type: 'text', max: 32 },
    ],
  },
  counter: {
    actionType: 'counter',
    renderer: 'counter',
    label: 'Counter',
    description: 'Tap to increment; shows the running total on the tile.',
    category: 'time',
    free: FEATURE_GATES.counter.free,
    fields: [
      { id: 'initialValue', label: 'Initial value', type: 'number', required: true },
      { id: 'step', label: 'Step', type: 'number', required: true, min: -1000, max: 1000 },
      { id: 'label', label: 'Label', type: 'text', max: 32 },
    ],
  },
  obs: {
    actionType: 'obs',
    renderer: 'obs',
    label: 'OBS Studio',
    description: 'Scene switch, record / stream toggle, source visibility.',
    category: 'integration',
    free: FEATURE_GATES.obs.free,
    fields: [
      {
        id: 'command',
        label: 'Command',
        type: 'select',
        required: true,
        options: [
          { value: 'switch_scene', label: 'Switch Scene' },
          { value: 'toggle_record', label: 'Toggle Record' },
          { value: 'toggle_stream', label: 'Toggle Stream' },
          { value: 'toggle_source', label: 'Toggle Source' },
          { value: 'replay_buffer', label: 'Save Replay Buffer' },
          { value: 'obs_screenshot', label: 'Screenshot' },
        ],
      },
      { id: 'sceneName', label: 'Scene', type: 'scene-picker', max: 128 },
      { id: 'sourceName', label: 'Source', type: 'source-picker', max: 128 },
    ],
  },
  discord: {
    actionType: 'discord',
    renderer: 'discord',
    label: 'Discord',
    description: 'Mute / deafen / push-to-talk via Discord hotkeys.',
    category: 'integration',
    free: FEATURE_GATES.discord.free,
    fields: [
      {
        id: 'command',
        label: 'Command',
        type: 'select',
        required: true,
        options: [
          { value: 'toggle_mute', label: 'Toggle Mute' },
          { value: 'toggle_deafen', label: 'Toggle Deafen' },
          { value: 'push_to_talk', label: 'Push to Talk' },
        ],
      },
    ],
  },
  macro: {
    actionType: 'macro',
    renderer: 'macro',
    label: 'Macro',
    description: 'Run a saved macro from the Macros tab.',
    category: 'flow',
    free: FEATURE_GATES.macro.free,
    fields: [
      { id: 'macroId', label: 'Macro', type: 'macro-picker', required: true },
    ],
  },
  trackpad: {
    actionType: 'trackpad',
    renderer: 'trackpad',
    label: 'Trackpad',
    description: 'Open a full-screen trackpad to drive the PC mouse.',
    category: 'input',
    free: FEATURE_GATES.trackpad.free,
    fields: [
      {
        id: 'sensitivity',
        label: 'Sensitivity',
        type: 'number',
        required: false,
        min: 0.5,
        max: 2.0,
        help: '0.5x slow → 2x fast. Default 1.0.',
      },
      {
        id: 'accelCurve',
        label: 'Acceleration',
        type: 'select',
        required: false,
        options: [
          { value: 'classic', label: 'Classic (OS-trackpad feel)' },
          { value: 'linear', label: 'Linear (raw delta)' },
        ],
        help: 'Classic amplifies fast strokes while keeping flicks precise.',
      },
      {
        id: 'naturalScroll',
        label: 'Natural scroll',
        type: 'boolean',
        required: false,
        help: 'Inverts scroll direction (macOS-style).',
      },
      {
        id: 'haptics',
        label: 'Haptic feedback',
        type: 'boolean',
        required: false,
        help: 'Vibrate on click and drag start. Default on.',
      },
      {
        id: 'lockToPrimary',
        label: 'Lock to primary monitor',
        type: 'boolean',
        required: false,
        help: 'Prevents the cursor from drifting onto secondary screens.',
      },
    ],
  },
};

/** Ordered list for the tile library. */
export const ACTION_FORM_SPEC_LIST: ActionFormSpec[] = Object.values(ACTION_FORM_SPECS);

export function getActionFormSpec(type: ActionType): ActionFormSpec {
  return ACTION_FORM_SPECS[type];
}
