import AsyncStorage from '@react-native-async-storage/async-storage';
import type {
  ProfileConfig,
  ButtonConfig,
  GridLayout,
  ThemeId,
  ProStatus,
} from '@luminadeck/shared';
import * as Haptics from 'expo-haptics';

// --- Keys ---

const STORAGE_KEYS = {
  profile: '@luminadeck/profile',
  settings: '@luminadeck/settings',
} as const;

// --- Settings Shape ---

export type HapticIntensity = 'off' | 'light' | 'medium' | 'heavy';

export interface AppSettings {
  theme: ThemeId;
  gridLayout: GridLayout;
  hapticIntensity: HapticIntensity;
  pressSoundEnabled: boolean;
  proStatus: ProStatus;
}

export const DEFAULT_SETTINGS: AppSettings = {
  theme: 'obsidian',
  gridLayout: '3x4',
  hapticIntensity: 'medium',
  pressSoundEnabled: false,
  proStatus: { isPro: false, source: 'none' },
};

// --- Haptic mapping ---

export function hapticStyleFromIntensity(
  intensity: HapticIntensity,
): Haptics.ImpactFeedbackStyle | null {
  switch (intensity) {
    case 'off':
      return null;
    case 'light':
      return Haptics.ImpactFeedbackStyle.Light;
    case 'medium':
      return Haptics.ImpactFeedbackStyle.Medium;
    case 'heavy':
      return Haptics.ImpactFeedbackStyle.Heavy;
    default:
      return Haptics.ImpactFeedbackStyle.Medium;
  }
}

// --- Default demo profile ---

function createDefaultProfile(): ProfileConfig {
  const now = new Date().toISOString();
  const demoButtons: ButtonConfig[] = [
    {
      id: 'demo-vol-up',
      action: { type: 'system_action', action: 'volume_up' },
      label: 'Vol Up',
      color: '#1A1A2E',
      page: 0,
      position: 0,
    },
    {
      id: 'demo-vol-down',
      action: { type: 'system_action', action: 'volume_down' },
      label: 'Vol Down',
      color: '#1A1A2E',
      page: 0,
      position: 1,
    },
    {
      id: 'demo-play-pause',
      action: { type: 'system_action', action: 'media_play_pause' },
      label: 'Play/Pause',
      color: '#1A1A2E',
      page: 0,
      position: 2,
    },
    {
      id: 'demo-mute',
      action: { type: 'system_action', action: 'volume_mute' },
      label: 'Mute',
      color: '#1A1A2E',
      page: 0,
      position: 3,
    },
  ];

  return {
    id: 'default',
    name: 'Default Profile',
    pages: [
      {
        id: 'page-0',
        name: 'Main',
        buttons: demoButtons,
        layout: '3x4',
      },
    ],
    theme: 'obsidian',
    createdAt: now,
    updatedAt: now,
  };
}

// --- Profile persistence ---

export async function saveProfile(profile: ProfileConfig): Promise<void> {
  const updated: ProfileConfig = {
    ...profile,
    updatedAt: new Date().toISOString(),
  };
  await AsyncStorage.setItem(STORAGE_KEYS.profile, JSON.stringify(updated));
}

export async function loadProfile(): Promise<ProfileConfig> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEYS.profile);
    if (raw) {
      const parsed = JSON.parse(raw) as ProfileConfig;
      if (parsed.id && parsed.pages) {
        return parsed;
      }
    }
  } catch {
    // Corrupted data — return default
  }
  const defaultProfile = createDefaultProfile();
  await saveProfile(defaultProfile);
  return defaultProfile;
}

// --- Settings persistence ---

export async function saveSettings(settings: Partial<AppSettings>): Promise<void> {
  try {
    const existing = await loadSettings();
    const merged: AppSettings = { ...DEFAULT_SETTINGS, ...existing, ...settings };
    await AsyncStorage.setItem(STORAGE_KEYS.settings, JSON.stringify(merged));
  } catch {
    // Silently fail — next load will use defaults
  }
}

export async function loadSettings(): Promise<AppSettings> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEYS.settings);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<AppSettings>;
      return { ...DEFAULT_SETTINGS, ...parsed };
    }
  } catch {
    // Corrupted — return default
  }
  return { ...DEFAULT_SETTINGS };
}
