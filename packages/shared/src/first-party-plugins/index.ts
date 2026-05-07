/**
 * Registry of first-party plugin manifests shipped with v2.0.
 *
 * The companion presents these in Studio's Plugin Gallery; mobile shows
 * only INSTALLED plugins (no browse/buy UI there, per the v2 plan security
 * + business judge revisions — keeps us clear of Apple's reader-app rule).
 *
 * v2.0 ships 5–10 manifests authored here. v2.1 opens up third-party
 * submission after Stripe Connect + content moderation land.
 */

import type { PluginManifest } from '../plugin-manifest';
import { spotifyPluginManifest } from './spotify';
import { zoomPluginManifest } from './zoom';

export const FIRST_PARTY_PLUGIN_MANIFESTS: readonly PluginManifest[] = [
  spotifyPluginManifest,
  zoomPluginManifest,
  // TODO(v2.0 ship list): Philips Hue, Microsoft Teams, Notion, Linear,
  //   GitHub Actions, Soundboard. Each adds a manifest module here.
];
