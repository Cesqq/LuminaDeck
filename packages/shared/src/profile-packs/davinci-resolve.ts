import type { ProfileConfig } from '../types';

/**
 * DaVinci Resolve 19+ — Cut & Edit page transport + JKL shuttle. Pro-gated.
 * Default Resolve bindings; the Fairlight and Fusion pages have their own
 * shortcuts — this pack targets the editing workflow (Cut/Edit).
 */
export const davinciResolvePack: ProfileConfig = {
  id: 'pack-davinci-resolve',
  name: 'DaVinci Resolve',
  theme: 'obsidian',
  createdAt: '2026-04-22T00:00:00.000Z',
  updatedAt: '2026-04-22T00:00:00.000Z',
  pages: [
    {
      id: 'pack-davinci-main',
      name: 'DaVinci Resolve',
      layout: '3x4',
      buttons: [
        { id: 'dv-rev', label: 'Reverse', icon: 'skip-back', color: '#0066CC', page: 0, position: 0,
          action: { type: 'keybind', keys: ['j'] } },
        { id: 'dv-pause', label: 'Pause', icon: 'play-pause', color: '#0066CC', page: 0, position: 1,
          action: { type: 'keybind', keys: ['k'] } },
        { id: 'dv-fwd', label: 'Forward', icon: 'skip-forward', color: '#0066CC', page: 0, position: 2,
          action: { type: 'keybind', keys: ['l'] } },

        { id: 'dv-in',  label: 'Mark In', icon: 'bracket-left', color: '#1A1A2E', page: 0, position: 3,
          action: { type: 'keybind', keys: ['i'] } },
        { id: 'dv-out', label: 'Mark Out', icon: 'bracket-right', color: '#1A1A2E', page: 0, position: 4,
          action: { type: 'keybind', keys: ['o'] } },
        { id: 'dv-blade', label: 'Blade', icon: 'scissors', color: '#1A1A2E', page: 0, position: 5,
          action: { type: 'keybind', keys: ['ctrl', 'b'] } },

        { id: 'dv-del', label: 'Delete', icon: 'trash', color: '#D92D20', page: 0, position: 6,
          action: { type: 'keybind', keys: ['delete'] } },
        { id: 'dv-rippledel', label: 'Ripple Del', icon: 'scissors', color: '#D92D20', page: 0, position: 7,
          action: { type: 'keybind', keys: ['shift', 'delete'] } },
        { id: 'dv-undo', label: 'Undo', icon: 'undo', color: '#16213E', page: 0, position: 8,
          action: { type: 'keybind', keys: ['ctrl', 'z'] } },

        { id: 'dv-redo', label: 'Redo', icon: 'redo', color: '#16213E', page: 0, position: 9,
          action: { type: 'keybind', keys: ['ctrl', 'shift', 'z'] } },
        { id: 'dv-save', label: 'Save', icon: 'save', color: '#0F3460', page: 0, position: 10,
          action: { type: 'keybind', keys: ['ctrl', 's'] } },
        { id: 'dv-fit',  label: 'Fit', icon: 'expand', color: '#0F3460', page: 0, position: 11,
          action: { type: 'keybind', keys: ['z'] } },
      ],
    },
  ],
};
