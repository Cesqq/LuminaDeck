import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Switch,
  StyleSheet,
  Alert,
  Linking,
  Modal,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
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
import { exportProfile, importProfile } from '../lib/profileExport';
import { useProfiles } from '../contexts/ProfileContext';
import type { AppSettings, HapticIntensity } from '../lib/storage';
import { getRecentEvents, setOptIn as setTelemetryOptIn, type TelemetryEventRecord } from '../lib/telemetry';
import { setCrashReportingOptIn } from '../lib/crashReporting';
import { setPredictorEnabled } from '../lib/predictor';
import { PaywallScreen } from './PaywallScreen';
import { ProfileManagerScreen } from './ProfileManagerScreen';
import { MacroListScreen } from './MacroListScreen';
import { ProfilePackStoreScreen } from './ProfilePackStoreScreen';

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
  const { isPro, priceString, isPurchasing, isRestoring, purchase, restore } = usePro();
  const { upsertProfile } = useProfiles();
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [showPaywall, setShowPaywall] = useState(false);
  const [showProfiles, setShowProfiles] = useState(false);
  const [showMacros, setShowMacros] = useState(false);
  const [showPackStore, setShowPackStore] = useState(false);
  const [showDebugEvents, setShowDebugEvents] = useState(false);
  const [debugEvents, setDebugEvents] = useState<readonly TelemetryEventRecord[]>([]);

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
      if (key === 'telemetryOptIn') {
        // Keep the live telemetry module in sync with persisted setting so
        // flipping the toggle takes effect immediately, not just next launch.
        setTelemetryOptIn(value as boolean);
      }
      if (key === 'crashReportingOptIn') {
        // Same: flip the live Sentry consent gate immediately.
        setCrashReportingOptIn(value as boolean);
      }
      if (key === 'predictorEnabled') {
        setPredictorEnabled(value as boolean);
      }
    },
    [settings, setTheme],
  );

  const openDebugEvents = useCallback(() => {
    setDebugEvents(getRecentEvents());
    setShowDebugEvents(true);
  }, []);

  // Hidden screenshot helper — long-press the version row to load the
  // Hero Demo profile (defined in lib/heroDemo.ts). Used to populate a
  // visually rich deck for App Store / Play / MS Store screenshots
  // without hand-building 20+ tiles each round. Shipped hidden in v1.4
  // for the initial submission cycle; can be ripped out later.
  const loadHeroDemo = useCallback(() => {
    Alert.alert(
      'Load Hero Demo?',
      'Adds a curated demo profile (with bundled image tiles) and switches to it. Used for marketing screenshots.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Load',
          style: 'default',
          onPress: async () => {
            try {
              const { buildHeroDemoProfile } = await import('../lib/heroDemo');
              const profile = buildHeroDemoProfile();
              upsertProfile(profile, true);
            } catch (error) {
              console.warn('[SettingsScreen] Failed to load hero demo assets', error);
              Alert.alert(
                'Demo unavailable',
                'LuminaDeck could not load the bundled screenshot demo assets in this build.',
              );
            }
          },
        },
      ],
    );
  }, [upsertProfile]);

  const availableThemes = isPro ? THEME_IDS : (['obsidian'] as ThemeId[]);

  return (
    <>
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

      {/* Profiles */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Profiles</Text>
        <TouchableOpacity
          style={[styles.settingItem, { borderBottomColor: colors.buttonBorder }]}
          onPress={() => setShowProfiles(true)}
        >
          <Text style={[styles.settingLabel, { color: colors.text }]}>Manage Profiles</Text>
          <Text style={[styles.settingValue, { color: colors.textSecondary }]}>{'\u203A'}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.settingItem, { borderBottomColor: colors.buttonBorder }]}
          onPress={() => setShowPackStore(true)}
          accessibilityRole="button"
          accessibilityLabel="Profile Packs store"
        >
          <Text style={[styles.settingLabel, { color: colors.text }]}>Profile Packs</Text>
          <Text style={[styles.settingValue, { color: colors.textSecondary }]}>{'\u203A'}</Text>
        </TouchableOpacity>
      </View>

      {/* Macros */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Macros</Text>
        <TouchableOpacity
          style={[styles.settingItem, { borderBottomColor: colors.buttonBorder }]}
          onPress={() => {
            if (!isPro) {
              Alert.alert('Pro Feature', 'Macros require LuminaDeck Pro.');
              return;
            }
            setShowMacros(true);
          }}
        >
          <Text style={[styles.settingLabel, { color: colors.text }]}>Macro Editor</Text>
          <Text style={[styles.settingValue, { color: isPro ? colors.textSecondary : colors.accent }]}>
            {isPro ? '\u203A' : 'PRO'}
          </Text>
        </TouchableOpacity>
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
              Unlock all themes, 64 action keys, 50 pages, multi-action buttons, custom images, and more.
            </Text>
            <TouchableOpacity
              style={[styles.proButton, { backgroundColor: colors.accent, opacity: isPurchasing ? 0.6 : 1 }]}
              onPress={() => setShowPaywall(true)}
              disabled={isPurchasing}
              accessibilityRole="button"
              accessibilityLabel={`Upgrade to Pro for ${priceString}`}
              accessibilityState={{ disabled: isPurchasing }}
            >
              <Text
                style={styles.proButtonText}
                allowFontScaling
                maxFontSizeMultiplier={1.5}
              >
                {isPurchasing ? 'Processing...' : `${priceString} \u2014 Unlock Pro`}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.restoreButton]}
              onPress={restore}
              disabled={isRestoring}
              accessibilityRole="button"
              accessibilityLabel="Restore previous purchase"
              accessibilityState={{ disabled: isRestoring }}
            >
              <Text
                style={[styles.restoreText, { color: colors.accent, opacity: isRestoring ? 0.5 : 1 }]}
                allowFontScaling
                maxFontSizeMultiplier={1.5}
              >
                {isRestoring ? 'Restoring...' : 'Restore Purchase'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Profile Import/Export (Pro) */}
      {isPro && (
        <View style={styles.section}>
          <Text
            style={[styles.sectionTitle, { color: colors.text }]}
            allowFontScaling
            maxFontSizeMultiplier={1.5}
          >
            Profile
          </Text>
          <View style={styles.optionRow}>
            <TouchableOpacity
              style={[styles.optionCard, { backgroundColor: colors.buttonBackground, borderColor: colors.buttonBorder }]}
              onPress={async () => {
                try {
                  await exportProfile();
                } catch {
                  Alert.alert('Export Failed', 'Could not export profile.');
                }
              }}
              accessibilityRole="button"
              accessibilityLabel="Export profile"
            >
              <Text style={[styles.optionCardTitle, { color: colors.text }]} allowFontScaling maxFontSizeMultiplier={1.5}>
                Export
              </Text>
              <Text style={[styles.optionCardSub, { color: colors.textSecondary }]} allowFontScaling maxFontSizeMultiplier={1.5}>
                Share profile
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.optionCard, { backgroundColor: colors.buttonBackground, borderColor: colors.buttonBorder }]}
              onPress={async () => {
                try {
                  const result = await DocumentPicker.getDocumentAsync({
                    type: 'application/json',
                    copyToCacheDirectory: true,
                  });
                  if (!result.canceled && result.assets?.[0]) {
                    const success = await importProfile(result.assets[0].uri);
                    if (success) {
                      Alert.alert('Imported', 'Profile loaded successfully. Restart the app to see changes.');
                    } else {
                      Alert.alert('Invalid File', 'This file is not a valid LuminaDeck profile.');
                    }
                  }
                } catch {
                  Alert.alert('Import Failed', 'Could not import profile.');
                }
              }}
              accessibilityRole="button"
              accessibilityLabel="Import profile"
            >
              <Text style={[styles.optionCardTitle, { color: colors.text }]} allowFontScaling maxFontSizeMultiplier={1.5}>
                Import
              </Text>
              <Text style={[styles.optionCardSub, { color: colors.textSecondary }]} allowFontScaling maxFontSizeMultiplier={1.5}>
                Load profile
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

      {/* Privacy */}
      <View style={styles.section}>
        <Text
          style={[styles.sectionTitle, { color: colors.text }]}
          allowFontScaling
          maxFontSizeMultiplier={1.5}
        >
          Privacy
        </Text>
        <View
          style={[
            styles.infoCard,
            { backgroundColor: colors.buttonBackground, borderColor: colors.buttonBorder },
          ]}
        >
          <View style={styles.switchRow}>
            <Text
              style={[styles.settingLabel, { color: colors.text, flex: 1, paddingRight: 12 }]}
              allowFontScaling
              maxFontSizeMultiplier={1.5}
            >
              Share anonymous usage
            </Text>
            <Switch
              value={settings.telemetryOptIn}
              onValueChange={(v) => updateSetting('telemetryOptIn', v)}
              trackColor={{ false: colors.buttonBorder, true: colors.accent }}
              thumbColor="#FFFFFF"
              accessibilityRole="switch"
              accessibilityLabel="Toggle anonymous analytics"
              accessibilityState={{ checked: settings.telemetryOptIn }}
            />
          </View>
          <Text
            style={[styles.privacyBody, { color: colors.textSecondary }]}
            allowFontScaling
            maxFontSizeMultiplier={1.5}
          >
            Off by default. Sends action-type counts and session lengths to our
            EU-hosted analytics so we can prioritize features. Never includes
            tile labels, window titles, or any text you type. Device ID is a
            random salt that rotates every 90 days.
          </Text>
          <View style={[styles.switchRow, { marginTop: 14 }]}>
            <Text
              style={[styles.settingLabel, { color: colors.text, flex: 1, paddingRight: 12 }]}
              allowFontScaling
              maxFontSizeMultiplier={1.5}
            >
              Share crash diagnostics
            </Text>
            <Switch
              value={settings.crashReportingOptIn}
              onValueChange={(v) => updateSetting('crashReportingOptIn', v)}
              trackColor={{ false: colors.buttonBorder, true: colors.accent }}
              thumbColor="#FFFFFF"
              accessibilityRole="switch"
              accessibilityLabel="Toggle crash diagnostics"
              accessibilityState={{ checked: settings.crashReportingOptIn }}
            />
          </View>
          <Text
            style={[styles.privacyBody, { color: colors.textSecondary }]}
            allowFontScaling
            maxFontSizeMultiplier={1.5}
          >
            Off by default. Sends crash and error reports so we can fix bugs.
            No tile labels, window titles, or text you type are included.
          </Text>
          <View style={[styles.switchRow, { marginTop: 14 }]}>
            <Text
              style={[styles.settingLabel, { color: colors.text, flex: 1, paddingRight: 12 }]}
              allowFontScaling
              maxFontSizeMultiplier={1.5}
            >
              Smart Page predictions
            </Text>
            <Switch
              value={settings.predictorEnabled}
              onValueChange={(v) => updateSetting('predictorEnabled', v)}
              trackColor={{ false: colors.buttonBorder, true: colors.accent }}
              thumbColor="#FFFFFF"
              accessibilityRole="switch"
              accessibilityLabel="Toggle on-device prediction"
              accessibilityState={{ checked: settings.predictorEnabled }}
            />
          </View>
          <Text
            style={[styles.privacyBody, { color: colors.textSecondary }]}
            allowFontScaling
            maxFontSizeMultiplier={1.5}
          >
            On-device only. Learns which tiles you press back-to-back and
            shows the top six on a separate Smart Page (tap the sparkle icon
            on Home). Never leaves your phone. Your main grid doesn't change.
          </Text>
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
          <InfoRow
            label="Version"
            value="1.3.2"
            colors={colors}
            onPressFive={openDebugEvents}
            onLongPress={loadHeroDemo}
          />
          <InfoRow label="Protocol" value="1.5.0" colors={colors} />
        </View>
        {/* Privacy Policy link — required by App Store §5.1.1 + MS Store policy */}
        <TouchableOpacity
          style={[styles.settingItem, { borderBottomColor: colors.buttonBorder, marginTop: 8 }]}
          onPress={() => {
            Linking.openURL('https://luminaaio.com/luminadeck/privacy').catch(() => {
              Alert.alert('Could not open', 'https://luminaaio.com/luminadeck/privacy');
            });
          }}
          accessibilityRole="link"
          accessibilityLabel="Privacy Policy"
        >
          <Text style={[styles.settingLabel, { color: colors.text }]}>Privacy Policy</Text>
          <Text style={[styles.settingValue, { color: colors.textSecondary }]}>{'\u2197'}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.settingItem, { borderBottomColor: colors.buttonBorder }]}
          onPress={() => {
            Linking.openURL('https://luminaaio.com/luminadeck').catch(() => {
              Alert.alert('Could not open', 'https://luminaaio.com/luminadeck');
            });
          }}
          accessibilityRole="link"
          accessibilityLabel="LuminaDeck website"
        >
          <Text style={[styles.settingLabel, { color: colors.text }]}>Website</Text>
          <Text style={[styles.settingValue, { color: colors.textSecondary }]}>{'\u2197'}</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
    <PaywallScreen visible={showPaywall} onClose={() => setShowPaywall(false)} />
    <ProfileManagerScreen visible={showProfiles} onClose={() => setShowProfiles(false)} />
    <Modal visible={showMacros} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowMacros(false)}>
      <MacroListScreen onClose={() => setShowMacros(false)} />
    </Modal>
    <Modal visible={showPackStore} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowPackStore(false)}>
      <ProfilePackStoreScreen onClose={() => setShowPackStore(false)} />
    </Modal>
    <Modal
      visible={showDebugEvents}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={() => setShowDebugEvents(false)}
    >
      <DebugEventsModal
        events={debugEvents}
        onClose={() => setShowDebugEvents(false)}
        optIn={settings.telemetryOptIn}
        colors={colors}
      />
    </Modal>
    </>
  );
}

// --- Info row helper ---

function InfoRow({
  label,
  value,
  colors,
  onPressFive,
  onLongPress,
}: {
  label: string;
  value: string;
  colors: import('@luminadeck/shared').ThemeColors;
  /**
   * Hidden debug gesture. When provided, five taps on the row within three
   * seconds fires the callback — used to unlock the telemetry ring-buffer
   * overlay from the Settings version row.
   */
  onPressFive?: () => void;
  /**
   * Hidden screenshot-helper gesture. When provided, a long-press on the
   * row fires the callback — used to load the Hero Demo profile for
   * App Store / Play / MS Store marketing screenshots. v1.4 only.
   */
  onLongPress?: () => void;
}) {
  const tapCountRef = useRef(0);
  const tapWindowRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleTap = useCallback(() => {
    if (!onPressFive) return;
    tapCountRef.current += 1;
    if (tapWindowRef.current) clearTimeout(tapWindowRef.current);
    tapWindowRef.current = setTimeout(() => {
      tapCountRef.current = 0;
    }, 3000);
    if (tapCountRef.current >= 5) {
      tapCountRef.current = 0;
      if (tapWindowRef.current) clearTimeout(tapWindowRef.current);
      onPressFive();
    }
  }, [onPressFive]);

  const body = (
    <>
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
    </>
  );

  if (onPressFive || onLongPress) {
    return (
      <TouchableOpacity
        style={styles.infoRow}
        onPress={onPressFive ? handleTap : undefined}
        onLongPress={onLongPress}
        delayLongPress={1200}
        activeOpacity={1}
        accessibilityRole="button"
        accessibilityLabel={`${label} ${value}`}
      >
        {body}
      </TouchableOpacity>
    );
  }
  return <View style={styles.infoRow}>{body}</View>;
}

// --- Debug events modal ---

function DebugEventsModal({
  events,
  onClose,
  optIn,
  colors,
}: {
  events: readonly TelemetryEventRecord[];
  onClose: () => void;
  optIn: boolean;
  colors: import('@luminadeck/shared').ThemeColors;
}) {
  return (
    <View style={[{ flex: 1, backgroundColor: colors.background }]}>
      <View style={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 }}>
        <TouchableOpacity onPress={onClose} accessibilityRole="button" accessibilityLabel="Close">
          <Text style={{ color: colors.accent, fontSize: 16, fontWeight: '600' }}>{'\u2190 Close'}</Text>
        </TouchableOpacity>
        <Text
          style={{ color: colors.text, fontSize: 22, fontWeight: '800', marginTop: 12 }}
          allowFontScaling
          maxFontSizeMultiplier={1.5}
        >
          Telemetry Debug
        </Text>
        <Text
          style={{ color: colors.textSecondary, fontSize: 13, marginTop: 6 }}
          allowFontScaling
          maxFontSizeMultiplier={1.5}
        >
          {optIn ? 'Sending to PostHog EU' : 'Opt-out: events recorded locally only'}
          {' \u2014 '}last {events.length}/20 events.
        </Text>
      </View>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 10 }}>
        {events.length === 0 && (
          <Text style={{ color: colors.textSecondary, fontSize: 14 }} allowFontScaling maxFontSizeMultiplier={1.5}>
            No events captured this session.
          </Text>
        )}
        {[...events].reverse().map((e, i) => (
          <View
            key={`${e.timestamp}-${i}`}
            style={{
              backgroundColor: colors.buttonBackground,
              borderColor: colors.buttonBorder,
              borderWidth: 1,
              borderRadius: 10,
              padding: 10,
            }}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ color: colors.text, fontWeight: '700', fontSize: 14 }} allowFontScaling maxFontSizeMultiplier={1.5}>
                {e.event}
              </Text>
              <Text style={{ color: colors.textSecondary, fontSize: 11 }} allowFontScaling maxFontSizeMultiplier={1.5}>
                {e.sent ? 'sent' : e.error ? `err: ${e.error}` : 'local'}
              </Text>
            </View>
            <Text style={{ color: colors.textSecondary, fontSize: 11, marginTop: 2 }} allowFontScaling maxFontSizeMultiplier={1.5}>
              {e.timestamp}
            </Text>
            <Text
              style={{ color: colors.text, fontSize: 12, fontFamily: 'monospace', marginTop: 4 }}
              allowFontScaling
              maxFontSizeMultiplier={1.5}
            >
              {JSON.stringify(e.properties)}
            </Text>
          </View>
        ))}
      </ScrollView>
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
  restoreButton: {
    marginTop: 10,
    paddingVertical: 8,
    alignItems: 'center',
  },
  restoreText: {
    fontSize: 14,
    fontWeight: '600',
  },
  infoCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    gap: 8,
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: '500',
  },
  settingValue: {
    fontSize: 18,
    fontWeight: '600',
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
  privacyBody: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 8,
  },
});
