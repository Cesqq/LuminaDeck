/**
 * Zoom first-party plugin manifest (Phase B7).
 *
 * Controls the local Zoom client via global hotkey emulation; does not
 * require Zoom SDK credentials. Capabilities reflect that: `keyboard.
 * sendinput` for the hotkey, `window.focus` to bring Zoom forward before
 * sending the hotkey (Zoom ignores keys when backgrounded).
 */

import type { PluginManifest } from '../plugin-manifest';

export const zoomPluginManifest: PluginManifest = {
  schemaVersion: 1,
  id: 'com.luminadeck.zoom',
  name: 'Zoom',
  version: '0.1.0',
  author: 'LuminaDeck',
  homepage: 'https://luminaaio.com/luminadeck/plugins/zoom',
  description: 'Mute, toggle camera, raise hand, and leave Zoom meetings via its local hotkeys.',
  icon: 'video',
  capabilities: ['keyboard.sendinput', 'window.focus'],
  binaries: {
    'x86_64-pc-windows-msvc': 'bin/luminadeck-plugin-zoom.exe',
    'aarch64-apple-darwin': 'bin/luminadeck-plugin-zoom-aarch64',
    'x86_64-apple-darwin': 'bin/luminadeck-plugin-zoom-x86_64',
  },
  tiles: [
    { id: 'mute',       label: 'Mute', icon: 'mic', defaultColor: '#2D8CFF' },
    { id: 'video',      label: 'Camera', icon: 'video', defaultColor: '#2D8CFF' },
    { id: 'raise-hand', label: 'Raise Hand', icon: 'hand-raised', defaultColor: '#2D8CFF' },
    { id: 'leave',      label: 'Leave', icon: 'door-exit', defaultColor: '#D92D20' },
    { id: 'share',      label: 'Share Screen', icon: 'monitor', defaultColor: '#2D8CFF' },
    { id: 'chat',       label: 'Chat', icon: 'chat-bubble', defaultColor: '#2D8CFF' },
  ],
};
