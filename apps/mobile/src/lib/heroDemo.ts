/**
 * Hero Demo profile ? temporary, hidden behind a long-press on the
 * Settings -> Version row. Loads a 4x5 deck populated with bundled
 * looping GIFs so screenshots come out vibrant without remote fetch.
 *
 * Why bundled GIFs (not remote): App Store reviewers flag any unverified
 * remote-image fetch on a trial path. Bundled GIFs ship with the app,
 * have zero cert risk, and don't break offline. ~374 KB total ? small
 * enough to leave shipped indefinitely if we want.
 *
 * Why hidden: this preset is for marketing screenshots, not end users.
 * The gesture is tap-and-hold-version-row -> confirm -> load.
 *
 * Lifetime: lands in v1.4 alongside the widget/watch features. Safe to
 * leave shipped (gestural easter egg) or rip out after launch.
 */

import { Image as RNImage } from 'react-native';
import type { ProfileConfig, ButtonConfig } from '@luminadeck/shared';

type HeroGifAssets = {
  equalizer: string;
  vinyl: string;
  recording: string;
  waveform: string;
  drumPads: string;
  cursor: string;
  radar: string;
  headphones: string;
  spectrum: string;
  cassette: string;
};

function gifUri(source: number): string {
  const resolved = RNImage.resolveAssetSource(source);
  if (!resolved?.uri) {
    throw new Error('Bundled hero demo GIF did not resolve to a URI');
  }
  return resolved.uri;
}

// Resolve bundled GIFs lazily. This module used to resolve all GIF require()
// calls at module-load time; because SettingsScreen is imported during app
// startup, one bad asset in a TestFlight bundle could kill launch before any
// React error boundary or async init catch ran. Keeping resolution inside the
// hidden screenshot-helper flow makes launch independent from marketing assets.
function getHeroGifAssets(): HeroGifAssets {
  return {
    equalizer: gifUri(require('../../assets/gifs/equalizer.gif')),
    vinyl: gifUri(require('../../assets/gifs/vinyl.gif')),
    recording: gifUri(require('../../assets/gifs/recording.gif')),
    waveform: gifUri(require('../../assets/gifs/waveform.gif')),
    drumPads: gifUri(require('../../assets/gifs/drumPads.gif')),
    cursor: gifUri(require('../../assets/gifs/cursor.gif')),
    radar: gifUri(require('../../assets/gifs/radar.gif')),
    headphones: gifUri(require('../../assets/gifs/headphones.gif')),
    spectrum: gifUri(require('../../assets/gifs/spectrum.gif')),
    cassette: gifUri(require('../../assets/gifs/cassette.gif')),
  };
}

type ButtonSeed = Omit<ButtonConfig, 'page' | 'position' | 'id'>;

function buildPage(pageIndex: number, _cols: number, seeds: ButtonSeed[]): ButtonConfig[] {
  return seeds.map((seed, i) => ({
    ...seed,
    id: `hero-p${pageIndex}-${i}`,
    page: pageIndex,
    position: i,
  }));
}

// 4x5 = 20 tiles. Visual story rows:
// row 1: media transport (GIF-led)
// row 2: streaming + record (recording GIF, radar, cassette, headphones)
// row 3: producer (drumPads, vinyl, waveform, spectrum)
// row 4: dev (cursor + 3 dev shortcut tiles)
// row 5: system controls (mute, lock, screenshot, media)
function buildHeroPage0Seeds(gifs: HeroGifAssets): ButtonSeed[] {
  return [
    // --- row 1: now playing
    { label: 'Now Playing', color: '#7B2FF7', customImage: gifs.headphones,
      action: { type: 'system_action', action: 'media_play_pause' } },
    { label: 'Skip',        color: '#5B8DD9', icon: 'skip-forward',
      action: { type: 'system_action', action: 'media_next' } },
    { label: 'Back',        color: '#5B8DD9', icon: 'skip-back',
      action: { type: 'system_action', action: 'media_prev' } },
    { label: 'Vol Up',      color: '#62B8E3', icon: 'volume-up',
      action: { type: 'system_action', action: 'volume_up' } },

    // --- row 2: streaming
    { label: 'Go Live',     color: '#FF4757', customImage: gifs.recording,
      action: { type: 'keybind', keys: ['ctrl', 'shift', 's'] } },
    { label: 'Scene',       color: '#62B8E3', customImage: gifs.radar,
      action: { type: 'keybind', keys: ['ctrl', 'shift', '1'] } },
    { label: 'Mute Mic',    color: '#FF6B35', icon: 'mic-mute',
      action: { type: 'discord', command: 'toggle_mute' } },
    { label: 'Cassette',    color: '#A87DE8', customImage: gifs.cassette,
      action: { type: 'keybind', keys: ['ctrl', 'shift', 'r'] } },

    // --- row 3: producer
    { label: 'Drum Pads',   color: '#FF00AA', customImage: gifs.drumPads,
      action: { type: 'keybind', keys: ['ctrl', 'shift', '1'] } },
    { label: 'Spin',        color: '#7B2FF7', customImage: gifs.vinyl,
      action: { type: 'keybind', keys: ['ctrl', 'shift', '2'] } },
    { label: 'Waveform',    color: '#62B8E3', customImage: gifs.waveform,
      action: { type: 'keybind', keys: ['ctrl', 'shift', '3'] } },
    { label: 'Spectrum',    color: '#FF6B35', customImage: gifs.spectrum,
      action: { type: 'keybind', keys: ['ctrl', 'shift', '4'] } },

    // --- row 4: dev
    { label: 'Code',        color: '#5B8DD9', customImage: gifs.cursor,
      action: { type: 'keybind', keys: ['ctrl', 's'] } },
    { label: 'Build',       color: '#62B8E3', icon: 'gear',
      action: { type: 'keybind', keys: ['ctrl', 'shift', 'b'] } },
    { label: 'Format',      color: '#7B2FF7', icon: 'sparkles',
      action: { type: 'keybind', keys: ['shift', 'alt', 'f'] } },
    { label: 'Terminal',    color: '#A87DE8', icon: 'keyboard',
      action: { type: 'keybind', keys: ['ctrl', 'backtick'] } },

    // --- row 5: system
    { label: 'EQ',          color: '#62B8E3', customImage: gifs.equalizer,
      action: { type: 'system_action', action: 'volume_mute' } },
    { label: 'Lock',        color: '#FF4757', icon: 'gear',
      action: { type: 'system_action', action: 'lock_screen' } },
    { label: 'Mute',        color: '#A87DE8', icon: 'volume-mute',
      action: { type: 'system_action', action: 'volume_mute' } },
    { label: 'Screenshot',  color: '#62B8E3', icon: 'screenshot',
      action: { type: 'system_action', action: 'screenshot' } },
  ];
}

// Page 2 ? Streamer-focused 2x4 wrist-friendly layout
function buildHeroPage1Seeds(gifs: HeroGifAssets): ButtonSeed[] {
  return [
    { label: 'Cue 1',     color: '#FF00AA', customImage: gifs.drumPads,
      action: { type: 'keybind', keys: ['ctrl', 'shift', '5'] } },
    { label: 'Cue 2',     color: '#7B2FF7', customImage: gifs.vinyl,
      action: { type: 'keybind', keys: ['ctrl', 'shift', '6'] } },
    { label: 'Live',      color: '#FF4757', customImage: gifs.recording,
      action: { type: 'keybind', keys: ['ctrl', 'shift', '7'] } },
    { label: 'Sweep',     color: '#62B8E3', customImage: gifs.radar,
      action: { type: 'keybind', keys: ['ctrl', 'shift', '8'] } },

    { label: 'Bass',      color: '#A87DE8', customImage: gifs.headphones,
      action: { type: 'system_action', action: 'volume_up' } },
    { label: 'Lo-Fi',     color: '#FF6B35', customImage: gifs.cassette,
      action: { type: 'system_action', action: 'volume_down' } },
    { label: 'Beat',      color: '#7B2FF7', customImage: gifs.equalizer,
      action: { type: 'system_action', action: 'volume_mute' } },
    { label: 'Wave',      color: '#5B8DD9', customImage: gifs.waveform,
      action: { type: 'keybind', keys: ['ctrl', 'shift', '9'] } },
  ];
}

/**
 * Build a fresh ProfileConfig for the hero demo. Generates a unique id +
 * timestamps each call so loading the demo twice doesn't collide.
 */
export function buildHeroDemoProfile(): ProfileConfig {
  const gifs = getHeroGifAssets();
  const now = new Date().toISOString();
  const stamp = Date.now().toString(36);
  return {
    id: `hero-demo-${stamp}`,
    name: 'Hero Demo',
    theme: 'aurora',
    createdAt: now,
    updatedAt: now,
    pages: [
      {
        id: `hero-p0-${stamp}`,
        name: 'Hero',
        layout: '4x5',
        buttons: buildPage(0, 4, buildHeroPage0Seeds(gifs)),
      },
      {
        id: `hero-p1-${stamp}`,
        name: 'Studio',
        layout: '2x4',
        buttons: buildPage(1, 2, buildHeroPage1Seeds(gifs)),
      },
    ],
  };
}
