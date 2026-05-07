/**
 * Curated first-party profile packs (Phase B5). Each pack is a
 * ProfileConfig the user can install in one tap. DAW packs are Pro-gated
 * because they're the primary "why upgrade" hook for content creators;
 * streaming and vtuber packs are free so the entry-level audience has an
 * immediate win after install.
 *
 * This module is a plain TS export (not JSON). The plan named JSON files;
 * we went with TS so the `ProfileConfig` type checks every pack at build
 * time instead of at runtime after import, and so each pack can carry
 * inline comments explaining choices.
 */

import type { ProfileConfig } from '../types';
import { abletonLivePack } from './ableton-live';
import { flStudioPack } from './fl-studio';
import { davinciResolvePack } from './davinci-resolve';
import { premiereJklPack } from './premiere-jkl';
import { vtubeStudioPack } from './vtube-studio';
import { obsStreamingPack } from './obs-streaming';
import { coderPack } from './coder';
import { soundboardPack } from './soundboard';

export type ProfilePackCategory = 'daw' | 'streaming' | 'video' | 'vtuber' | 'coder' | 'soundboard';

export interface ProfilePack {
  id: string;
  name: string;
  description: string;
  category: ProfilePackCategory;
  /** Pro tier required to install. Free-tier users see the card greyed out with an "Upgrade" CTA. */
  isProOnly: boolean;
  /** Accent color used by the store card. Defaults to the first tile's color if absent. */
  accentColor: string;
  profile: ProfileConfig;
}

export const PROFILE_PACKS: readonly ProfilePack[] = [
  {
    id: 'ableton-live',
    name: 'Ableton Live',
    description: 'Transport, metronome, quantize, and track creation for Ableton Live 11/12.',
    category: 'daw',
    isProOnly: true,
    accentColor: '#FF6B35',
    profile: abletonLivePack,
  },
  {
    id: 'fl-studio',
    name: 'FL Studio',
    description: 'Playlist, Piano Roll, Mixer, and transport for FL Studio 21+.',
    category: 'daw',
    isProOnly: true,
    accentColor: '#2AAFC4',
    profile: flStudioPack,
  },
  {
    id: 'davinci-resolve',
    name: 'DaVinci Resolve',
    description: 'JKL shuttle, mark in/out, blade, and ripple delete for Resolve 19+.',
    category: 'video',
    isProOnly: true,
    accentColor: '#0066CC',
    profile: davinciResolvePack,
  },
  {
    id: 'premiere-jkl',
    name: 'Premiere JKL',
    description: 'JKL shuttle with Q/W ripple trim for Adobe Premiere Pro.',
    category: 'video',
    isProOnly: true,
    accentColor: '#A259FF',
    profile: premiereJklPack,
  },
  {
    id: 'vtube-studio',
    name: 'VTube Studio',
    description: 'Twelve F-key triggers for expressions, outfits, and animations.',
    category: 'vtuber',
    isProOnly: false,
    accentColor: '#FF6EC7',
    profile: vtubeStudioPack,
  },
  {
    id: 'obs-streaming',
    name: 'OBS Streaming',
    description: 'Scene switch, record/stream, mic/cam, and replay buffer for OBS.',
    category: 'streaming',
    isProOnly: false,
    accentColor: '#5EB85B',
    profile: obsStreamingPack,
  },
  {
    id: 'coder',
    name: 'Coder',
    description: 'VS Code, git, terminal, build/test, Docker. One-tap dev workflow.',
    category: 'coder',
    isProOnly: true,
    accentColor: '#A6E22E',
    profile: coderPack,
  },
  {
    id: 'soundboard',
    name: 'Soundboard',
    description: 'Drop GIFs + sound triggers. Bring chaos to Discord, no extra hardware.',
    category: 'soundboard',
    isProOnly: false,
    accentColor: '#FF00AA',
    profile: soundboardPack,
  },
];

/**
 * Produce a fresh copy of the pack's profile with brand-new ids on the
 * profile, each page, and each button. The user can install the same pack
 * multiple times (e.g. per-project variants) without colliding with other
 * profiles already on-device.
 */
export function instantiatePack(pack: ProfilePack): ProfileConfig {
  const now = new Date().toISOString();
  const prefix = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  return {
    ...pack.profile,
    id: `${pack.profile.id}-${prefix}`,
    createdAt: now,
    updatedAt: now,
    pages: pack.profile.pages.map((page, pi) => ({
      ...page,
      id: `${page.id}-${prefix}`,
      buttons: page.buttons.map((btn, bi) => ({
        ...btn,
        id: `${btn.id}-${prefix}-${pi}-${bi}`,
      })),
    })),
  };
}
