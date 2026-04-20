import React, { useRef, useCallback } from 'react';
import {
  Pressable,
  Text,
  View,
  Image,
  Animated,
  StyleSheet,
  type ViewStyle,
} from 'react-native';
import type { ButtonConfig, ThemeColors } from '@luminadeck/shared';
import { IconView } from './IconView';

interface ButtonCellProps {
  button: ButtonConfig | null;
  size: number;
  colors: ThemeColors;
  onPress?: () => void;
  onLongPress?: () => void;
}

export function ButtonCell({
  button,
  size,
  colors,
  onPress,
  onLongPress,
}: ButtonCellProps) {
  const scaleAnim = useRef(new Animated.Value(1)).current;

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

  const cellStyle: ViewStyle = {
    width: size,
    height: size,
    borderRadius: 12,
    backgroundColor: button?.color ?? colors.buttonBackground,
    borderWidth: 1,
    borderColor: colors.buttonBorder,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  };

  if (!button) {
    if (onPress) {
      return (
        <Pressable
          style={[cellStyle, { opacity: 0.3 }]}
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
    return (
      <View
        style={[cellStyle, { opacity: 0.3 }]}
        accessibilityRole="none"
      />
    );
  }

  return (
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
        {button.customImage ? (
          <Image
            source={{ uri: button.customImage }}
            style={styles.customImage}
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
}

const styles = StyleSheet.create({
  customImage: {
    width: 32,
    height: 32,
    borderRadius: 6,
    marginBottom: 4,
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
  },
  emptyPlus: {
    fontSize: 22,
    fontWeight: '300',
    opacity: 0.6,
  },
});
