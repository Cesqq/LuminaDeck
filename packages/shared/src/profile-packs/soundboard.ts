import type { ProfileConfig } from '../types';

/**
 * Soundboard / Meme Console — free pack. Ships an empty-ish 3x4 grid
 * with the chaos theme so users can drop in their own GIF tiles + sound
 * triggers right away. The blank slots are intentional — this is the
 * "your deck, your memes" pack, not a curated soundboard. We seed three
 * starter tiles (Play/Pause, Mute, Trackpad) so an empty deck still has
 * something to demo with on first launch.
 *
 * Why chaos theme: pill tiles + magenta glow + pixel-y vibe matches the
 * "bring your own GIFs" energy and signals the pack is for fun, not work.
 */
export const soundboardPack: ProfileConfig = {
  id: 'pack-soundboard',
  name: 'Soundboard',
  theme: 'chaos',
  createdAt: '2026-04-25T00:00:00.000Z',
  updatedAt: '2026-04-25T00:00:00.000Z',
  pages: [
    {
      id: 'pack-soundboard-main',
      name: 'Soundboard',
      layout: '3x4',
      buttons: [
        // Row 1 — empty slots for user-supplied GIF tiles. Users tap and
        // pick a GIF + assign a custom action.
        // (Empty positions are absent from the buttons array; the grid
        // renders empty-cell placeholders for missing positions.)

        // Row 2 — three more empty slots.

        // Row 3 — sample meme triggers. Free-tier users can swap these out
        // freely; multi_action chains stay Pro-gated so the pack still
        // creates organic upsell moments.
        {
          id: 'sb-airhorn',
          label: 'Airhorn',
          icon: 'broadcast',
          color: '#FF00AA',
          page: 0,
          position: 6,
          action: { type: 'keybind', keys: ['ctrl', 'shift', '1'] },
        },
        {
          id: 'sb-bruh',
          label: 'Bruh',
          icon: 'mic',
          color: '#7B2FF7',
          page: 0,
          position: 7,
          action: { type: 'keybind', keys: ['ctrl', 'shift', '2'] },
        },
        {
          id: 'sb-rimshot',
          label: 'Rimshot',
          icon: 'volume-mute',
          color: '#00FFD9',
          page: 0,
          position: 8,
          action: { type: 'keybind', keys: ['ctrl', 'shift', '3'] },
        },

        // Row 4 — utility tiles you actually want during chaos.
        {
          id: 'sb-pause',
          label: 'Pause Music',
          icon: 'play-pause',
          color: '#1A0033',
          page: 0,
          position: 9,
          action: { type: 'system_action', action: 'media_play_pause' },
        },
        {
          id: 'sb-mute',
          label: 'Panic Mute',
          icon: 'volume-mute',
          color: '#1A0033',
          page: 0,
          position: 10,
          action: {
            type: 'multi_action',
            actions: [
              { type: 'system_action', action: 'volume_mute' },
              { type: 'system_action', action: 'mic_mute' },
            ],
            delays: [80],
          },
        },
        {
          id: 'sb-trackpad',
          label: 'Trackpad',
          icon: 'target',
          color: '#1A0033',
          page: 0,
          position: 11,
          action: { type: 'trackpad', sensitivity: 1.0 },
        },
      ],
    },
  ],
};
