import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import type { ThemeId, ThemeColors } from '@luminadeck/shared';
import { THEMES, DEFAULT_THEME } from '../lib/themes';
import { loadSettings, saveSettings } from '../lib/storage';

interface ThemeContextValue {
  themeId: ThemeId;
  colors: ThemeColors;
  setTheme: (id: ThemeId) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  themeId: DEFAULT_THEME,
  colors: THEMES[DEFAULT_THEME].colors,
  setTheme: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [themeId, setThemeId] = useState<ThemeId>(DEFAULT_THEME);

  useEffect(() => {
    loadSettings().then((settings) => {
      if (settings?.theme && THEMES[settings.theme]) {
        setThemeId(settings.theme);
      }
    });
  }, []);

  const setTheme = useCallback((id: ThemeId) => {
    if (!THEMES[id]) return;
    setThemeId(id);
    loadSettings().then((prev) => {
      saveSettings({ ...prev, theme: id });
    });
  }, []);

  const value: ThemeContextValue = {
    themeId,
    colors: THEMES[themeId].colors,
    setTheme,
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}
