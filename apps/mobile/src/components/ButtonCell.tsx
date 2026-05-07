import React, { useRef, useCallback, useMemo } from 'react';
import {
  Pressable,
  Text,
  View,
  Image,
  Animated,
  StyleSheet,
  type ViewStyle,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import type { ButtonConfig, ThemeColors } from '@luminadeck/shared';
import { IconView } from './IconView';
import { tileRadiusFor, useTheme } from '../contexts/ThemeContext';

/**
 * Which non-tap gesture fired (Phase B4). The tap path still goes through
 * `onPress`; long-press still goes through `onLongPress` (parent decides
 * whether to fire the long-press gesture or fall through to the editor).
 */
export type CellGesture = 'swipeUp' | 'swipeDown' | 'pinchIn' | 'pinchOut';

interface ButtonCellProps {
  button: ButtonConfig | null;
  size: number;
  colors: ThemeColors;
  onPress?: () => void;
  onLongPress?: () => void;
  onGesture?: (gesture: CellGesture) => void;
}

export function ButtonCell({
  button,
  size,
  colors,
  onPress,
  onLongPress,
  onGesture,
}: ButtonCellProps) {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  // v1.3.0: read active theme for tileShape + accentGlow. We still let
  // callers pass `colors` explicitly (folders use custom palettes), but
  // shape and glow are theme-global because mixing radii inside a single
  // grid would look incoherent.
  const { theme } = useTheme();
  const radius = tileRadiusFor(theme, size);

  // Swipe + pinch detection via react-native-gesture-handler. The Pan uses
  // `activeOffsetY` so horizontal drags fall through to the PagerView that
  // hosts the deck — only a clearly vertical motion is recognised as a tile
  // gesture, which avoids stealing page swipes.
  const fireGesture = useCallback(
    (g: CellGesture) => {
      onGesture?.(g);
    },
    [onGesture],
  );
  const composedGesture = useMemo(() => {
    const SWIPE_DISTANCE = 30;
    const PINCH_IN_THRESHOLD = 0.8;
    const PINCH_OUT_THRESHOLD = 1.2;
    const pan = Gesture.Pan()
      .activeOffsetY([-15, 15])
      .failOffsetX([-20, 20])
      .onEnd((e) => {
        'worklet';
        if (Math.abs(e.translationY) < SWIPE_DISTANCE) return;
        if (Math.abs(e.translationY) < Math.abs(e.translationX)) return;
        if (e.translationY < 0) {
          runOnJS(fireGesture)('swipeUp');
        } else {
          runOnJS(fireGesture)('swipeDown');
        }
      });
    const pinch = Gesture.Pinch().onEnd((e) => {
      'worklet';
      if (e.scale < PINCH_IN_THRESHOLD) {
        runOnJS(fireGesture)('pinchIn');
      } else if (e.scale > PINCH_OUT_THRESHOLD) {
        runOnJS(fireGesture)('pinchOut');
      }
    });
    return Gesture.Simultaneous(pan, pinch);
  }, [fireGesture]);

  const handlePressIn = useCallback(() => {
    Animated.spring(scaleAnim, {
      toValue: 0.92,
      useNativeDriver: true,
      speed: 50,
      bounciness: 4,
    }).start();
  }, [scaleAnim]);

  const handlePressOut = useCallback(() => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      speed: 30,
      bounciness: 6,
    }).start();
  }, [scaleAnim]);

  const hasGlow = !!theme.accentGlow;
  const cellStyle: ViewStyle = {
    width: size,
    height: size,
    borderRadius: radius,
    backgroundColor: button?.color ?? colors.buttonBackground,
    borderWidth: 1,
    borderColor: colors.buttonBorder,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    // v1.1.1 polish: subtle elevation gives the grid depth.
    // v1.3.0: themes with `accentGlow` swap the black drop for an
    // accent-colored rim glow — turns chaos / neon-rgb tiles into the kind
    // of "alive" buttons those audiences expect, without redoing layout.
    shadowColor: hasGlow ? theme.accentGlow : '#000',
    shadowOffset: { width: 0, height: hasGlow ? 0 : 1 },
    shadowOpacity: hasGlow ? 0.55 : 0.18,
    shadowRadius: hasGlow ? 6 : 2,
    elevation: 2,
  };

  // Empty cell — v1.1.1: dashed border placeholder reads as an
  // intentional "drop zone" instead of a faded duplicate of a real tile.
  // Mirrors the affordance Figma uses for empty frames + matches what
  // users expect from drag-target UIs.
  if (!button) {
    const emptyStyle: ViewStyle = {
      width: size,
      height: size,
      borderRadius: radius,
      backgroundColor: 'transparent',
      borderWidth: 1.5,
      borderColor: colors.buttonBorder,
      borderStyle: 'dashed',
      justifyContent: 'center',
      alignItems: 'center',
    };
    if (onPress) {
      return (
        <Pressable
          style={emptyStyle}
          onPress={onPress}
          accessibilityRole="button"
          accessibilityLabel="Empty cell, tap to add tile"
        >
          <Text
            style={[styles.emptyPlus, { color: colors.textSecondary }]}
            allowFontScaling
            maxFontSizeMultiplier={1.3}
          >
            +
          </Text>
        </Pressable>
      );
    }
    return <View style={emptyStyle} accessibilityRole="none" />;
  }

  const hasGestureBindings =
    !!button.gestures &&
    (!!button.gestures.swipeUp || !!button.gestures.swipeDown ||
      !!button.gestures.pinchIn || !!button.gestures.pinchOut);

  const pressable = (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <Pressable
        style={cellStyle}
        onPress={onPress}
        onLongPress={onLongPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        accessibilityRole="button"
        accessibilityLabel={button.label ?? 'Button'}
        accessibilityHint={
          button.action
            ? `Tap to execute ${button.action.type.replace('_', ' ')} action. Long press to edit.`
            : 'No action assigned. Long press to edit.'
        }
      >
        {/* Icon: custom image > icon pack > letter fallback */}
        {/* customImage fills the whole tile so GIFs/PNGs behave like
            Stream Deck-style artwork (matches the Studio editor). The
            tile's border-radius clips via the parent's `overflow: hidden`,
            and the label renders on top because it's later in the JSX. */}
        {button.customImage ? (
          <Image
            source={{ uri: button.customImage }}
            style={styles.customImage}
            resizeMode="cover"
            accessibilityLabel={`${button.label ?? 'Button'} icon`}
          />
        ) : button.icon ? (
          <IconView name={button.icon} size={28} color={colors.accent} />
        ) : (
          <View style={styles.iconPlaceholder}>
            <Text
              style={[styles.iconText, { color: colors.accent }]}
              allowFontScaling
              maxFontSizeMultiplier={1.3}
            >
              {button.label?.charAt(0)?.toUpperCase() ?? '?'}
            </Text>
          </View>
        )}

        {button.label ? (
          <Text
            style={[styles.label, { color: colors.text }]}
            numberOfLines={1}
            ellipsizeMode="tail"
            allowFontScaling
            maxFontSizeMultiplier={1.3}
          >
            {button.label}
          </Text>
        ) : null}
      </Pressable>
    </Animated.View>
  );

  // Only wrap in the gesture detector when this tile actually binds
  // swipe/pinch gestures — avoids stealing touches from the PagerView on
  // ordinary tap-only tiles.
  if (hasGestureBindings && onGesture) {
    return <GestureDetector gesture={composedGesture}>{pressable}</GestureDetector>;
  }
  return pressable;
}

const styles = StyleSheet.create({
  customImage: {
    // Fill the entire tile (parent clips via overflow:'hidden') so the
    // GIF / PNG behaves like Stream Deck-style artwork. Matches Studio's
    // canvas rendering of the same image.
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
  },
  iconPlaceholder: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  iconText: {
    fontSize: 18,
    fontWeight: '600',
  },
  label: {
    fontSize: 11,
    textAlign: 'center',
    paddingHorizontal: 4,
    // Ensure the label reads on top of a custom image by drawing a slight
    // translucent dark pill around it. Tiles without customImage look
    // identical because background is transparent.
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    borderRadius: 4,
    marginHorizontal: 4,
    marginBottom: 4,
    color: '#FFFFFF',
    fontWeight: '600',
    overflow: 'hidden',
  },
  emptyPlus: {
    fontSize: 26,
    fontWeight: '200',
    opacity: 0.5,
  },
});
