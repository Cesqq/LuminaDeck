import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  PanResponder,
  Dimensions,
} from 'react-native';
import type { ThemeColors } from '@luminadeck/shared';

interface ColorPickerProps {
  value: string;
  onChange: (hex: string) => void;
  colors: ThemeColors;
}

// Preset palette (expanded from 15 to 24)
const PRESETS = [
  '#0D0D0D', '#1A1A2E', '#16213E', '#0F3460', '#2196F3', '#00BCD4',
  '#4CAF50', '#8BC34A', '#CDDC39', '#FFC107', '#FF9800', '#FF5722',
  '#F44336', '#E91E63', '#9C27B0', '#673AB7', '#3F51B5', '#795548',
  '#607D8B', '#9E9E9E', '#FFFFFF', '#FF006E', '#00FF88', '#7B2FBE',
];

function hexToHsl(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;

  if (max === min) return [0, 0, l];

  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

  let h = 0;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;

  return [h, s, l];
}

function hslToHex(h: number, s: number, l: number): string {
  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };

  let r: number, g: number, b: number;
  if (s === 0) {
    r = g = b = l;
  } else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }

  const toHex = (n: number) => Math.round(n * 255).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
}

const STRIP_WIDTH = Dimensions.get('window').width - 80;
const STRIP_HEIGHT = 32;

export function ColorPicker({ value, onChange, colors }: ColorPickerProps) {
  const [hexInput, setHexInput] = useState(value);
  const [hsl, setHsl] = useState(() => hexToHsl(value));
  const stripRef = useRef<View>(null);

  const updateFromHue = useCallback((hue: number) => {
    const newHsl: [number, number, number] = [hue, hsl[1] || 0.7, hsl[2] || 0.5];
    setHsl(newHsl);
    const hex = hslToHex(newHsl[0], newHsl[1], newHsl[2]);
    setHexInput(hex);
    onChange(hex);
  }, [hsl, onChange]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => {
        const x = e.nativeEvent.locationX;
        updateFromHue(Math.max(0, Math.min(1, x / STRIP_WIDTH)));
      },
      onPanResponderMove: (e) => {
        const x = e.nativeEvent.locationX;
        updateFromHue(Math.max(0, Math.min(1, x / STRIP_WIDTH)));
      },
    })
  ).current;

  const handleHexSubmit = useCallback(() => {
    const clean = hexInput.startsWith('#') ? hexInput : `#${hexInput}`;
    if (/^#[0-9A-Fa-f]{6}$/.test(clean)) {
      const newHsl = hexToHsl(clean);
      setHsl(newHsl);
      onChange(clean.toUpperCase());
    }
  }, [hexInput, onChange]);

  const handlePresetSelect = useCallback((hex: string) => {
    setHexInput(hex);
    setHsl(hexToHsl(hex));
    onChange(hex);
  }, [onChange]);

  return (
    <View style={styles.container}>
      {/* Hue Strip */}
      <View style={styles.stripSection}>
        <Text style={[styles.label, { color: colors.textSecondary }]}>Hue</Text>
        <View
          ref={stripRef}
          style={styles.hueStrip}
          {...panResponder.panHandlers}
        >
          {/* Gradient rendered as discrete segments */}
          {Array.from({ length: 36 }, (_, i) => (
            <View
              key={i}
              style={{
                flex: 1,
                backgroundColor: hslToHex(i / 36, 0.8, 0.5),
              }}
            />
          ))}
          {/* Indicator */}
          <View
            style={[
              styles.hueIndicator,
              { left: hsl[0] * STRIP_WIDTH - 8 },
            ]}
          />
        </View>
      </View>

      {/* Hex Input */}
      <View style={styles.hexRow}>
        <Text style={[styles.label, { color: colors.textSecondary }]}>Hex</Text>
        <TextInput
          style={[styles.hexInput, { color: colors.text, borderColor: colors.buttonBorder }]}
          value={hexInput}
          onChangeText={setHexInput}
          onSubmitEditing={handleHexSubmit}
          onBlur={handleHexSubmit}
          placeholder="#000000"
          placeholderTextColor={colors.textSecondary}
          maxLength={7}
          autoCapitalize="characters"
          autoCorrect={false}
        />
        <View style={[styles.colorPreview, { backgroundColor: value }]} />
      </View>

      {/* Presets Grid */}
      <Text style={[styles.label, { color: colors.textSecondary, marginTop: 12 }]}>Presets</Text>
      <View style={styles.presetsGrid}>
        {PRESETS.map((hex) => (
          <TouchableOpacity
            key={hex}
            style={[
              styles.presetSwatch,
              {
                backgroundColor: hex,
                borderColor: value === hex ? colors.accent : colors.buttonBorder,
                borderWidth: value === hex ? 2 : 1,
              },
            ]}
            onPress={() => handlePresetSelect(hex)}
            accessibilityRole="button"
            accessibilityLabel={`Color ${hex}`}
            accessibilityState={{ selected: value === hex }}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 8,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
  },
  stripSection: {
    marginBottom: 4,
  },
  hueStrip: {
    width: STRIP_WIDTH,
    height: STRIP_HEIGHT,
    borderRadius: 8,
    flexDirection: 'row',
    overflow: 'hidden',
    position: 'relative',
  },
  hueIndicator: {
    position: 'absolute',
    top: -2,
    width: 16,
    height: STRIP_HEIGHT + 4,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    backgroundColor: 'transparent',
  },
  hexRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  hexInput: {
    flex: 1,
    height: 38,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    fontSize: 14,
    fontFamily: 'monospace',
  },
  colorPreview: {
    width: 38,
    height: 38,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  presetsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  presetSwatch: {
    width: 32,
    height: 32,
    borderRadius: 8,
  },
});
