import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Switch,
  StyleSheet,
} from 'react-native';
import type { ThemeId, GridLayout } from '@luminadeck/shared';
import { GRID_DIMENSIONS } from '@luminadeck/shared';
import { THEMES } from '../lib/themes';
import { useTheme } from '../contexts/ThemeContext';
import { useConnection } from '../contexts/ConnectionContext';
import { usePro } from '../contexts/ProContext';
import {
  loadSettings,
  saveSettings,
  DEFAULT_SETTINGS,
} from '../lib/storage';
import type { AppSettings, HapticIntensity } from '../lib/storage';

const GRID_OPTIONS: GridLayout[] = ['2x4', '3x4', '4x5'];
const HAPTIC_OPTIONS: { value: HapticIntensity; label: string }[] = [
  { value: 'off', label: 'Off' },
  { value: 'light', label: 'Light' },
  { value: 'medium', label: 'Medium' },
  { value: 'heavy', label: 'Heavy' },
];
const THEME_IDS: ThemeId[] = ['obsidian', 'aurora', 'daylight', 'retro-neon', 'slate'];

interface SettingsScreenProps {
  onBack: () => void;
}

export function SettingsScreen({ onBack }: SettingsScreenProps) {
  const { themeId, colors, setTheme } = useTheme();
  const { status } = useConnection();
  const { isPro } = usePro();
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);

  useEffect(() => {
    loadSettings().then(setSettings);
  }, []);

  const updateSetting = useCallback(
    <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
      const updated = { ...settings, [key]: value };
      setSettings(updated);
      saveSettings({ [key]: value });

      if (key === 'theme') {
        setTheme(value as ThemeId);
      }
    },
    [settings, setTheme],
  );

  const availableThemes = isPro ? THEME_IDS : (['obsidian'] as ThemeId[]);

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.content}
    >
      {/* Back button */}
      <TouchableOpacity
        onPress={onBack}
        style={styles.backButton}
        accessibilityRole="button"
        accessibilityLabel="Go back"
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
      >
        <Text
          style={[styles.backText, { color: colors.accent }]}
          allowFontScaling
          maxFontSizeMultiplier={1.5}
        >
          {'\u2190 Back'}
        </Text>
      </TouchableOpacity>

      <Text
        style={[styles.screenTitle, { color: colors.text }]}
        allowFontScaling
        maxFontSizeMultiplier={1.5}
      >
        Settings
      </Text>

      {/* Theme Selector */}
      <View style={styles.section}>
        <Text
          style={[styles.sectionTitle, { color: colors.text }]}
          allowFontScaling
          maxFontSizeMultiplier={1.5}
        >
          Theme
        </Text>
        <View style={styles.themeGrid}>
          {THEME_IDS.map((id) => {
            const theme = THEMES[id];
            const isAvailable = availableThemes.includes(id);
            const isSelected = themeId === id;

            return (
              <TouchableOpacity
                key={id}
                style={[
                  styles.themeCard,
                  {
                    backgroundColor: theme.colors.background,
                    borderColor: isSelected ? theme.colors.accent : theme.colors.buttonBorder,
                    borderWidth: isSelected ? 2 : 1,
                    opacity: isAvailable ? 1 : 0.4,
                  },
                ]}
                onPress={() => {
                  if (isAvailable) {
                    updateSetting('theme', id);
                  }
                }}
                disabled={!isAvailable}
                accessibilityRole="button"
                accessibilityLabel={`${theme.name} theme${isSelected ? ', selected' : ''}${!isAvailable ? ', requires Pro' : ''}`}
                accessibilityState={{ selected: isSelected, disabled: !isAvailable }}
              >
                {/* Mini preview */}
                <View style={styles.themePreview}>
                  <View
                    style={[
                      styles.previewButton,
                      { backgroundColor: theme.colors.buttonBackground },
                    ]}
                  />
                  <View
                    style={[
                      styles.previewButton,
                      { backgroundColor: theme.colors.accent },
                    ]}
                  />
                  <View
                    style={[
                      styles.previewButton,
                      { backgroundColor: theme.colors.buttonBackground },
                    ]}
                  />
                </View>
                <Text
                  style={[styles.themeName, { color: theme.colors.text }]}
                  allowFontScaling
                  maxFontSizeMultiplier={1.5}
                  numberOfLines={1}
                >
                  {theme.name}
                </Text>
                {!isAvailable && (
                  <Text
                    style={[styles.proTag, { color: theme.colors.accent }]}
                    allowFontScaling
                    maxFontSizeMultiplier={1.5}
                  >
                    PRO
                  </Text>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Grid Layout Selector */}
      <View style={styles.section}>
        <Text
          style={[styles.sectionTitle, { color: colors.text }]}
          allowFontScaling
          maxFontSizeMultiplier={1.5}
        >
          Grid Layout
        </Text>
        <View style={styles.optionRow}>
          {GRID_OPTIONS.map((layout) => {
            const dims = GRID_DIMENSIONS[layout];
            const isSelected = settings.gridLayout === layout;

            return (
              <TouchableOpacity
                key={layout}
                style={[
                  styles.optionCard,
                  {
                    backgroundColor: isSelected ? colors.accent + '22' : colors.buttonBackground,
                    borderColor: isSelected ? colors.accent : colors.buttonBorder,
                  },
                ]}
                onPress={() => updateSetting('gridLayout', layout)}
                accessibilityRole="button"
                accessibilityLabel={`${layout} grid layout, ${dims.cols} columns by ${dims.rows} rows${isSelected ? ', selected' : ''}`}
                accessibilityState={{ selected: isSelected }}
              >
                <Text
                  style={[
                    styles.optionCardTitle,
                    { color: isSelected ? colors.accent : colors.text },
                  ]}
                  allowFontScaling
                  maxFontSizeMultiplier={1.5}
                >
                  {layout}
                </Text>
                <Text
                  style={[styles.optionCardSub, { color: colors.textSecondary }]}
                  allowFontScaling
                  maxFontSizeMultiplier={1.5}
                >
                  {dims.cols * dims.rows} buttons
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Haptic Feedback */}
      <View style={styles.section}>
        <Text
          style={[styles.sectionTitle, { color: colors.text }]}
          allowFontScaling
          maxFontSizeMultiplier={1.5}
        >
          Haptic Feedback
        </Text>
        <View style={styles.optionRow}>
          {HAPTIC_OPTIONS.map(({ value, label }) => {
            const isSelected = settings.hapticIntensity === value;

            return (
              <TouchableOpacity
                key={value}
                style={[
                  styles.optionChip,
                  {
                    backgroundColor: isSelected ? colors.accent : colors.buttonBackground,
                    borderColor: isSelected ? colors.accent : colors.buttonBorder,
                  },
                ]}
                onPress={() => updateSetting('hapticIntensity', value)}
                accessibilityRole="button"
                accessibilityLabel={`Haptic feedback ${label}${isSelected ? ', selected' : ''}`}
                accessibilityState={{ selected: isSelected }}
              >
                <Text
                  style={[
                    styles.optionChipText,
                    { color: isSelected ? '#FFFFFF' : colors.text },
                  ]}
                  allowFontScaling
                  maxFontSizeMultiplier={1.5}
                >
                  {label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Press Sound */}
      <View style={styles.section}>
        <View style={styles.switchRow}>
          <Text
            style={[styles.sectionTitle, { color: colors.text, marginBottom: 0 }]}
            allowFontScaling
            maxFontSizeMultiplier={1.5}
          >
            Press Sound
          </Text>
          <Switch
            value={settings.pressSoundEnabled}
            onValueChange={(v) => updateSetting('pressSoundEnabled', v)}
            trackColor={{ false: colors.buttonBorder, true: colors.accent }}
            thumbColor="#FFFFFF"
            accessibilityRole="switch"
            accessibilityLabel="Toggle press sound"
            accessibilityState={{ checked: settings.pressSoundEnabled }}
          />
        </View>
      </View>

      {/* Pro Upgrade */}
      {!isPro && (
        <View style={styles.section}>
          <View
            style={[
              styles.proCard,
              {
                backgroundColor: colors.accent + '15',
                borderColor: colors.accent + '44',
              },
            ]}
          >
            <Text
              style={[styles.proTitle, { color: colors.accent }]}
              allowFontScaling
              maxFontSizeMultiplier={1.5}
            >
              Upgrade to Pro
            </Text>
            <Text
              style={[styles.proDescription, { color: colors.textSecondary }]}
              allowFontScaling
              maxFontSizeMultiplier={1.5}
            >
              Unlock all 5 themes, up to 30 buttons per page, 20 pages, multi-action buttons, custom images, and more.
            </Text>
            <TouchableOpacity
              style={[styles.proButton, { backgroundColor: colors.accent }]}
              onPress={() => {
                // IAP will be integrated here
              }}
              accessibilityRole="button"
              accessibilityLabel="Upgrade to Pro for $9.99"
            >
              <Text
                style={styles.proButtonText}
                allowFontScaling
                maxFontSizeMultiplier={1.5}
              >
                $9.99 \u2014 Unlock Pro
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Connection Info */}
      <View style={styles.section}>
        <Text
          style={[styles.sectionTitle, { color: colors.text }]}
          allowFontScaling
          maxFontSizeMultiplier={1.5}
        >
          Connection
        </Text>
        <View
          style={[
            styles.infoCard,
            { backgroundColor: colors.buttonBackground, borderColor: colors.buttonBorder },
          ]}
        >
          <InfoRow label="Status" value={status} colors={colors} />
          <InfoRow label="Plan" value={isPro ? 'Pro' : 'Free'} colors={colors} />
        </View>
      </View>

      {/* About */}
      <View style={styles.section}>
        <Text
          style={[styles.sectionTitle, { color: colors.text }]}
          allowFontScaling
          maxFontSizeMultiplier={1.5}
        >
          About
        </Text>
        <View
          style={[
            styles.infoCard,
            { backgroundColor: colors.buttonBackground, borderColor: colors.buttonBorder },
          ]}
        >
          <InfoRow label="App" value="LuminaDeck" colors={colors} />
          <InfoRow label="Version" value="0.1.0" colors={colors} />
          <InfoRow label="Protocol" value="1.0.0" colors={colors} />
        </View>
      </View>
    </ScrollView>
  );
}

// --- Info row helper ---

function InfoRow({
  label,
  value,
  colors,
}: {
  label: string;
  value: string;
  colors: import('@luminadeck/shared').ThemeColors;
}) {
  return (
    <View style={styles.infoRow}>
      <Text
        style={[styles.infoLabel, { color: colors.textSecondary }]}
        allowFontScaling
        maxFontSizeMultiplier={1.5}
      >
        {label}
      </Text>
      <Text
        style={[styles.infoValue, { color: colors.text }]}
        allowFontScaling
        maxFontSizeMultiplier={1.5}
      >
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingBottom: 60,
  },
  backButton: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
  },
  backText: {
    fontSize: 16,
    fontWeight: '600',
  },
  screenTitle: {
    fontSize: 28,
    fontWeight: '800',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 20,
  },
  section: {
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  themeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  themeCard: {
    width: '30%',
    minWidth: 95,
    borderRadius: 12,
    padding: 10,
    alignItems: 'center',
  },
  themePreview: {
    flexDirection: 'row',
    gap: 4,
    marginBottom: 8,
  },
  previewButton: {
    width: 20,
    height: 20,
    borderRadius: 4,
  },
  themeName: {
    fontSize: 12,
    fontWeight: '600',
  },
  proTag: {
    fontSize: 9,
    fontWeight: '800',
    marginTop: 2,
  },
  optionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  optionCard: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
  },
  optionCardTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  optionCardSub: {
    fontSize: 11,
    marginTop: 2,
  },
  optionChip: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 20,
    paddingVertical: 8,
    alignItems: 'center',
  },
  optionChipText: {
    fontSize: 13,
    fontWeight: '600',
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  proCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
  },
  proTitle: {
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 8,
  },
  proDescription: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 16,
  },
  proButton: {
    borderRadius: 12,
    paddingHorizontal: 32,
    paddingVertical: 14,
  },
  proButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  infoCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    gap: 8,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  infoLabel: {
    fontSize: 14,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '600',
  },
});
