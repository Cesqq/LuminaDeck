import type { ThemeId, ThemeConfig, ThemeColors } from '@luminadeck/shared';

const obsidianColors: ThemeColors = {
  background: '#0D0D0D',
  buttonBackground: '#1A1A2E',
  buttonBorder: '#16213E',
  accent: '#0F3460',
  text: '#E0E0E0',
  textSecondary: '#888888',
  statusGreen: '#4CAF50',
  statusYellow: '#FFC107',
  statusRed: '#F44336',
};

const auroraColors: ThemeColors = {
  background: '#0B0B1A',
  buttonBackground: '#1B1B3A',
  buttonBorder: '#2D1B69',
  accent: '#7B2FBE',
  accentSecondary: '#00D4FF',
  text: '#E8E8F0',
  textSecondary: '#9090B0',
  statusGreen: '#4CAF50',
  statusYellow: '#FFC107',
  statusRed: '#F44336',
};

const daylightColors: ThemeColors = {
  background: '#F5F5F5',
  buttonBackground: '#FFFFFF',
  buttonBorder: '#E0E0E0',
  accent: '#2196F3',
  text: '#333333',
  textSecondary: '#777777',
  statusGreen: '#4CAF50',
  statusYellow: '#FF9800',
  statusRed: '#F44336',
};

const retroNeonColors: ThemeColors = {
  background: '#0A0A0A',
  buttonBackground: '#1A0A2E',
  buttonBorder: '#FF006E',
  accent: '#FF006E',
  accentSecondary: '#00FF88',
  text: '#FFD600',
  textSecondary: '#FF006E',
  statusGreen: '#00FF88',
  statusYellow: '#FFD600',
  statusRed: '#FF006E',
};

const slateColors: ThemeColors = {
  background: '#1E1E1E',
  buttonBackground: '#2D2D2D',
  buttonBorder: '#3D3D3D',
  accent: '#4CAF50',
  text: '#B0B0B0',
  textSecondary: '#707070',
  statusGreen: '#4CAF50',
  statusYellow: '#FFC107',
  statusRed: '#F44336',
};

export const THEMES: Record<ThemeId, ThemeConfig> = {
  obsidian: { id: 'obsidian', name: 'Obsidian', colors: obsidianColors, iconPack: 'obsidian' },
  aurora: { id: 'aurora', name: 'Aurora', colors: auroraColors, iconPack: 'aurora' },
  daylight: { id: 'daylight', name: 'Daylight', colors: daylightColors, iconPack: 'daylight' },
  'retro-neon': { id: 'retro-neon', name: 'Retro Neon', colors: retroNeonColors, iconPack: 'retro-neon' },
  slate: { id: 'slate', name: 'Slate', colors: slateColors, iconPack: 'slate' },
};

export const DEFAULT_THEME: ThemeId = 'obsidian';
