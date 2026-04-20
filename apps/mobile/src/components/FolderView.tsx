import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Animated,
  StyleSheet,
  Dimensions,
} from 'react-native';
import type { ButtonConfig, ThemeColors } from '@luminadeck/shared';
import type { FolderAction } from '@luminadeck/shared';
import { ButtonGrid } from './ButtonGrid';
import * as Haptics from 'expo-haptics';

interface FolderViewProps {
  folder: FolderAction;
  colors: ThemeColors;
  hapticStyle: Haptics.ImpactFeedbackStyle | null;
  onBack: () => void;
  onButtonPress: (button: ButtonConfig) => void;
  onButtonLongPress: (button: ButtonConfig) => void;
}

const SCREEN_WIDTH = Dimensions.get('window').width;

export function FolderView({
  folder,
  colors,
  hapticStyle,
  onBack,
  onButtonPress,
  onButtonLongPress,
}: FolderViewProps) {
  const slideAnim = useRef(new Animated.Value(SCREEN_WIDTH)).current;

  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: 0,
      useNativeDriver: true,
      speed: 20,
      bounciness: 4,
    }).start();
  }, [slideAnim]);

  const handleBack = () => {
    Animated.timing(slideAnim, {
      toValue: SCREEN_WIDTH,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      onBack();
    });
  };

  return (
    <Animated.View
      style={[
        styles.container,
        {
          backgroundColor: colors.background,
          transform: [{ translateX: slideAnim }],
        },
      ]}
    >
      {/* Header bar */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={handleBack}
          style={styles.backButton}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Text style={[styles.backArrow, { color: colors.accent }]}>
            {'\u2190'}
          </Text>
        </TouchableOpacity>
        <Text
          style={[styles.folderName, { color: colors.text }]}
          numberOfLines={1}
          allowFontScaling
          maxFontSizeMultiplier={1.5}
        >
          {folder.folderName}
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Folder button grid */}
      <ButtonGrid
        buttons={folder.buttons}
        layout={folder.layout}
        colors={colors}
        hapticStyle={hapticStyle}
        onPress={onButtonPress}
        onLongPress={onButtonLongPress}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 8,
  },
  backButton: {
    padding: 4,
    marginRight: 8,
  },
  backArrow: {
    fontSize: 22,
    fontWeight: '600',
  },
  folderName: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
  },
  headerSpacer: {
    width: 34,
  },
});
