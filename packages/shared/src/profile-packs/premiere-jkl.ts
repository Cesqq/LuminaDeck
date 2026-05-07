import type { ProfileConfig } from '../types';

/**
 * Adobe Premiere Pro CC — JKL shuttle + ripple/rolling trim. Pro-gated.
 * Uses the default Premiere keymap; the Q/W ripple-trim keys in particular
 * are distinctive to Premiere and worth calling out on a deck.
 */
export const premiereJklPack: ProfileConfig = {
  id: 'pack-premiere-jkl',
  name: 'Premiere JKL',
  theme: 'obsidian',
  createdAt: '2026-04-22T00:00:00.000Z',
  updatedAt: '2026-04-22T00:00:00.000Z',
  pages: [
    {
      id: 'pack-premiere-main',
      name: 'Premiere JKL',
      layout: '3x4',
      buttons: [
        { id: 'pr-j', label: 'J (rev)', icon: 'skip-back', color: '#A259FF', page: 0, position: 0,
          action: { type: 'keybind', keys: ['j'] } },
        { id: 'pr-k', label: 'K (pause)', icon: 'play-pause', color: '#A259FF', page: 0, position: 1,
          action: { type: 'keybind', keys: ['k'] } },
        { id: 'pr-l', label: 'L (fwd)', icon: 'skip-forward', color: '#A259FF', page: 0, position: 2,
          action: { type: 'keybind', keys: ['l'] } },

        { id: 'pr-in',  label: 'Mark In', icon: 'bracket-left', color: '#1A1A2E', page: 0, position: 3,
          action: { type: 'keybind', keys: ['i'] } },
        { id: 'pr-out', label: 'Mark Out', icon: 'bracket-right', color: '#1A1A2E', page: 0, position: 4,
          action: { type: 'keybind', keys: ['o'] } },
        { id: 'pr-cut', label: 'Cut', icon: 'scissors', color: '#1A1A2E', page: 0, position: 5,
          action: { type: 'keybind', keys: ['ctrl', 'k'] } },

        { id: 'pr-q', label: 'Q trim', icon: 'scissors', color: '#16213E', page: 0, position: 6,
          action: { type: 'keybind', keys: ['q'] } },
        { id: 'pr-w', label: 'W trim', icon: 'scissors', color: '#16213E', page: 0, position: 7,
          action: { type: 'keybind', keys: ['w'] } },
        { id: 'pr-del', label: 'Delete', icon: 'trash', color: '#D92D20', page: 0, position: 8,
          action: { type: 'keybind', keys: ['delete'] } },

        { id: 'pr-rippledel', label: 'Ripple Del', icon: 'trash', color: '#D92D20', page: 0, position: 9,
          action: { type: 'keybind', keys: ['shift', 'delete'] } },
        { id: 'pr-undo', label: 'Undo', icon: 'undo', color: '#0F3460', page: 0, position: 10,
          action: { type: 'keybind', keys: ['ctrl', 'z'] } },
        { id: 'pr-save', label: 'Save', icon: 'save', color: '#0F3460', page: 0, position: 11,
          action: { type: 'keybind', keys: ['ctrl', 's'] } },
      ],
    },
  ],
};
