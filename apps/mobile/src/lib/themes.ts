import type { ThemeConfig, ThemeColors } from '@luminadeck/shared';

// ── Dark Themes ─────────────────────────────

const obsidianColors: ThemeColors = {
  background: '#0D0D0D', buttonBackground: '#1A1A2E', buttonBorder: '#16213E',
  accent: '#0F3460', text: '#E0E0E0', textSecondary: '#888888',
  statusGreen: '#4CAF50', statusYellow: '#FFC107', statusRed: '#F44336',
};

const auroraColors: ThemeColors = {
  background: '#0B0B1A', buttonBackground: '#1B1B3A', buttonBorder: '#2D1B69',
  accent: '#7B2FBE', accentSecondary: '#00D4FF', text: '#E8E8F0', textSecondary: '#9090B0',
  statusGreen: '#4CAF50', statusYellow: '#FFC107', statusRed: '#F44336',
};

const retroNeonColors: ThemeColors = {
  background: '#0A0A0A', buttonBackground: '#1A0A2E', buttonBorder: '#FF006E',
  accent: '#FF006E', accentSecondary: '#00FF88', text: '#FFD600', textSecondary: '#FF006E',
  statusGreen: '#00FF88', statusYellow: '#FFD600', statusRed: '#FF006E',
};

const slateColors: ThemeColors = {
  background: '#1E1E1E', buttonBackground: '#2D2D2D', buttonBorder: '#3D3D3D',
  accent: '#4CAF50', text: '#B0B0B0', textSecondary: '#707070',
  statusGreen: '#4CAF50', statusYellow: '#FFC107', statusRed: '#F44336',
};

const midnightColors: ThemeColors = {
  background: '#0F0F1A', buttonBackground: '#1A1A30', buttonBorder: '#252545',
  accent: '#6C5CE7', accentSecondary: '#A29BFE', text: '#DFE6E9', textSecondary: '#636E72',
  statusGreen: '#00B894', statusYellow: '#FDCB6E', statusRed: '#D63031',
};

const oceanColors: ThemeColors = {
  background: '#0A1628', buttonBackground: '#142238', buttonBorder: '#1E3A5F',
  accent: '#0984E3', accentSecondary: '#74B9FF', text: '#DFE6E9', textSecondary: '#7F8C8D',
  statusGreen: '#00CEC9', statusYellow: '#FFEAA7', statusRed: '#FF7675',
};

const volcanicColors: ThemeColors = {
  background: '#1A0A0A', buttonBackground: '#2D1515', buttonBorder: '#4A1F1F',
  accent: '#E74C3C', accentSecondary: '#FF6B6B', text: '#ECF0F1', textSecondary: '#95A5A6',
  statusGreen: '#2ECC71', statusYellow: '#F39C12', statusRed: '#E74C3C',
};

const forestColors: ThemeColors = {
  background: '#0A1A0F', buttonBackground: '#142D1A', buttonBorder: '#1E4A28',
  accent: '#27AE60', accentSecondary: '#2ECC71', text: '#ECF0F1', textSecondary: '#7F8C8D',
  statusGreen: '#27AE60', statusYellow: '#F1C40F', statusRed: '#E74C3C',
};

const carbonColors: ThemeColors = {
  background: '#111111', buttonBackground: '#1C1C1C', buttonBorder: '#2A2A2A',
  accent: '#F5F5F5', text: '#E0E0E0', textSecondary: '#666666',
  statusGreen: '#4CAF50', statusYellow: '#FFC107', statusRed: '#F44336',
};

const cyberpunkColors: ThemeColors = {
  background: '#0D0221', buttonBackground: '#1A0533', buttonBorder: '#2D0A4E',
  accent: '#F706CF', accentSecondary: '#06D6A0', text: '#E0FBFC', textSecondary: '#98C1D9',
  statusGreen: '#06D6A0', statusYellow: '#FFD166', statusRed: '#EF476F',
};

const sunsetColors: ThemeColors = {
  background: '#1A0E2E', buttonBackground: '#2D1B42', buttonBorder: '#4A2D60',
  accent: '#FF6B35', accentSecondary: '#F7C59F', text: '#EFEFEF', textSecondary: '#B0A0C0',
  statusGreen: '#6BCB77', statusYellow: '#FFD93D', statusRed: '#FF6B6B',
};

// ── v1.3.0 Pack Themes ──────────────────────
//
// Each pack ships with a matching theme so installing a pack also gives
// the deck a visual identity that fits the niche. Theme IDs match pack IDs
// (`chaos` ↔ Soundboard, `neon-rgb` ↔ OBS Streaming, `monokai` ↔ Coder,
// `lofi` ↔ Ableton/FL DAW packs).

const chaosColors: ThemeColors = {
  background: '#1A0033', buttonBackground: '#2D0066', buttonBorder: '#FF00AA',
  accent: '#FF00AA', accentSecondary: '#00FFD9', text: '#FFFFFF', textSecondary: '#FFAADD',
  statusGreen: '#00FFD9', statusYellow: '#FFEE00', statusRed: '#FF0066',
};

const neonRgbColors: ThemeColors = {
  background: '#0A0014', buttonBackground: '#16002D', buttonBorder: '#9D4EDD',
  accent: '#7B2FF7', accentSecondary: '#FF1493', text: '#F8F0FF', textSecondary: '#B79EFF',
  statusGreen: '#39FF14', statusYellow: '#FFFF00', statusRed: '#FF0040',
};

const monokaiColors: ThemeColors = {
  background: '#272822', buttonBackground: '#3E3D32', buttonBorder: '#75715E',
  accent: '#A6E22E', accentSecondary: '#F92672', text: '#F8F8F2', textSecondary: '#75715E',
  statusGreen: '#A6E22E', statusYellow: '#FD971F', statusRed: '#F92672',
};

const lofiColors: ThemeColors = {
  background: '#1F1A2E', buttonBackground: '#2D2540', buttonBorder: '#5C4F7C',
  accent: '#E5B0F9', accentSecondary: '#F4A261', text: '#F1ECEC', textSecondary: '#9C8FAE',
  statusGreen: '#A8DADC', statusYellow: '#F4A261', statusRed: '#E76F51',
};

// ── Light Themes ────────────────────────────

const daylightColors: ThemeColors = {
  background: '#F5F5F5', buttonBackground: '#FFFFFF', buttonBorder: '#E0E0E0',
  accent: '#2196F3', text: '#333333', textSecondary: '#777777',
  statusGreen: '#4CAF50', statusYellow: '#FF9800', statusRed: '#F44336',
};

const creamColors: ThemeColors = {
  background: '#FFF8F0', buttonBackground: '#FFFFFF', buttonBorder: '#F0E0D0',
  accent: '#E17055', text: '#2D3436', textSecondary: '#636E72',
  statusGreen: '#00B894', statusYellow: '#FDCB6E', statusRed: '#D63031',
};

const arcticColors: ThemeColors = {
  background: '#EDF2F7', buttonBackground: '#FFFFFF', buttonBorder: '#CBD5E0',
  accent: '#4299E1', accentSecondary: '#63B3ED', text: '#1A202C', textSecondary: '#718096',
  statusGreen: '#48BB78', statusYellow: '#ECC94B', statusRed: '#FC8181',
};

const mintColors: ThemeColors = {
  background: '#F0FFF4', buttonBackground: '#FFFFFF', buttonBorder: '#C6F6D5',
  accent: '#38A169', text: '#22543D', textSecondary: '#68D391',
  statusGreen: '#38A169', statusYellow: '#D69E2E', statusRed: '#E53E3E',
};

// ── Export ───────────────────────────────────

export const THEMES: Record<string, ThemeConfig> = {
  // Dark (free: obsidian only)
  obsidian:    { id: 'obsidian', name: 'Obsidian', colors: obsidianColors, iconPack: 'default' },
  // Dark (Pro)
  aurora:      { id: 'aurora', name: 'Aurora', colors: auroraColors, iconPack: 'default' },
  'retro-neon': { id: 'retro-neon', name: 'Retro Neon', colors: retroNeonColors, iconPack: 'default' },
  slate:       { id: 'slate', name: 'Slate', colors: slateColors, iconPack: 'default' },
  midnight:    { id: 'midnight', name: 'Midnight', colors: midnightColors, iconPack: 'default' },
  ocean:       { id: 'ocean', name: 'Ocean', colors: oceanColors, iconPack: 'default' },
  volcanic:    { id: 'volcanic', name: 'Volcanic', colors: volcanicColors, iconPack: 'default' },
  forest:      { id: 'forest', name: 'Forest', colors: forestColors, iconPack: 'default' },
  carbon:      { id: 'carbon', name: 'Carbon', colors: carbonColors, iconPack: 'default' },
  cyberpunk:   { id: 'cyberpunk', name: 'Cyberpunk', colors: cyberpunkColors, iconPack: 'default' },
  sunset:      { id: 'sunset', name: 'Sunset', colors: sunsetColors, iconPack: 'default' },
  // Light (Pro)
  daylight:    { id: 'daylight', name: 'Daylight', colors: daylightColors, iconPack: 'default' },
  cream:       { id: 'cream', name: 'Cream', colors: creamColors, iconPack: 'default' },
  arctic:      { id: 'arctic', name: 'Arctic', colors: arcticColors, iconPack: 'default' },
  mint:        { id: 'mint', name: 'Mint', colors: mintColors, iconPack: 'default' },
  // v1.3.0 Pack Themes (Pro) ────────────────────────────────────────
  chaos: {
    id: 'chaos', name: 'Chaos', colors: chaosColors, iconPack: 'default',
    tileShape: 'pill', accentGlow: '#FF00AA', mood: 'chaotic',
  },
  'neon-rgb': {
    id: 'neon-rgb', name: 'Neon RGB', colors: neonRgbColors, iconPack: 'default',
    tileShape: 'rounded', accentGlow: '#7B2FF7', mood: 'energetic',
  },
  monokai: {
    id: 'monokai', name: 'Monokai', colors: monokaiColors, iconPack: 'default',
    tileShape: 'square', mood: 'pro',
  },
  lofi: {
    id: 'lofi', name: 'Lo-Fi', colors: lofiColors, iconPack: 'default',
    tileShape: 'squircle', mood: 'calm',
  },
};

export const FREE_THEME_IDS = ['obsidian'] as const;

export const DEFAULT_THEME = 'obsidian';

export function isThemeFree(themeId: string): boolean {
  return FREE_THEME_IDS.includes(themeId as typeof FREE_THEME_IDS[number]);
}
