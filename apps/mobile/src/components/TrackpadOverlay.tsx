import React, { useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  type ViewStyle,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import type { ThemeColors } from '@luminadeck/shared';
import type { LuminaDeckClient } from '../lib/websocket';

/**
 * Full-screen trackpad overlay (v1.2.0). Tapping a `trackpad` tile opens
 * this; gestures stream `mouse_*` WebSocket messages outside the standard
 * `execute` envelope (high-frequency, fire-and-forget — see protocol.ts
 * comment block above MouseMoveMessage).
 *
 * Gesture grammar:
 *   - 1-finger drag         → cursor move
 *   - tap                   → left click
 *   - 2-finger tap          → right click
 *   - 2-finger vertical pan → vertical scroll
 *   - long-press + drag     → hold-and-drag (left button held during move)
 *
 * Throttling: move events accumulate deltas and flush at ~60Hz so we don't
 * blow the 240/sec mouse rate limit on the companion side. Click/scroll/drag
 * are not throttled — they're naturally infrequent.
 */

interface TrackpadOverlayProps {
  visible: boolean;
  colors: ThemeColors;
  client: LuminaDeckClient;
  sensitivity?: number;
  naturalScroll?: boolean;
  /** v1.2.1: per-action haptic toggle (defaults to on). */
  haptics?: boolean;
  /** v1.2.1: 'classic' applies an OS-trackpad accel curve; 'linear' = raw delta. */
  accelCurve?: 'linear' | 'classic';
  /** v1.2.1: clamp cursor to primary monitor on the companion side. */
  lockToPrimary?: boolean;
  onClose: () => void;
}

/**
 * Classic mouse acceleration curve. Small flicks (|d| < 1) pass through
 * 1:1 so pixel-precise targeting stays accurate; medium and large strokes
 * amplify quadratically up to a 3x ceiling. Tuned by hand to feel close to
 * Windows Mouse Properties → "Enhance pointer precision" at default speed.
 */
function applyAccel(d: number, sensitivity: number): number {
  const raw = d * sensitivity;
  const abs = Math.abs(raw);
  if (abs < 1) return raw;
  // 1 + 0.18 * (abs - 1) capped at 3x → smooth ramp.
  const factor = Math.min(3, 1 + 0.18 * (abs - 1));
  return raw * factor;
}

const MOVE_FLUSH_INTERVAL_MS = 16; // ~60Hz
const SCROLL_FLUSH_INTERVAL_MS = 32; // ~30Hz scroll is enough

export function TrackpadOverlay({
  visible,
  colors,
  client,
  sensitivity = 1.0,
  naturalScroll = false,
  haptics = true,
  accelCurve = 'classic',
  lockToPrimary = false,
  onClose,
}: TrackpadOverlayProps) {
  // Accumulators flushed by setInterval timers below. Refs (not state) so
  // gesture worklets can mutate them without re-rendering.
  const moveAccumRef = useRef({ dx: 0, dy: 0 });
  const scrollAccumRef = useRef({ dy: 0 });
  const moveTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const scrollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Send helpers — defined as plain JS so worklets can call them via runOnJS.
  const sendMove = useCallback(
    (dx: number, dy: number) => {
      // v1.2.1: apply accel curve before sensitivity so the multiplier acts
      // as a final scaling pass — keeps the curve shape consistent across
      // sensitivity settings.
      if (accelCurve === 'classic') {
        moveAccumRef.current.dx += applyAccel(dx, sensitivity);
        moveAccumRef.current.dy += applyAccel(dy, sensitivity);
      } else {
        moveAccumRef.current.dx += dx * sensitivity;
        moveAccumRef.current.dy += dy * sensitivity;
      }
    },
    [sensitivity, accelCurve],
  );

  const sendClick = useCallback(
    (button: 'left' | 'right' | 'middle', state: 'click' | 'down' | 'up') => {
      client.send({ type: 'mouse_click', button, state });
      if (haptics) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      }
    },
    [client, haptics],
  );

  const sendScrollAccum = useCallback(
    (dy: number) => {
      const sign = naturalScroll ? -1 : 1;
      scrollAccumRef.current.dy += dy * sign;
    },
    [naturalScroll],
  );

  const sendDrag = useCallback(
    (phase: 'start' | 'end') => {
      client.send({ type: 'mouse_drag', phase });
      if (haptics) {
        Haptics.impactAsync(
          phase === 'start' ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light,
        ).catch(() => {});
      }
    },
    [client, haptics],
  );

  // ── Flush timers — start on visible, stop on hidden ─────────────────
  React.useEffect(() => {
    if (!visible) return;
    moveTimerRef.current = setInterval(() => {
      const { dx, dy } = moveAccumRef.current;
      if (dx !== 0 || dy !== 0) {
        // Round to int and clamp to protocol max
        const sendDx = Math.max(-200, Math.min(200, Math.round(dx)));
        const sendDy = Math.max(-200, Math.min(200, Math.round(dy)));
        // v1.2.1: attach lock flag stateless so a packet drop doesn't leave
        // the cursor permanently confined.
        client.send({
          type: 'mouse_move',
          dx: sendDx,
          dy: sendDy,
          ...(lockToPrimary ? { lock: true } : {}),
        });
        moveAccumRef.current = { dx: dx - sendDx, dy: dy - sendDy };
      }
    }, MOVE_FLUSH_INTERVAL_MS);

    scrollTimerRef.current = setInterval(() => {
      const { dy } = scrollAccumRef.current;
      if (dy !== 0) {
        const sendDy = Math.max(-200, Math.min(200, Math.round(dy)));
        client.send({ type: 'mouse_scroll', dy: sendDy });
        scrollAccumRef.current = { dy: dy - sendDy };
      }
    }, SCROLL_FLUSH_INTERVAL_MS);

    return () => {
      if (moveTimerRef.current) clearInterval(moveTimerRef.current);
      if (scrollTimerRef.current) clearInterval(scrollTimerRef.current);
      moveTimerRef.current = null;
      scrollTimerRef.current = null;
      moveAccumRef.current = { dx: 0, dy: 0 };
      scrollAccumRef.current = { dy: 0 };
    };
  }, [visible, client]);

  // ── Gestures ────────────────────────────────────────────────────────
  const gestures = useMemo(() => {
    // 1-finger pan = cursor move. We use `onChange` to fire deltas as the
    // finger moves rather than `onUpdate` because deltas come pre-computed.
    const movePan = Gesture.Pan()
      .minPointers(1)
      .maxPointers(1)
      .averageTouches(true)
      .onChange((e) => {
        'worklet';
        runOnJS(sendMove)(e.changeX, e.changeY);
      });

    // 2-finger pan = scroll. Only flushes vertical because phones rarely
    // need horizontal scroll on a trackpad. Horizontal stays at zero so the
    // companion clamp is a no-op.
    const scrollPan = Gesture.Pan()
      .minPointers(2)
      .maxPointers(2)
      .onChange((e) => {
        'worklet';
        runOnJS(sendScrollAccum)(e.changeY);
      });

    // Single tap = left click. Two-finger tap = right click. We use Manual
    // gesture for the two-finger case because Gesture.Tap doesn't natively
    // distinguish finger count without Manual handling.
    const leftClick = Gesture.Tap()
      .maxDuration(250)
      .numberOfTaps(1)
      .onEnd((_, success) => {
        'worklet';
        if (success) runOnJS(sendClick)('left', 'click');
      });

    // Two-finger tap → right click. Implemented as a Pan with maxDistance
    // small so it fires only on a stationary 2-finger tap, then we send.
    // (Gesture.Tap supports numberOfPointers in RNGH 2.x; falling back to
    // a Pan-with-max-distance approach makes us version-tolerant.)
    const rightClick = Gesture.Tap()
      .numberOfTaps(1)
      .minPointers(2)
      .maxDuration(250)
      .onEnd((_, success) => {
        'worklet';
        if (success) runOnJS(sendClick)('right', 'click');
      });

    // Long-press + drag = hold-and-drag. Long-press fires `start`; the
    // movePan that the user keeps moving handles the cursor; on release of
    // the long-press's underlying touch we fire `end`. RNGH long-press is
    // emitted once on threshold, so we model end via onTouchesUp on a
    // sibling Manual gesture.
    const longDragStart = Gesture.LongPress()
      .minDuration(450)
      .onStart(() => {
        'worklet';
        runOnJS(sendDrag)('start');
      });

    // The end-of-drag fires when ALL fingers leave during a drag-active
    // phase. Simplest robust approach: a Manual gesture that watches for
    // touchesUp count==0 after drag was started. Tracked via a ref boolean.
    const longDragEndRef = { value: false };
    const longDragEnd = Gesture.Manual()
      .onTouchesUp((e, manager) => {
        'worklet';
        // If the touches array is now empty AND we previously fired start,
        // the user has lifted — end the drag.
        if (e.numberOfTouches === 0 && longDragEndRef.value) {
          longDragEndRef.value = false;
          runOnJS(sendDrag)('end');
          manager.end();
        }
      });

    // Wire the longDragStart → longDragEnd flag through .onStart hop.
    longDragStart.onStart(() => {
      'worklet';
      longDragEndRef.value = true;
    });

    // Compose: scroll wins over move when 2 fingers, taps run alongside.
    return Gesture.Race(
      Gesture.Simultaneous(longDragStart, longDragEnd, movePan),
      scrollPan,
      rightClick,
      leftClick,
    );
  }, [sendMove, sendScrollAccum, sendClick, sendDrag]);

  const padStyle: ViewStyle = {
    flex: 1,
    backgroundColor: colors.buttonBackground,
    borderRadius: 16,
    margin: 16,
    borderWidth: 1,
    borderColor: colors.buttonBorder,
    justifyContent: 'center',
    alignItems: 'center',
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="overFullScreen"
      transparent={false}
      onRequestClose={onClose}
    >
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {/* Header bar */}
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.text }]}>Trackpad</Text>
          <TouchableOpacity
            onPress={onClose}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            accessibilityLabel="Close trackpad"
          >
            <Text style={[styles.close, { color: colors.accent }]}>Done</Text>
          </TouchableOpacity>
        </View>

        {/* Pad surface */}
        <GestureDetector gesture={gestures}>
          <View style={padStyle}>
            <Text style={[styles.hint, { color: colors.textSecondary }]}>
              drag = move {'•'} tap = click {'•'} 2-finger tap = right click {'•'} 2-finger drag = scroll
            </Text>
          </View>
        </GestureDetector>

        {/* Hardware buttons row */}
        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={[styles.hwButton, { backgroundColor: colors.buttonBackground, borderColor: colors.buttonBorder }]}
            onPress={() => sendClick('left', 'click')}
            accessibilityLabel="Left click"
          >
            <Text style={[styles.hwButtonText, { color: colors.text }]}>L</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.hwButton, { backgroundColor: colors.buttonBackground, borderColor: colors.buttonBorder }]}
            onPress={() => sendClick('middle', 'click')}
            accessibilityLabel="Middle click"
          >
            <Text style={[styles.hwButtonText, { color: colors.text }]}>M</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.hwButton, { backgroundColor: colors.buttonBackground, borderColor: colors.buttonBorder }]}
            onPress={() => sendClick('right', 'click')}
            accessibilityLabel="Right click"
          >
            <Text style={[styles.hwButtonText, { color: colors.text }]}>R</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
  },
  title: { fontSize: 18, fontWeight: '600' },
  close: { fontSize: 16, fontWeight: '600' },
  hint: { fontSize: 12, paddingHorizontal: 24, textAlign: 'center', opacity: 0.7 },
  buttonRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingBottom: 24,
    gap: 12,
  },
  hwButton: {
    flex: 1,
    height: 56,
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  hwButtonText: { fontSize: 20, fontWeight: '600' },
});
