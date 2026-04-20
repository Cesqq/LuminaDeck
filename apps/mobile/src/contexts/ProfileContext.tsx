import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ProfileConfig } from '@luminadeck/shared';

const PROFILES_KEY = '@luminadeck/profiles';
const ACTIVE_PROFILE_KEY = '@luminadeck/active_profile';

interface ProfileContextValue {
  profiles: ProfileConfig[];
  activeProfile: ProfileConfig | null;
  activeProfileId: string | null;
  setActiveProfile: (id: string) => void;
  createProfile: (name: string) => ProfileConfig;
  updateProfile: (profile: ProfileConfig) => void;
  deleteProfile: (id: string) => void;
  duplicateProfile: (id: string) => ProfileConfig | null;
}

const ProfileContext = createContext<ProfileContextValue>({
  profiles: [],
  activeProfile: null,
  activeProfileId: null,
  setActiveProfile: () => {},
  createProfile: () => ({ id: '', name: '', pages: [], theme: 'obsidian', createdAt: '', updatedAt: '' }),
  updateProfile: () => {},
  deleteProfile: () => {},
  duplicateProfile: () => null,
});

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function createDefaultProfile(name: string): ProfileConfig {
  const now = new Date().toISOString();
  return {
    id: generateId(),
    name,
    pages: [{
      id: generateId(),
      name: 'Main',
      buttons: [],
      layout: '3x4',
    }],
    theme: 'obsidian',
    createdAt: now,
    updatedAt: now,
  };
}

export function ProfileProvider({ children }: { children: React.ReactNode }) {
  const [profiles, setProfiles] = useState<ProfileConfig[]>([]);
  const [activeProfileId, setActiveProfileId] = useState<string | null>(null);

  // Load profiles on mount
  useEffect(() => {
    Promise.all([
      AsyncStorage.getItem(PROFILES_KEY),
      AsyncStorage.getItem(ACTIVE_PROFILE_KEY),
    ]).then(([profilesJson, activeId]) => {
      let loaded: ProfileConfig[] = [];
      if (profilesJson) {
        try {
          loaded = JSON.parse(profilesJson);
        } catch {
          loaded = [];
        }
      }

      // Migration: if no profiles exist, create default
      if (loaded.length === 0) {
        const defaultProfile = createDefaultProfile('Default');
        loaded = [defaultProfile];
        AsyncStorage.setItem(PROFILES_KEY, JSON.stringify(loaded));
      }

      setProfiles(loaded);
      setActiveProfileId(activeId ?? loaded[0]?.id ?? null);
    });
  }, []);

  const persist = useCallback((updated: ProfileConfig[]) => {
    setProfiles(updated);
    AsyncStorage.setItem(PROFILES_KEY, JSON.stringify(updated));
  }, []);

  const setActiveProfile = useCallback((id: string) => {
    setActiveProfileId(id);
    AsyncStorage.setItem(ACTIVE_PROFILE_KEY, id);
  }, []);

  const createProfile = useCallback((name: string): ProfileConfig => {
    const profile = createDefaultProfile(name);
    const updated = [...profiles, profile];
    persist(updated);
    return profile;
  }, [profiles, persist]);

  const updateProfile = useCallback((profile: ProfileConfig) => {
    const updated = profiles.map((p) =>
      p.id === profile.id ? { ...profile, updatedAt: new Date().toISOString() } : p,
    );
    persist(updated);
  }, [profiles, persist]);

  const deleteProfile = useCallback((id: string) => {
    if (profiles.length <= 1) return; // Don't delete last profile
    const updated = profiles.filter((p) => p.id !== id);
    persist(updated);
    if (activeProfileId === id) {
      const newActive = updated[0]?.id ?? null;
      setActiveProfileId(newActive);
      if (newActive) AsyncStorage.setItem(ACTIVE_PROFILE_KEY, newActive);
    }
  }, [profiles, activeProfileId, persist]);

  const duplicateProfile = useCallback((id: string): ProfileConfig | null => {
    const source = profiles.find((p) => p.id === id);
    if (!source) return null;
    const now = new Date().toISOString();
    const copy: ProfileConfig = {
      ...JSON.parse(JSON.stringify(source)),
      id: generateId(),
      name: `${source.name} (Copy)`,
      createdAt: now,
      updatedAt: now,
    };
    copy.pages = copy.pages.map((page) => ({
      ...page,
      id: generateId(),
      buttons: page.buttons.map((btn) => ({ ...btn, id: generateId() })),
    }));
    const updated = [...profiles, copy];
    persist(updated);
    return copy;
  }, [profiles, persist]);

  const activeProfile = profiles.find((p) => p.id === activeProfileId) ?? profiles[0] ?? null;

  return (
    <ProfileContext.Provider
      value={{
        profiles,
        activeProfile,
        activeProfileId,
        setActiveProfile,
        createProfile,
        updateProfile,
        deleteProfile,
        duplicateProfile,
      }}
    >
      {children}
    </ProfileContext.Provider>
  );
}

export function useProfiles(): ProfileContextValue {
  return useContext(ProfileContext);
}
