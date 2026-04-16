import React, { useState, useCallback, useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import type { ButtonConfig } from '@luminadeck/shared';
import { ThemeProvider, useTheme } from './src/contexts/ThemeContext';
import { ConnectionProvider } from './src/contexts/ConnectionContext';
import { ProProvider } from './src/contexts/ProContext';
import { HomeScreen } from './src/screens/HomeScreen';
import { ConnectScreen } from './src/screens/ConnectScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { EditorScreen } from './src/screens/EditorScreen';
import { OnboardingScreen } from './src/screens/OnboardingScreen';
import { loadProfile, saveProfile } from './src/lib/storage';

const ONBOARDING_KEY = '@luminadeck/onboarding_complete';

type TabId = 'home' | 'connect' | 'settings';

interface EditorState {
  button: ButtonConfig;
  pageIndex: number;
}

function AppContent() {
  const { colors } = useTheme();
  const [activeTab, setActiveTab] = useState<TabId>('home');
  const [editorState, setEditorState] = useState<EditorState | null>(null);
  const [showOnboarding, setShowOnboarding] = useState<boolean | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(ONBOARDING_KEY).then((val) => {
      setShowOnboarding(val !== 'true');
    });
  }, []);

  const handleOnboardingComplete = useCallback(() => {
    setShowOnboarding(false);
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
          id="connect"
          label="Connect"
          icon={'\u26A1'}
          activeTab={activeTab}
          colors={colors}
          onPress={setActiveTab}
        />
        <TabButton
          id="settings"
          label="Settings"
          icon={'\u2699'}
          activeTab={activeTab}
          colors={colors}
          onPress={setActiveTab}
        />
      </View>
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
    <SafeAreaProvider>
      <ThemeProvider>
        <ConnectionProvider>
          <ProProvider>
            <AppContent />
          </ProProvider>
        </ConnectionProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  screenContainer: {
    flex: 1,
  },
  tabBar: {
    flexDirection: 'row',
    borderTopWidth: 1,
    paddingBottom: 4,
    paddingTop: 6,
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 4,
  },
  tabIcon: {
    fontSize: 20,
    marginBottom: 2,
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: '600',
  },
});
