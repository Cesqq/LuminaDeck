import React from 'react';
import {
  TouchableOpacity,
  Text,
  View,
  Image,
  StyleSheet,
  type ViewStyle,
} from 'react-native';
import type { ButtonConfig, ThemeColors } from '@luminadeck/shared';

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
    return (
      <View
        style={[cellStyle, { opacity: 0.3 }]}
        accessibilityRole="none"
      />
    );
  }

  return (
    <TouchableOpacity
      style={cellStyle}
      onPress={onPress}
      onLongPress={onLongPress}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={button.label ?? 'Button'}
      accessibilityHint={
        button.action
          ? `Tap to execute ${button.action.type.replace('_', ' ')} action. Long press to edit.`
          : 'No action assigned. Long press to edit.'
      }
    >
      {/* Icon: custom image or letter placeholder */}
      {button.customImage ? (
        <Image
          source={{ uri: button.customImage }}
          style={styles.customImage}
          accessibilityLabel={`${button.label ?? 'Button'} icon`}
        />
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
    </TouchableOpacity>
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
});
