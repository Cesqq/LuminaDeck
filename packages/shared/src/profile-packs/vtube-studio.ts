import type { ProfileConfig } from '../types';

/**
 * VTube Studio — free pack. VTube's hotkeys are entirely user-configurable
 * from the app's Config → Hotkeys panel, so this pack ships 12 labelled
 * F-key tiles that map to the recommended F1–F12 range. After install,
 * users should set each VTube hotkey to the matching F-key.
 */
export const vtubeStudioPack: ProfileConfig = {
  id: 'pack-vtube-studio',
  name: 'VTube Studio',
  theme: 'obsidian',
  createdAt: '2026-04-22T00:00:00.000Z',
  updatedAt: '2026-04-22T00:00:00.000Z',
  pages: [
    {
      id: 'pack-vtube-main',
      name: 'VTube Studio',
      layout: '3x4',
      buttons: [
        { id: 'vt-exp1', label: 'Expression 1', icon: 'smile', color: '#FF6EC7', page: 0, position: 0,
          action: { type: 'keybind', keys: ['f1'] } },
        { id: 'vt-exp2', label: 'Expression 2', icon: 'smile', color: '#FF6EC7', page: 0, position: 1,
          action: { type: 'keybind', keys: ['f2'] } },
        { id: 'vt-exp3', label: 'Expression 3', icon: 'smile', color: '#FF6EC7', page: 0, position: 2,
          action: { type: 'keybind', keys: ['f3'] } },

        { id: 'vt-outfit1', label: 'Outfit 1', icon: 'shirt', color: '#A259FF', page: 0, position: 3,
          action: { type: 'keybind', keys: ['f4'] } },
        { id: 'vt-outfit2', label: 'Outfit 2', icon: 'shirt', color: '#A259FF', page: 0, position: 4,
          action: { type: 'keybind', keys: ['f5'] } },
        { id: 'vt-anim1',   label: 'Anim 1', icon: 'sparkles', color: '#A259FF', page: 0, position: 5,
          action: { type: 'keybind', keys: ['f6'] } },

        { id: 'vt-anim2', label: 'Anim 2', icon: 'sparkles', color: '#A259FF', page: 0, position: 6,
          action: { type: 'keybind', keys: ['f7'] } },
        { id: 'vt-toss',  label: 'Item Toss', icon: 'arrow-up', color: '#0F3460', page: 0, position: 7,
          action: { type: 'keybind', keys: ['f8'] } },
        { id: 'vt-bg',    label: 'BG toggle', icon: 'image', color: '#0F3460', page: 0, position: 8,
          action: { type: 'keybind', keys: ['f9'] } },

        { id: 'vt-reset', label: 'Reset track', icon: 'refresh', color: '#16213E', page: 0, position: 9,
          action: { type: 'keybind', keys: ['f10'] } },
        { id: 'vt-phys',  label: 'Physics', icon: 'gear', color: '#16213E', page: 0, position: 10,
          action: { type: 'keybind', keys: ['f11'] } },
        { id: 'vt-screenshot', label: 'Snapshot', icon: 'screenshot', color: '#1A1A2E', page: 0, position: 11,
          action: { type: 'system_action', action: 'screenshot' } },
      ],
    },
  ],
};
