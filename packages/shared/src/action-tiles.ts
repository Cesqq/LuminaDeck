/**
 * Pre-built action tile catalog for LuminaDeck.
 * Users browse this library to add tiles to their deck.
 */

import type { Action } from './types';

export interface ActionTile {
  id: string;
  name: string;
  category: TileCategory;
  icon: string;
  defaultAction: Action;
  requiresPro: boolean;
  description?: string;
}

export const TILE_CATEGORIES = [
  'media', 'system', 'clipboard', 'window', 'app_launch',
  'obs', 'discord', 'utility', 'macros',
] as const;

export type TileCategory = typeof TILE_CATEGORIES[number];

export const TILE_CATEGORY_LABELS: Record<TileCategory, string> = {
  media: 'Media',
  system: 'System',
  clipboard: 'Clipboard',
  window: 'Window',
  app_launch: 'Apps',
  obs: 'OBS Studio',
  discord: 'Discord',
  utility: 'Utility',
  macros: 'Macros',
};

export const ACTION_TILES: ActionTile[] = [
  // ── Media (8) ───────────────────────────────
  {
    id: 'media-play-pause',
    name: 'Play / Pause',
    category: 'media',
    icon: 'play-pause',
    requiresPro: false,
    defaultAction: { type: 'system_action', action: 'media_play_pause' },
  },
  {
    id: 'media-next',
    name: 'Next Track',
    category: 'media',
    icon: 'next-track',
    requiresPro: false,
    defaultAction: { type: 'system_action', action: 'media_next' },
  },
  {
    id: 'media-prev',
    name: 'Previous Track',
    category: 'media',
    icon: 'prev-track',
    requiresPro: false,
    defaultAction: { type: 'system_action', action: 'media_prev' },
  },
  {
    id: 'media-stop',
    name: 'Stop',
    category: 'media',
    icon: 'stop',
    requiresPro: false,
    defaultAction: { type: 'system_action', action: 'media_stop' },
  },
  {
    id: 'media-vol-up',
    name: 'Volume Up',
    category: 'media',
    icon: 'volume-up',
    requiresPro: false,
    defaultAction: { type: 'system_action', action: 'volume_up' },
  },
  {
    id: 'media-vol-down',
    name: 'Volume Down',
    category: 'media',
    icon: 'volume-down',
    requiresPro: false,
    defaultAction: { type: 'system_action', action: 'volume_down' },
  },
  {
    id: 'media-mute',
    name: 'Mute',
    category: 'media',
    icon: 'volume-mute',
    requiresPro: false,
    defaultAction: { type: 'system_action', action: 'volume_mute' },
  },
  {
    id: 'media-mic-mute',
    name: 'Mic Mute',
    category: 'media',
    icon: 'mic-mute',
    requiresPro: false,
    defaultAction: { type: 'system_action', action: 'mic_mute' },
  },

  // ── System (6) ──────────────────────────────
  {
    id: 'sys-screenshot',
    name: 'Screenshot',
    category: 'system',
    icon: 'screenshot',
    requiresPro: false,
    defaultAction: { type: 'system_action', action: 'screenshot' },
  },
  {
    id: 'sys-lock',
    name: 'Lock Screen',
    category: 'system',
    icon: 'lock-screen',
    requiresPro: false,
    defaultAction: { type: 'system_action', action: 'lock_screen' },
  },
  {
    id: 'sys-sleep',
    name: 'Sleep',
    category: 'system',
    icon: 'sleep',
    requiresPro: false,
    defaultAction: { type: 'system_action', action: 'sleep' },
  },
  {
    id: 'sys-brightness-up',
    name: 'Brightness Up',
    category: 'system',
    icon: 'brightness-up',
    requiresPro: false,
    defaultAction: { type: 'system_action', action: 'brightness_up' },
  },
  {
    id: 'sys-brightness-down',
    name: 'Brightness Down',
    category: 'system',
    icon: 'brightness-down',
    requiresPro: false,
    defaultAction: { type: 'system_action', action: 'brightness_down' },
  },
  {
    id: 'sys-wifi',
    name: 'Wi-Fi Toggle',
    category: 'system',
    icon: 'wifi',
    requiresPro: false,
    defaultAction: { type: 'keybind', keys: ['win', 'a'] },
    description: 'Opens Windows Action Center',
  },

  // ── Clipboard (5) ──────────────────────────
  {
    id: 'clip-copy',
    name: 'Copy',
    category: 'clipboard',
    icon: 'copy',
    requiresPro: false,
    defaultAction: { type: 'keybind', keys: ['ctrl', 'c'] },
  },
  {
    id: 'clip-paste',
    name: 'Paste',
    category: 'clipboard',
    icon: 'paste',
    requiresPro: false,
    defaultAction: { type: 'keybind', keys: ['ctrl', 'v'] },
  },
  {
    id: 'clip-cut',
    name: 'Cut',
    category: 'clipboard',
    icon: 'cut',
    requiresPro: false,
    defaultAction: { type: 'keybind', keys: ['ctrl', 'x'] },
  },
  {
    id: 'clip-undo',
    name: 'Undo',
    category: 'clipboard',
    icon: 'undo',
    requiresPro: false,
    defaultAction: { type: 'keybind', keys: ['ctrl', 'z'] },
  },
  {
    id: 'clip-redo',
    name: 'Redo',
    category: 'clipboard',
    icon: 'redo',
    requiresPro: false,
    defaultAction: { type: 'keybind', keys: ['ctrl', 'y'] },
  },

  // ── Window Management (5) ──────────────────
  {
    id: 'win-minimize',
    name: 'Minimize',
    category: 'window',
    icon: 'minimize',
    requiresPro: false,
    defaultAction: { type: 'system_action', action: 'minimize_window' },
  },
  {
    id: 'win-snap-left',
    name: 'Snap Left',
    category: 'window',
    icon: 'snap-left',
    requiresPro: false,
    defaultAction: { type: 'system_action', action: 'snap_left' },
  },
  {
    id: 'win-snap-right',
    name: 'Snap Right',
    category: 'window',
    icon: 'snap-right',
    requiresPro: false,
    defaultAction: { type: 'system_action', action: 'snap_right' },
  },
  {
    id: 'win-switch',
    name: 'Switch Window',
    category: 'window',
    icon: 'switch-window',
    requiresPro: false,
    defaultAction: { type: 'system_action', action: 'switch_window' },
  },
  {
    id: 'win-close',
    name: 'Close Window',
    category: 'window',
    icon: 'close-tab',
    requiresPro: false,
    defaultAction: { type: 'system_action', action: 'close_window' },
  },

  // ── App Launch (8) ─────────────────────────
  {
    id: 'app-browser',
    name: 'Browser',
    category: 'app_launch',
    icon: 'globe',
    requiresPro: false,
    defaultAction: { type: 'keybind', keys: ['win', '1'] },
    description: 'Opens first pinned taskbar app (usually browser)',
  },
  {
    id: 'app-explorer',
    name: 'File Explorer',
    category: 'app_launch',
    icon: 'folder',
    requiresPro: false,
    defaultAction: { type: 'keybind', keys: ['win', 'e'] },
  },
  {
    id: 'app-terminal',
    name: 'Terminal',
    category: 'app_launch',
    icon: 'terminal',
    requiresPro: false,
    defaultAction: { type: 'app_launch', path: 'C:\\Windows\\System32\\wt.exe' },
  },
  {
    id: 'app-notepad',
    name: 'Notepad',
    category: 'app_launch',
    icon: 'text',
    requiresPro: false,
    defaultAction: { type: 'app_launch', path: 'C:\\Windows\\System32\\notepad.exe' },
  },
  {
    id: 'app-calc',
    name: 'Calculator',
    category: 'app_launch',
    icon: 'target',
    requiresPro: false,
    defaultAction: { type: 'app_launch', path: 'C:\\Windows\\System32\\calc.exe' },
  },
  {
    id: 'app-settings',
    name: 'Settings',
    category: 'app_launch',
    icon: 'wand',
    requiresPro: false,
    defaultAction: { type: 'keybind', keys: ['win', 'i'] },
  },
  {
    id: 'app-task-manager',
    name: 'Task Manager',
    category: 'app_launch',
    icon: 'bug',
    requiresPro: false,
    defaultAction: { type: 'keybind', keys: ['ctrl', 'shift', 'escape'] },
  },
  {
    id: 'app-snipping',
    name: 'Snipping Tool',
    category: 'app_launch',
    icon: 'crop',
    requiresPro: false,
    defaultAction: { type: 'keybind', keys: ['win', 'shift', 's'] },
  },

  // ── OBS Studio (6, Pro) ────────────────────
  {
    id: 'obs-scene',
    name: 'Switch Scene',
    category: 'obs',
    icon: 'scene-switch',
    requiresPro: true,
    defaultAction: { type: 'obs', command: 'switch_scene', sceneName: 'Scene 1' },
  },
  {
    id: 'obs-record',
    name: 'Toggle Record',
    category: 'obs',
    icon: 'recording',
    requiresPro: true,
    defaultAction: { type: 'obs', command: 'toggle_record' },
  },
  {
    id: 'obs-stream',
    name: 'Toggle Stream',
    category: 'obs',
    icon: 'go-live',
    requiresPro: true,
    defaultAction: { type: 'obs', command: 'toggle_stream' },
  },
  {
    id: 'obs-source',
    name: 'Toggle Source',
    category: 'obs',
    icon: 'layers',
    requiresPro: true,
    defaultAction: { type: 'obs', command: 'toggle_source', sourceName: 'Camera' },
  },
  {
    id: 'obs-replay',
    name: 'Replay Buffer',
    category: 'obs',
    icon: 'record',
    requiresPro: true,
    defaultAction: { type: 'obs', command: 'replay_buffer' },
  },
  {
    id: 'obs-screenshot',
    name: 'OBS Screenshot',
    category: 'obs',
    icon: 'screenshot',
    requiresPro: true,
    defaultAction: { type: 'obs', command: 'obs_screenshot' },
  },

  // ── Discord (3, Pro) ───────────────────────
  {
    id: 'discord-mute',
    name: 'Toggle Mute',
    category: 'discord',
    icon: 'volume-mute',
    requiresPro: true,
    defaultAction: { type: 'discord', command: 'toggle_mute' },
  },
  {
    id: 'discord-deafen',
    name: 'Toggle Deafen',
    category: 'discord',
    icon: 'headphones',
    requiresPro: true,
    defaultAction: { type: 'discord', command: 'toggle_deafen' },
  },
  {
    id: 'discord-ptt',
    name: 'Push to Talk',
    category: 'discord',
    icon: 'push-to-talk',
    requiresPro: true,
    defaultAction: { type: 'discord', command: 'push_to_talk' },
  },

  // ── Utility (5) ────────────────────────────
  {
    id: 'util-timer',
    name: 'Timer',
    category: 'utility',
    icon: 'target',
    requiresPro: false,
    defaultAction: { type: 'timer', durationMs: 300000, countUp: false, label: 'Timer' },
  },
  {
    id: 'util-counter',
    name: 'Counter',
    category: 'utility',
    icon: 'target',
    requiresPro: false,
    defaultAction: { type: 'counter', initialValue: 0, step: 1, label: 'Counter' },
  },
  {
    id: 'util-text',
    name: 'Text Input',
    category: 'utility',
    icon: 'text',
    requiresPro: false,
    defaultAction: { type: 'text_input', text: 'Hello!' },
  },
  {
    id: 'util-folder',
    name: 'Folder',
    category: 'utility',
    icon: 'folder',
    requiresPro: true,
    defaultAction: {
      type: 'folder',
      folderId: '',
      folderName: 'New Folder',
      buttons: [],
      layout: '3x4',
    },
  },
  {
    id: 'util-save',
    name: 'Save',
    category: 'utility',
    icon: 'save',
    requiresPro: false,
    defaultAction: { type: 'keybind', keys: ['ctrl', 's'] },
  },

  // ── Pre-made Macros (4, Pro) ───────────────
  {
    id: 'macro-dnd',
    name: 'Do Not Disturb',
    category: 'macros',
    icon: 'notification',
    requiresPro: true,
    defaultAction: {
      type: 'multi_action',
      actions: [
        { type: 'system_action', action: 'volume_mute' },
        { type: 'system_action', action: 'mic_mute' },
      ],
      delays: [200],
    },
    description: 'Mutes volume + microphone',
  },
  {
    id: 'macro-meeting',
    name: 'Meeting Mode',
    category: 'macros',
    icon: 'video-call',
    requiresPro: true,
    defaultAction: {
      type: 'multi_action',
      actions: [
        { type: 'system_action', action: 'mic_mute' },
        { type: 'keybind', keys: ['win', 'd'] },
      ],
      delays: [300],
    },
    description: 'Mutes mic + shows desktop',
  },
  {
    id: 'macro-stream-start',
    name: 'Stream Start',
    category: 'macros',
    icon: 'go-live',
    requiresPro: true,
    defaultAction: {
      type: 'multi_action',
      actions: [
        { type: 'system_action', action: 'volume_mute' },
      ],
      delays: [],
    },
    description: 'One-tap stream preparation',
  },
  {
    id: 'macro-screenshot-copy',
    name: 'Screenshot + Copy',
    category: 'macros',
    icon: 'screenshot',
    requiresPro: true,
    defaultAction: {
      type: 'multi_action',
      actions: [
        { type: 'keybind', keys: ['win', 'shift', 's'] },
      ],
      delays: [],
    },
    description: 'Snipping tool screenshot',
  },
];

// --- Helpers ---

export function getTilesByCategory(category: TileCategory): ActionTile[] {
  return ACTION_TILES.filter((t) => t.category === category);
}

export function getTileById(id: string): ActionTile | undefined {
  return ACTION_TILES.find((t) => t.id === id);
}

export function searchTiles(query: string): ActionTile[] {
  const q = query.toLowerCase().trim();
  if (!q) return ACTION_TILES;
  return ACTION_TILES.filter(
    (t) => t.name.toLowerCase().includes(q)
      || t.category.toLowerCase().includes(q)
      || t.description?.toLowerCase().includes(q),
  );
}
