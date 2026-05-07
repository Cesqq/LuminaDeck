/**
 * Apple Watch bridge (Phase B3) — TS side of the WCSession plumbing.
 *
 * Builds the 6-tile payload and hands it to a native module that calls
 * `WCSession.transferUserInfo(...)`. The native module is not yet wired
 * on PC builds — it lands alongside the Xcode watchOS target on the Mac
 * prebuild pass. Until then `pushWatchTiles` is a no-op so the RN
 * typecheck + Android builds still pass and the serialisation logic is
 * ready the instant the bridge plugs in.
 *
 * Payload shape mirrors `WatchTile` in
 * `apps/mobile/targets/watch/ContentView.swift`. Keep them in sync.
 */

import type { ButtonConfig, ProfileConfig } from '@luminadeck/shared';
import { NativeEventEmitter, NativeModules, Platform } from 'react-native';
import { PINNED_TILE_SLOT_COUNT, suggestPinnedTiles, type PinnedTile } from './widgetSync';

export const WATCH_TILE_SLOT_COUNT = 6;

export interface WatchTile extends PinnedTile {
  // Identical shape to the widget's PinnedTile. Keeping a distinct type
  // alias so future divergence (e.g. watchOS-specific fields) has a
  // natural home without touching widget code.
}

/**
 * Select up to 6 tiles from a profile to surface on the Watch. For now
 * we reuse the widget pin logic (first-six-with-actions); a follow-up
 * can take an explicit Watch mini-page once that UI ships.
 */
export function suggestWatchTiles(profile: ProfileConfig | null): ButtonConfig[] {
  // The plan's cap is 6, matching widget today. If the two ever need to
  // diverge, split `suggestPinnedTiles` into a shared helper.
  const _cap: number = Math.min(PINNED_TILE_SLOT_COUNT, WATCH_TILE_SLOT_COUNT);
  return suggestPinnedTiles(profile);
}

/**
 * Serialise the Watch payload. Kept identical to the widget serialisation
 * so one renderer on the Watch can re-use SF Symbol mapping without a
 * Watch-specific lookup table.
 */
export function buildWatchTilesPayload(buttons: ReadonlyArray<ButtonConfig>): WatchTile[] {
  // Reuse widgetSync's payload builder but present it as an array because
  // WCSession prefers plist-serialisable ordered structures.
  const { buildPinnedTilesPayload } = require('./widgetSync') as typeof import('./widgetSync');
  const map = buildPinnedTilesPayload(buttons);
  return Object.values(map);
}

/**
 * Push the payload to the Watch. Placeholder — see module-level docs.
 *
 * The native side hasn't shipped a `transferWatchTiles` selector yet
 * because the watchOS target is wired by the Mac archive script and the
 * tiles are also kept in App Group UserDefaults (the Watch reads them
 * directly via WCSession `didReceiveUserInfo`). Once the bridge selector
 * lands this becomes a one-liner.
 */
export async function pushWatchTiles(_tiles: WatchTile[]): Promise<void> {
  return;
}

// --- Watch → phone event subscriptions (v1.4 phone-side relay) ---

interface WatchEventEmitter {
  addListener: (event: string, listener: (payload: any) => void) => { remove: () => void };
}

async function getEmitter(): Promise<WatchEventEmitter | null> {
  if (Platform.OS !== 'ios') return null;
  const native = NativeModules.WatchSessionBridge;
  if (!native) return null;
  return new NativeEventEmitter(native) as unknown as WatchEventEmitter;
}

/**
 * Subscribe to button-tap messages relayed from the Watch. The native
 * side (`WatchSessionBridge.swift`) emits `luminadeck.watch.tap` with
 * `{ buttonId }` when WCSession delivers either a live message or queued
 * userInfo. The caller looks up the action by buttonId in the active
 * profile and dispatches it via the existing WS execute path.
 *
 * Returns an unsubscribe function.
 */
export function subscribeWatchTaps(onTap: (buttonId: string) => void): () => void {
  let sub: { remove: () => void } | null = null;
  void getEmitter().then((emitter) => {
    if (!emitter) return;
    sub = emitter.addListener('luminadeck.watch.tap', (payload: { buttonId?: string }) => {
      if (payload?.buttonId) onTap(payload.buttonId);
    });
  });
  return () => sub?.remove();
}

/**
 * Subscribe to relative mouse-move events from the Watch trackpad face.
 */
export function subscribeWatchMouseMove(
  onMove: (delta: { dx: number; dy: number }) => void,
): () => void {
  let sub: { remove: () => void } | null = null;
  void getEmitter().then((emitter) => {
    if (!emitter) return;
    sub = emitter.addListener('luminadeck.watch.mouseMove', (payload: { dx?: number; dy?: number }) => {
      const dx = Number(payload?.dx ?? 0);
      const dy = Number(payload?.dy ?? 0);
      if (Number.isFinite(dx) && Number.isFinite(dy)) onMove({ dx, dy });
    });
  });
  return () => sub?.remove();
}

/** Subscribe to mouse-click events from the Watch trackpad face. */
export function subscribeWatchMouseClick(
  onClick: (button: 'left' | 'right' | 'middle') => void,
): () => void {
  let sub: { remove: () => void } | null = null;
  void getEmitter().then((emitter) => {
    if (!emitter) return;
    sub = emitter.addListener('luminadeck.watch.mouseClick', (payload: { button?: string }) => {
      const b = payload?.button;
      if (b === 'left' || b === 'right' || b === 'middle') onClick(b);
    });
  });
  return () => sub?.remove();
}

/** Subscribe to scroll-wheel events from the Watch crown. */
export function subscribeWatchScroll(onScroll: (ticks: number) => void): () => void {
  let sub: { remove: () => void } | null = null;
  void getEmitter().then((emitter) => {
    if (!emitter) return;
    sub = emitter.addListener('luminadeck.watch.scroll', (payload: { ticks?: number }) => {
      const t = Number(payload?.ticks ?? 0);
      if (Number.isFinite(t) && t !== 0) onScroll(t);
    });
  });
  return () => sub?.remove();
}

/**
 * Subscribe to text-input events from the Watch Scribble / keyboard /
 * dictation surface. The dispatcher should send each chunk as a
 * `text_input` action.
 */
export function subscribeWatchTextInput(onText: (text: string) => void): () => void {
  let sub: { remove: () => void } | null = null;
  void getEmitter().then((emitter) => {
    if (!emitter) return;
    sub = emitter.addListener('luminadeck.watch.textInput', (payload: { text?: string }) => {
      if (typeof payload?.text === 'string' && payload.text.length > 0) onText(payload.text);
    });
  });
  return () => sub?.remove();
}
