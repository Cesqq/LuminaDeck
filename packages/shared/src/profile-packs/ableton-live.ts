import type { ProfileConfig } from '../types';

/**
 * Ableton Live 11/12 — transport + arrangement shortcuts. Pro-gated.
 * All tiles use the default Live 10+ key bindings; users who have remapped
 * Ableton preferences may need to adjust individual tiles after import.
 */
export const abletonLivePack: ProfileConfig = {
  id: 'pack-ableton-live',
  name: 'Ableton Live',
  theme: 'lofi',
  createdAt: '2026-04-22T00:00:00.000Z',
  updatedAt: '2026-04-22T00:00:00.000Z',
  pages: [
    {
      id: 'pack-ableton-main',
      name: 'Ableton Live',
      layout: '3x4',
      buttons: [
        { id: 'ab-play', label: 'Play/Stop', icon: 'play-pause', color: '#FF6B35', page: 0, position: 0,
          action: { type: 'keybind', keys: ['space'] } },
        { id: 'ab-rec',  label: 'Record', icon: 'record', color: '#D92D20', page: 0, position: 1,
          action: { type: 'keybind', keys: ['f9'] } },
        { id: 'ab-loop', label: 'Loop', icon: 'loop', color: '#FF6B35', page: 0, position: 2,
          action: { type: 'keybind', keys: ['ctrl', 'l'] } },

        { id: 'ab-metro', label: 'Metronome', icon: 'metronome', color: '#1A1A2E', page: 0, position: 3,
          action: { type: 'keybind', keys: ['ctrl', 'shift', 'm'] } },
        { id: 'ab-tap',   label: 'Tap BPM', icon: 'tap', color: '#1A1A2E', page: 0, position: 4,
          action: { type: 'keybind', keys: ['t'] } },
        { id: 'ab-newmidi', label: 'New MIDI', icon: 'plus', color: '#1A1A2E', page: 0, position: 5,
          action: { type: 'keybind', keys: ['ctrl', 'shift', 't'] } },

        { id: 'ab-newaud',  label: 'New Audio', icon: 'plus', color: '#1A1A2E', page: 0, position: 6,
          action: { type: 'keybind', keys: ['ctrl', 't'] } },
        { id: 'ab-undo',    label: 'Undo', icon: 'undo', color: '#16213E', page: 0, position: 7,
          action: { type: 'keybind', keys: ['ctrl', 'z'] } },
        { id: 'ab-redo',    label: 'Redo', icon: 'redo', color: '#16213E', page: 0, position: 8,
          action: { type: 'keybind', keys: ['ctrl', 'shift', 'z'] } },

        { id: 'ab-save',  label: 'Save', icon: 'save', color: '#0F3460', page: 0, position: 9,
          action: { type: 'keybind', keys: ['ctrl', 's'] } },
        { id: 'ab-quant', label: 'Quantize', icon: 'grid', color: '#0F3460', page: 0, position: 10,
          action: { type: 'keybind', keys: ['ctrl', 'u'] } },
        { id: 'ab-full',  label: 'Fullscreen', icon: 'expand', color: '#0F3460', page: 0, position: 11,
          action: { type: 'keybind', keys: ['f11'] } },
      ],
    },
  ],
};
