import React, { useState, useCallback, useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import type { ButtonConfig } from '@luminadeck/shared';
import { ThemeProvider, useTheme } from './src/contexts/ThemeContext';
import { ConnectionProvider, useConnection } from './src/contexts/ConnectionContext';
import { ProProvider, usePro } from './src/contexts/ProContext';
import { ProfileProvider } from './src/contexts/ProfileContext';
import { HomeScreen } from './src/screens/HomeScreen';
import { ConnectScreen } from './src/screens/ConnectScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { EditorScreen } from './src/screens/EditorScreen';
import { OnboardingScreen } from './src/screens/OnboardingScreen';
import { ConnectionGateScreen } from './src/screens/ConnectionGateScreen';
import { AutoProfileScreen } from './src/screens/AutoProfileScreen';
import { PluginsScreen } from './src/screens/PluginsScreen';
import { PagesScreen } from './src/screens/PagesScreen';
import { KeyboardScreen } from './src/screens/KeyboardScreen';
import { loadProfile, loadSettings, saveProfile } from './src/lib/storage';
import { initTelemetry, track } from './src/lib/telemetry';
import { initPredictor } from './src/lib/predictor';
import { TELEMETRY_EVENTS } from '@luminadeck/shared';

const ONBOARDING_KEY = '@luminadeck/onboarding_complete';
const APP_VERSION = '1.3.4';

type TabId = 'home' | 'connect' | 'auto' | 'plugins' | 'pages' | 'keyboard' | 'settings';

interface EditorState {
  button: ButtonConfig;
  pageIndex: number;
}

function AppContent() {
  const { colors } = useTheme();
  const { status, client } = useConnection();
  const { proStatus } = usePro();
  const [activeTab, setActiveTab] = useState<TabId>('home');

  // Keep the WS client's Pro snapshot in sync with the ProContext so the
  // hello handshake on every (re)connect tells Studio the right tier.
  // setProStatus triggers a reconnect when the connection is already open,
  // which is what we want — Studio picks up the fresh value immediately.
  useEffect(() => {
    client.setProStatus(proStatus);
  }, [client, proStatus]);
  const [editorState, setEditorState] = useState<EditorState | null>(null);
  const [showOnboarding, setShowOnboarding] = useState<boolean | null>(null);
  const [isGated, setIsGated] = useState(true);

  useEffect(() => {
    AsyncStorage.getItem(ONBOARDING_KEY).then((val) => {
      setShowOnboarding(val !== 'true');
    });
    // Initialise telemetry with the persisted opt-in state. initTelemetry
    // itself is a no-op when opt-in is false — but we always warm up the
    // salt so the debug overlay can preview what we *would* send.
    loadSettings()
      .then(async (s) => {
        await initTelemetry({ optIn: s.telemetryOptIn, version: APP_VERSION });
        // Predictor profile id is seeded from the persisted profile so the
        // first-press Markov transition is stored against the right key.
        const persistedProfile = await loadProfile();
        await initPredictor({
          enabled: s.predictorEnabled,
          profileId: persistedProfile.id,
        });
        track(TELEMETRY_EVENTS.APP_OPEN, { surface: 'home' });
      })
      .catch(() => {
        // Telemetry/predictor failures must never block app startup.
      });
  }, []);

  const handleOnboardingComplete = useCallback(() => {
    setShowOnboarding(false);
  }, []);

  const handleConnected = useCallback(() => {
    setIsGated(false);
  }, []);

  const handleNavigateSettings = useCallback(() => {
    setActiveTab('settings');
  }, []);

  const handleEditButton = useCallback((button: ButtonConfig, pageIndex: number) => {
    setEditorState({ button, pageIndex });
  }, []);

  const handleEditorSave = useCallback(async (updated: ButtonConfig) => {
    const profile = await loadProfile();
    const pageIdx = editorState?.pageIndex ?? 0;
    const page = profile.pages[pageIdx];
    if (page) {
      const btnIdx = page.buttons.findIndex((b) => b.id === updated.id);
      if (btnIdx >= 0) {
        page.buttons[btnIdx] = updated;
      } else {
        page.buttons.push(updated);
      }
      await saveProfile(profile);
    }
    setEditorState(null);
  }, [editorState]);

  const handleEditorCancel = useCallback(() => {
    setEditorState(null);
  }, []);

  const handleBackFromSettings = useCallback(() => {
    setActiveTab('home');
  }, []);

  // Determine StatusBar style from background luminance
  const bgIsLight = isLightColor(colors.background);
  const statusBarStyle = bgIsLight ? 'dark' : 'light';

  // Loading state for onboarding check
  if (showOnboarding === null) {
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['top']}>
        <StatusBar style={statusBarStyle} backgroundColor={colors.background} />
      </SafeAreaView>
    );
  }

  // Show onboarding on first run
  if (showOnboarding) {
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['top']}>
        <StatusBar style={statusBarStyle} backgroundColor={colors.background} />
        <OnboardingScreen onComplete={handleOnboardingComplete} />
      </SafeAreaView>
    );
  }

  // Connection gate: must connect before seeing the deck
  if (isGated) {
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['top']}>
        <StatusBar style={statusBarStyle} backgroundColor={colors.background} />
        <ConnectionGateScreen onConnected={handleConnected} />
      </SafeAreaView>
    );
  }

  // If editor is open, show it full-screen over everything
  if (editorState) {
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['top']}>
        <StatusBar style={statusBarStyle} backgroundColor={colors.background} />
        <EditorScreen
          button={editorState.button}
          pageIndex={editorState.pageIndex}
          onSave={handleEditorSave}
          onCancel={handleEditorCancel}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['top']}>
      <StatusBar style={statusBarStyle} backgroundColor={colors.background} />

      {/* Screen content */}
      <View style={styles.screenContainer}>
        {activeTab === 'home' && (
          <HomeScreen
            onNavigateSettings={handleNavigateSettings}
            onEditButton={handleEditButton}
          />
        )}
        {activeTab === 'connect' && <ConnectScreen />}
        {activeTab === 'auto' && <AutoProfileScreen onBack={handleBackFromSettings} />}
        {activeTab === 'plugins' && <PluginsScreen onBack={handleBackFromSettings} />}
        {activeTab === 'pages' && <PagesScreen onBack={handleBackFromSettings} />}
        {activeTab === 'keyboard' && <KeyboardScreen onBack={handleBackFromSettings} />}
        {activeTab === 'settings' && <SettingsScreen onBack={handleBackFromSettings} />}
      </View>

      {/* Tab bar */}
      <View style={[styles.tabBar, { backgroundColor: colors.buttonBackground, borderTopColor: colors.buttonBorder }]}>
        <TabButton
          id="home"
          label="Home"
          icon={'\u2302'}
          activeTab={activeTab}
          colors={colors}
          onPress={setActiveTab}
        />
        <TabButton
          id="auto"
          label="Auto"
          icon={'\u21C4'}
          activeTab={activeTab}
          colors={colors}
          onPress={setActiveTab}
        />
        {/* Trailing U+FE0E variation selector forces TEXT presentation —
            iOS otherwise renders U+26A1 and U+2699 as colored emoji which
            stood out oddly next to the monochrome sibling glyphs. */}
        <TabButton
          id="plugins"
          label="Plugins"
          icon={'\u26A1\uFE0E'}
          activeTab={activeTab}
          colors={colors}
          onPress={setActiveTab}
        />
        <TabButton
          id="pages"
          label="Pages"
          icon={'\u25A4'}
          activeTab={activeTab}
          colors={colors}
          onPress={setActiveTab}
        />
        <TabButton
          id="connect"
          label="Link"
          icon={'\u26AF'}
          activeTab={activeTab}
          colors={colors}
          onPress={setActiveTab}
        />
        <TabButton
          id="keyboard"
          label="Type"
          icon={'⌨︎'}
          activeTab={activeTab}
          colors={colors}
          onPress={setActiveTab}
        />
        <TabButton
          id="settings"
          label="Settings"
          icon={'\u2699\uFE0E'}
          activeTab={activeTab}
          colors={colors}
          onPress={setActiveTab}
        />
      </View>

      {/* Reconnecting overlay -- shown when connection drops while in deck */}
      {status === 'connecting' && (
        <View style={styles.reconnectingOverlay}>
          <View style={styles.reconnectingBox}>
            <ActivityIndicator color={colors.text} size="large" />
            <Text
              style={[styles.reconnectingText, { color: colors.text }]}
              allowFontScaling
              maxFontSizeMultiplier={1.5}
            >
              Reconnecting...
            </Text>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

function TabButton({
  id,
  label,
  icon,
  activeTab,
  colors,
  onPress,
}: {
  id: TabId;
  label: string;
  icon: string;
  activeTab: TabId;
  colors: import('@luminadeck/shared').ThemeColors;
  onPress: (tab: TabId) => void;
}) {
  const isActive = activeTab === id;

  return (
    <TouchableOpacity
      style={styles.tabButton}
      onPress={() => onPress(id)}
      accessibilityRole="tab"
      accessibilityLabel={`${label} tab`}
      accessibilityState={{ selected: isActive }}
    >
      <Text
        style={[
          styles.tabIcon,
          { color: isActive ? colors.accent : colors.textSecondary },
        ]}
        allowFontScaling
        maxFontSizeMultiplier={1.5}
      >
        {icon}
      </Text>
      <Text
        style={[
          styles.tabLabel,
          { color: isActive ? colors.accent : colors.textSecondary },
        ]}
        allowFontScaling
        maxFontSizeMultiplier={1.5}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

/**
 * Rough luminance check to determine if a hex color is "light" or "dark".
 * Used for StatusBar style.
 */
function isLightColor(hex: string): boolean {
  const cleaned = hex.replace('#', '');
  if (cleaned.length !== 6) return false;
  const r = parseInt(cleaned.substring(0, 2), 16);
  const g = parseInt(cleaned.substring(2, 4), 16);
  const b = parseInt(cleaned.substring(4, 6), 16);
  // Perceived luminance formula
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5;
}

export default function App() {
  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <ThemeProvider>
          <ProfileProvider>
            <ConnectionProvider>
              <ProProvider>
                <AppContent />
              </ProProvider>
            </ConnectionProvider>
          </ProfileProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  screenContainer: {
    flex: 1,
  },
  tabBar: {
    flexDirection: 'row',
    borderTopWidth: 1,
    // Larger vertical padding to get to the 44pt HIG tap target on modern
    // iPhones — the 4/6 from v1.0 was fine on SE but cramped on Pro Max.
    paddingBottom: 10,
    paddingTop: 10,
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 6,
  },
  tabIcon: {
    fontSize: 24,
    marginBottom: 3,
  },
  tabLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  reconnectingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
  },
  reconnectingBox: {
    alignItems: 'center',
    gap: 16,
  },
  reconnectingText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
