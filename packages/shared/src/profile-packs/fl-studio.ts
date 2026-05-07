import type { ProfileConfig } from '../types';

/**
 * FL Studio 21+ — transport + window shortcuts. Pro-gated.
 * Uses the FL default keymap. The F-key views (Browser/Piano/Playlist/Mixer)
 * mirror what the toolbar buttons do in the default layout.
 */
export const flStudioPack: ProfileConfig = {
  id: 'pack-fl-studio',
  name: 'FL Studio',
  theme: 'lofi',
  createdAt: '2026-04-22T00:00:00.000Z',
  updatedAt: '2026-04-22T00:00:00.000Z',
  pages: [
    {
      id: 'pack-fl-main',
      name: 'FL Studio',
      layout: '3x4',
      buttons: [
        { id: 'fl-play', label: 'Play/Stop', icon: 'play-pause', color: '#2AAFC4', page: 0, position: 0,
          action: { type: 'keybind', keys: ['space'] } },
        { id: 'fl-rec',  label: 'Record', icon: 'record', color: '#D92D20', page: 0, position: 1,
          action: { type: 'keybind', keys: ['r'] } },
        { id: 'fl-song', label: 'Song/Pat', icon: 'loop', color: '#2AAFC4', page: 0, position: 2,
          action: { type: 'keybind', keys: ['l'] } },

        { id: 'fl-metro', label: 'Metronome', icon: 'metronome', color: '#1A1A2E', page: 0, position: 3,
          action: { type: 'keybind', keys: ['ctrl', 'm'] } },
        { id: 'fl-undo',  label: 'Undo', icon: 'undo', color: '#16213E', page: 0, position: 4,
          action: { type: 'keybind', keys: ['ctrl', 'z'] } },
        { id: 'fl-redo',  label: 'Redo', icon: 'redo', color: '#16213E', page: 0, position: 5,
          action: { type: 'keybind', keys: ['ctrl', 'alt', 'z'] } },

        { id: 'fl-play-list', label: 'Playlist', icon: 'grid', color: '#0F3460', page: 0, position: 6,
          action: { type: 'keybind', keys: ['f5'] } },
        { id: 'fl-piano',     label: 'Piano', icon: 'keyboard', color: '#0F3460', page: 0, position: 7,
          action: { type: 'keybind', keys: ['f7'] } },
        { id: 'fl-browser',   label: 'Browser', icon: 'folder', color: '#0F3460', page: 0, position: 8,
          action: { type: 'keybind', keys: ['f8'] } },

        { id: 'fl-mixer', label: 'Mixer', icon: 'sliders', color: '#0F3460', page: 0, position: 9,
          action: { type: 'keybind', keys: ['f9'] } },
        { id: 'fl-save',  label: 'Save', icon: 'save', color: '#0F3460', page: 0, position: 10,
          action: { type: 'keybind', keys: ['ctrl', 's'] } },
        { id: 'fl-open',  label: 'Open', icon: 'folder', color: '#0F3460', page: 0, position: 11,
          action: { type: 'keybind', keys: ['ctrl', 'o'] } },
      ],
    },
  ],
};
