import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { ConnectionStatus as ConnectionStatusType, ThemeColors } from '@luminadeck/shared';

interface ConnectionStatusProps {
  status: ConnectionStatusType;
  colors: ThemeColors;
}

const STATUS_LABELS: Record<ConnectionStatusType, string> = {
  disconnected: 'Disconnected',
  connecting: 'Connecting...',
  connected: 'Connected',
  error: 'Connection Error',
};

export function ConnectionStatus({ status, colors }: ConnectionStatusProps) {
  const dotColor =
    status === 'connected'
      ? colors.statusGreen
      : status === 'connecting'
        ? colors.statusYellow
        : colors.statusRed;

  return (
    <View
      style={styles.container}
      accessibilityRole="text"
      accessibilityLabel={`Connection status: ${STATUS_LABELS[status]}`}
    >
      <View style={[styles.dot, { backgroundColor: dotColor }]} />
      <Text
        style={[styles.label, { color: colors.textSecondary }]}
        allowFontScaling
        maxFontSizeMultiplier={1.3}
      >
        {STATUS_LABELS[status]}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  label: {
    fontSize: 12,
  },
});
