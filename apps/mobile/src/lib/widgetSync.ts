/**
 * Widget sync — Phase B1.
 *
 * Serialises up to six pinned LuminaDeck tiles into the iOS App Group
 * UserDefaults container so the WidgetKit extension (source in
 * `apps/mobile/targets/widget/`) can read them. The shape here MUST stay
 * in lock-step with `PinnedTile` in `LuminaDeckWidget.swift`.
 *
 * This module is deliberately framework-agnostic: it builds the payload
 * and hands it to a native bridge. On PC we can build + typecheck the
 * serialisation logic without a device. The native bridge itself (writing
 * into the App Group UserDefaults) ships as a tiny Expo module in a Mac
 * follow-up — either `react-native-shared-group-preferences` or a hand-
 * rolled TurboModule once `expo-apple-targets` is wired.
 */

import type { ButtonConfig, ProfileConfig } from '@luminadeck/shared';
import { NativeModules, Platform } from 'react-native';

export const PINNED_TILE_SLOT_COUNT = 6;

export interface PinnedTile {
  /** Unique slot key (e.g. `slot-0` .. `slot-5`) — the widget reads one per tile. */
  slot: string;
  buttonId: string;
  label: string;
  /** SF Symbol name shown in the Control Center pill. */
  systemImage: string;
  /** Hex color, e.g. "#FF6B35". Widget uses this for the tile accent. */
  accentHex: string;
  /**
   * Pre-serialized action JSON — the widget POSTs this verbatim as the
   * `action` field of the `/intent-execute` body. Stored as a string so
   * the Swift PinnedTile struct stays simple `Codable` (no polymorphic
   * Action enum mirror). The companion is stateless on this path. v1.4+.
   */
  actionJSON: string;
}

/**
 * Heuristic mapping from our internal icon names to SF Symbols so the
 * widget can render with system-native look. Falls back to a generic grid
 * symbol when no mapping exists — the user can override by setting the
 * tile's customImage, but the widget only reads SF Symbols for now to
 * avoid shipping bitmap data through the App Group.
 */
const ICON_TO_SF_SYMBOL: Record<string, string> = {
  'play-pause': 'playpause.fill',
  'record': 'record.circle.fill',
  'loop': 'arrow.triangle.2.circlepath',
  'metronome': 'metronome.fill',
  'tap': 'hand.tap.fill',
  'plus': 'plus',
  'undo': 'arrow.uturn.backward',
  'redo': 'arrow.uturn.forward',
  'save': 'square.and.arrow.down',
  'grid': 'square.grid.2x2.fill',
  'expand': 'arrow.up.left.and.arrow.down.right',
  'scissors': 'scissors',
  'trash': 'trash',
  'bracket-left': 'arrow.left.to.line',
  'bracket-right': 'arrow.right.to.line',
  'skip-back': 'backward.fill',
  'skip-forward': 'forward.fill',
  'folder': 'folder.fill',
  'keyboard': 'keyboard',
  'sliders': 'slider.horizontal.3',
  'mic': 'mic.fill',
  'camera': 'video.fill',
  'video': 'video.fill',
  'broadcast': 'dot.radiowaves.left.and.right',
  'rewind': 'gobackward',
  'screenshot': 'camera.viewfinder',
  'volume-mute': 'speaker.slash.fill',
  'copy': 'doc.on.doc',
  'clock': 'clock',
  'coffee': 'cup.and.saucer.fill',
  'flag': 'flag.fill',
  'shirt': 'tshirt.fill',
  'smile': 'face.smiling',
  'sparkles': 'sparkles',
  'refresh': 'arrow.clockwise',
  'gear': 'gearshape.fill',
  'image': 'photo.fill',
  'arrow-up': 'arrow.up',
};

function mapIcon(icon?: string): string {
  if (!icon) return 'square.grid.2x2';
  return ICON_TO_SF_SYMBOL[icon] ?? 'square.grid.2x2';
}

/**
 * Build the `{ slot: PinnedTile }` map the widget will decode. The caller
 * chooses which buttons to pin; we reserve the slot-id format so a later
 * "Smart pin" feature (B6 × B1) can fill slots from predictor output.
 */
export function buildPinnedTilesPayload(buttons: ReadonlyArray<ButtonConfig>): Record<string, PinnedTile> {
  const payload: Record<string, PinnedTile> = {};
  const top = buttons.slice(0, PINNED_TILE_SLOT_COUNT).filter((b) => b.action != null);
  for (let i = 0; i < top.length; i++) {
    const b = top[i]!;
    const slot = `slot-${i}`;
    payload[slot] = {
      slot,
      buttonId: b.id,
      label: b.label ?? 'Tile',
      systemImage: mapIcon(b.icon),
      accentHex: b.color ?? '#FF6B35',
      actionJSON: JSON.stringify(b.action),
    };
  }
  return payload;
}

/**
 * Suggest six tiles to pin from a profile. For now picks the first six
 * buttons in page order. A later iteration will take an explicit pin-map
 * persisted in AppSettings + optionally fall back to predictor-top-six.
 */
export function suggestPinnedTiles(profile: ProfileConfig | null): ButtonConfig[] {
  if (!profile) return [];
  const flat: ButtonConfig[] = [];
  for (const page of profile.pages) {
    for (const b of page.buttons) {
      if (b.action) flat.push(b);
      if (flat.length >= PINNED_TILE_SLOT_COUNT) break;
    }
    if (flat.length >= PINNED_TILE_SLOT_COUNT) break;
  }
  return flat;
}

/**
 * Push the payload into the App Group container. Routes through the
 * Swift `AppGroupBridge` native module (source in
 * `apps/mobile/targets/shared/AppGroupBridge.{swift,m}`), which is added
 * to the main app target by `scripts/ios-apply-native-targets.rb`.
 *
 * Silently no-ops on Android (no widget target) and if the bridge isn't
 * loaded (dev builds before the Ruby patch has run). Errors are swallowed
 * so a missing App Group registration never blocks tile presses in the
 * main app — a broken widget sync is a degraded experience, not a crash.
 */
const APP_GROUP_ID = 'group.com.luminadeck.shared';
const PINNED_TILES_KEY = 'luminadeck.pinnedTiles.v1';
const IS_PRO_KEY = 'luminadeck.isPro.v1';

export async function writePinnedTiles(payload: Record<string, PinnedTile>): Promise<void> {
  if (Platform.OS !== 'ios') return;
  const bridge = NativeModules.AppGroupBridge as
    | { write: (groupId: string, key: string, json: string) => Promise<void> }
    | undefined;
  if (!bridge) return;
  try {
    await bridge.write(APP_GROUP_ID, PINNED_TILES_KEY, JSON.stringify(payload));
  } catch {
    // Degrade silently — see function docblock.
  }
}

/** Erase the widget payload, e.g. when the user unpins all tiles or toggles the widget off. */
export async function clearPinnedTiles(): Promise<void> {
  if (Platform.OS !== 'ios') return;
  const bridge = NativeModules.AppGroupBridge as
    | { remove: (groupId: string, key: string) => Promise<void> }
    | undefined;
  if (!bridge) return;
  try {
    await bridge.remove(APP_GROUP_ID, PINNED_TILES_KEY);
  } catch {
    // Degrade silently.
  }
}

/**
 * Push the user's Pro entitlement into the App Group so the widget can
 * decide how many tiles to surface. Encoded as a tiny JSON envelope
 * because `AppGroupBridge.write` only takes strings — the widget reads
 * the boolean back out of `UserDefaults.bool(forKey:)`, which treats
 * any non-zero numeric value as true. We write `"1"` / `"0"` accordingly.
 *
 * Call after every successful IAP receipt validation and on app launch
 * (the launch call covers existing Pro users on a freshly installed
 * widget that hasn't received an IAP push yet).
 */
export async function writeIsPro(isPro: boolean): Promise<void> {
  if (Platform.OS !== 'ios') return;
  const bridge = NativeModules.AppGroupBridge as
    | { write: (groupId: string, key: string, json: string) => Promise<void> }
    | undefined;
  if (!bridge) return;
  try {
    // The Swift side reads via `UserDefaults.bool(forKey:)` which expects
    // a Bool-type value. We can't write a raw bool through the JSON
    // bridge — but `"1"` decodes back as true via the same UserDefaults
    // semantics on iOS. Keep the contract obvious by also storing a
    // sibling `isProBool` we may swap to in a future bridge revision.
    await bridge.write(APP_GROUP_ID, IS_PRO_KEY, isPro ? '1' : '0');
  } catch {
    // ignore
  }
}
