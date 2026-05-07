import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import type { ThemeId, ThemeColors, ThemeConfig } from '@luminadeck/shared';
import { THEMES, DEFAULT_THEME } from '../lib/themes';
import { loadSettings, saveSettings } from '../lib/storage';

interface ThemeContextValue {
  themeId: ThemeId;
  colors: ThemeColors;
  /** v1.3.0: full theme config so renderers can access tileShape, accentGlow, mood. */
  theme: ThemeConfig;
  setTheme: (id: ThemeId) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  themeId: DEFAULT_THEME,
  colors: THEMES[DEFAULT_THEME].colors,
  theme: THEMES[DEFAULT_THEME],
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

  const theme = THEMES[themeId] ?? THEMES[DEFAULT_THEME];

  const value: ThemeContextValue = {
    themeId,
    colors: theme.colors,
    theme,
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

/**
 * Map TileShape to a concrete border radius. Used by ButtonCell so
 * different themes can ship different tile silhouettes without each
 * theme having to hardcode a numeric radius.
 */
export function tileRadiusFor(theme: ThemeConfig, size: number): number {
  if (theme.buttonCornerRadius != null) return theme.buttonCornerRadius;
  switch (theme.tileShape) {
    case 'square': return 4;
    case 'rounded': return 14;
    case 'squircle': return Math.round(size * 0.28);
    case 'pill': return Math.round(size * 0.45);
    default: return 14;
  }
}
