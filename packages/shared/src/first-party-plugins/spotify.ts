/**
 * Spotify first-party plugin manifest (Phase B7).
 *
 * Reference manifest — the actual sidecar binary lives in a separate repo
 * and is signed by the LuminaDeck publisher key. This file is what the
 * companion fetches + verifies at install time.
 */

import type { PluginManifest } from '../plugin-manifest';

export const spotifyPluginManifest: PluginManifest = {
  schemaVersion: 1,
  id: 'com.luminadeck.spotify',
  name: 'Spotify',
  version: '0.1.0',
  author: 'LuminaDeck',
  homepage: 'https://luminaaio.com/luminadeck/plugins/spotify',
  description: 'Control Spotify playback — play/pause, skip, like track, volume, and playlist jumps.',
  icon: 'music-note',
  capabilities: ['network.http', 'system.notifications'],
  binaries: {
    'x86_64-pc-windows-msvc': 'bin/luminadeck-plugin-spotify.exe',
    'aarch64-apple-darwin': 'bin/luminadeck-plugin-spotify-aarch64',
    'x86_64-apple-darwin': 'bin/luminadeck-plugin-spotify-x86_64',
  },
  tiles: [
    { id: 'play-pause', label: 'Play/Pause', icon: 'play-pause', defaultColor: '#1DB954' },
    { id: 'next',       label: 'Next', icon: 'skip-forward', defaultColor: '#1DB954' },
    { id: 'prev',       label: 'Previous', icon: 'skip-back', defaultColor: '#1DB954' },
    { id: 'like',       label: 'Like', icon: 'heart', defaultColor: '#1DB954' },
    { id: 'volume-up',  label: 'Vol +', icon: 'volume-up', defaultColor: '#1DB954' },
    { id: 'volume-down', label: 'Vol -', icon: 'volume-down', defaultColor: '#1DB954' },
    {
      id: 'playlist',
      label: 'Playlist',
      icon: 'music-folder',
      defaultColor: '#1DB954',
      description: 'Jump to a specific Spotify playlist.',
      params: {
        playlistUri: { type: 'string', required: true, description: 'spotify:playlist:...' },
      },
    },
  ],
};
