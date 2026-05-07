/**
 * Shared clipboard sync — phone side. v1.4+.
 *
 * Polls the iOS / Android system clipboard at a low interval (every 1 s
 * while the app is foreground) and publishes fresh strings as
 * `clipboard_set` messages over the existing WS. On inbound
 * `clipboard_set` from the PC, applies the value to the phone clipboard
 * via `expo-clipboard`.
 *
 * Cycle-break: each side ignores inbound text that matches its current
 * clipboard, so phone→PC→phone never echoes.
 *
 * Privacy: gated on a user-controlled toggle stored in AsyncStorage
 * (`@luminadeck/clipboard_sync_enabled`). Default: off. The Settings
 * screen exposes the toggle.
 */

import * as Clipboard from 'expo-clipboard';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { LuminaDeckClient } from './websocket';

const ENABLED_KEY = '@luminadeck/clipboard_sync_enabled';
const POLL_INTERVAL_MS = 1000;

export async function isClipboardSyncEnabled(): Promise<boolean> {
  try {
    const v = await AsyncStorage.getItem(ENABLED_KEY);
    return v === '1';
  } catch {
    return false;
  }
}

export async function setClipboardSyncEnabled(enabled: boolean): Promise<void> {
  try {
    await AsyncStorage.setItem(ENABLED_KEY, enabled ? '1' : '0');
  } catch {
    // Persist failure isn't worth surfacing — UI updates separately.
  }
}

interface SubscriptionHandle {
  stop: () => void;
}

/**
 * Wire clipboard sync into a connected WS client. Returns a stop()
 * function — call it on unmount or when the toggle flips off.
 *
 * The implementation is fail-closed: any error reading/writing the
 * clipboard or sending the message is swallowed so the WS path stays
 * alive. Clipboard sync is a nicety, not load-bearing.
 */
export function startClipboardSync(client: LuminaDeckClient): SubscriptionHandle {
  let lastSeenLocal: string | null = null;
  let lastAppliedFromRemote: string | null = null;
  let stopped = false;

  // Inbound — set phone clipboard when companion publishes a fresh value.
  const unsubMessage = client.onMessage(async (msg) => {
    if (stopped) return;
    if (msg.type !== 'clipboard_set') return;
    if (msg.source === 'phone') return; // ignore our own echoes
    const text = msg.text;
    if (typeof text !== 'string' || text.length === 0) return;
    try {
      const current = await Clipboard.getStringAsync();
      if (current === text) {
        // Already matches — don't disturb cursor / clipboard listeners.
        return;
      }
      await Clipboard.setStringAsync(text);
      lastAppliedFromRemote = text;
      // Update the "seen" reference so the next poll doesn't re-publish
      // what we just received (cycle break).
      lastSeenLocal = text;
    } catch {
      // ignore
    }
  });

  // Outbound — poll local clipboard and publish on change.
  const interval = setInterval(async () => {
    if (stopped) return;
    try {
      const current = await Clipboard.getStringAsync();
      if (typeof current !== 'string' || current.length === 0) return;
      if (current === lastSeenLocal) return;
      if (current === lastAppliedFromRemote) {
        // Edge case: we just applied this from the PC — don't bounce it back.
        lastSeenLocal = current;
        return;
      }
      lastSeenLocal = current;
      client.send({ type: 'clipboard_set', text: current, source: 'phone' });
    } catch {
      // ignore — clipboard read can fail on cold-start or while another
      // app holds it; we'll catch up on the next tick.
    }
  }, POLL_INTERVAL_MS);

  return {
    stop: () => {
      stopped = true;
      clearInterval(interval);
      unsubMessage();
    },
  };
}
