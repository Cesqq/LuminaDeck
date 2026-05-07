/**
 * Plugin manifest schema — Phase B7 curated official plugin gallery.
 *
 * Plugins ship as sidecar processes spawned by the companion via
 * `tauri-plugin-shell`. Each plugin directory contains a `manifest.json`
 * conforming to this schema plus its binary (or binaries, for multi-arch
 * shipments). The runtime (`apps/companion/src-tauri/src/plugins/
 * sdk_runtime.rs`) reads the manifest, verifies signatures, spawns the
 * sidecar under OS-level sandboxing, and brokers stdio JSON-RPC.
 *
 * This file defines the shape; the actual plugin SDK ships as
 * `packages/plugin-sdk/` in a follow-up, and is deferred in the v2.0
 * scope (we ship 5–10 first-party plugins; third-party sideloading lives
 * in v2.1 after Stripe Connect + content moderation gates are cleared).
 */

import { z } from 'zod';

export const PLUGIN_MANIFEST_VERSION = 1;

/**
 * Capability strings the plugin declares. These are coarse — the runtime
 * maps them to OS-level restrictions (Windows Job Object + AppContainer,
 * macOS sandbox-exec profiles). A plugin asking for anything not in this
 * allowlist is rejected by the runtime at load time.
 */
export const PLUGIN_CAPABILITIES = [
  'network.http',
  'network.websocket',
  'filesystem.read',
  'filesystem.write',
  'audio.play',
  'clipboard.read',
  'clipboard.write',
  'keyboard.sendinput',
  'window.focus',
  'system.notifications',
] as const;

export type PluginCapability = (typeof PLUGIN_CAPABILITIES)[number];

export const pluginCapabilitySchema = z.enum(PLUGIN_CAPABILITIES);

/**
 * One tile catalogue entry the plugin surfaces. When the user picks a
 * tile in Studio's palette, the companion dispatches an `execute` via
 * the plugin's stdio runtime.
 */
export const pluginTileSchema = z.object({
  id: z.string().min(1).max(64),
  label: z.string().min(1).max(32),
  description: z.string().max(140).optional(),
  icon: z.string().optional(),
  defaultColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  /**
   * Optional JSON-schema-style params the tile accepts (e.g. a URL field
   * for a "Play playlist" tile). Kept loose — the Plugin SDK authors
   * typed accessors from this at build-time on the plugin side.
   */
  params: z.record(z.unknown()).optional(),
});

export const pluginSignatureSchema = z.object({
  /** Ed25519 public key of the publisher, hex-encoded. */
  publisherPublicKey: z.string().regex(/^[0-9a-fA-F]+$/).length(64),
  /** Detached signature over the manifest-without-signature-field bytes. */
  signature: z.string().regex(/^[0-9a-fA-F]+$/).length(128),
});

export const pluginManifestSchema = z.object({
  schemaVersion: z.literal(PLUGIN_MANIFEST_VERSION),
  id: z.string().regex(/^[a-z0-9.\-_]+$/i).min(3).max(64),
  name: z.string().min(1).max(48),
  version: z.string().regex(/^\d+\.\d+\.\d+$/),
  author: z.string().min(1).max(96),
  homepage: z.string().url().optional(),
  description: z.string().min(1).max(280),

  /** SF-symbol-ish identifier; Studio maps to its own icon pack. */
  icon: z.string().max(64).optional(),

  /** Capability list — OS-enforced, not just declarative. */
  capabilities: z.array(pluginCapabilitySchema).min(0).max(PLUGIN_CAPABILITIES.length),

  /** Binary reference relative to the manifest dir, per target triple. */
  binaries: z.object({
    'x86_64-pc-windows-msvc': z.string().optional(),
    'aarch64-apple-darwin': z.string().optional(),
    'x86_64-apple-darwin': z.string().optional(),
    'x86_64-unknown-linux-gnu': z.string().optional(),
  }),

  tiles: z.array(pluginTileSchema).min(1).max(64),

  /** Ed25519 signature from the publisher — verified before sidecar spawn. */
  signature: pluginSignatureSchema.optional(),
});

export type PluginManifest = z.infer<typeof pluginManifestSchema>;
export type PluginTile = z.infer<typeof pluginTileSchema>;

export function validatePluginManifest(raw: unknown): { success: true; data: PluginManifest } | { success: false; error: string } {
  const result = pluginManifestSchema.safeParse(raw);
  if (result.success) return { success: true, data: result.data };
  return {
    success: false,
    error: result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '),
  };
}
