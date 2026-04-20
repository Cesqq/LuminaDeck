import React, { useCallback } from 'react';
import {
  View,
  StyleSheet,
  Dimensions,
  type ViewStyle,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import type { ButtonConfig, GridLayout } from '@luminadeck/shared';
import { GRID_DIMENSIONS } from '@luminadeck/shared';
import { ButtonCell } from './ButtonCell';
import type { ThemeColors } from '@luminadeck/shared';

interface ButtonGridProps {
  buttons: ButtonConfig[];
  layout: GridLayout;
  colors: ThemeColors;
  hapticStyle: Haptics.ImpactFeedbackStyle | null;
  onPress: (button: ButtonConfig) => void;
  onLongPress: (button: ButtonConfig) => void;
  onEmptyPress?: (position: number) => void;
}

export function ButtonGrid({
  buttons,
  layout,
  colors,
  hapticStyle,
  onPress,
  onLongPress,
  onEmptyPress,
}: ButtonGridProps) {
  const { cols, rows } = GRID_DIMENSIONS[layout];
  const totalSlots = cols * rows;
  const screenWidth = Dimensions.get('window').width;
  const padding = 16;
  const gap = 8;
  const availableWidth = screenWidth - padding * 2 - gap * (cols - 1);
  const cellSize = Math.floor(availableWidth / cols);

  const handlePress = useCallback(
    (button: ButtonConfig) => {
      if (hapticStyle !== null) {
        Haptics.impactAsync(hapticStyle);
      }
      onPress(button);
    },
    [hapticStyle, onPress],
  );

  const slots = Array.from({ length: totalSlots }, (_, index) => {
    return buttons.find((b) => b.position === index) ?? null;
  });

  const gridStyle: ViewStyle = {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap,
    padding,
  };

  return (
    <View style={gridStyle}>
      {slots.map((button, index) => (
        <ButtonCell
          key={button?.id ?? `empty-${index}`}
          button={button}
          size={cellSize}
          colors={colors}
          onPress={button ? () => handlePress(button) : onEmptyPress ? () => onEmptyPress(index) : undefined}
          onLongPress={button ? () => onLongPress(button) : undefined}
        />
      ))}
    </View>
  );
}
