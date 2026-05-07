/**
 * Smart Page (Phase B6) — separate surface showing the top predicted tiles
 * from the local Markov model. Per the UX judge mandate in the v2 plan,
 * this is a NAVIGABLE page, not an overlay on the crafted deck — so the
 * user's muscle memory on the Home grid stays intact.
 *
 * Opens as a modal from the HomeScreen top bar. Tapping a predicted tile
 * fires its action via the same WS execute path HomeScreen uses.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Dimensions,
} from 'react-native';
import type { Action, ButtonConfig, ProfileConfig } from '@luminadeck/shared';
import { ButtonCell } from '../components/ButtonCell';
import { useTheme } from '../contexts/ThemeContext';
import { useConnection } from '../contexts/ConnectionContext';
import { predictButtons, getSampleSize } from '../lib/predictor';

interface SmartPageScreenProps {
  profile: ProfileConfig | null;
  onClose: () => void;
}

export function SmartPageScreen({ profile, onClose }: SmartPageScreenProps) {
  const { colors } = useTheme();
  const { status, client } = useConnection();
  const [refreshKey, setRefreshKey] = useState(0);

  // Collect every button currently alive in the profile so predictions
  // that reference deleted tiles never surface.
  const allButtons: ButtonConfig[] = useMemo(() => {
    if (!profile) return [];
    return profile.pages.flatMap((p) => p.buttons);
  }, [profile]);

  const buttonsById = useMemo(() => {
    const m = new Map<string, ButtonConfig>();
    for (const b of allButtons) m.set(b.id, b);
    return m;
  }, [allButtons]);

  const aliveIds = useMemo(() => new Set(buttonsById.keys()), [buttonsById]);

  const predictions = useMemo(() => {
    const ids = predictButtons(6);
    return ids.map((id) => buttonsById.get(id)).filter((b): b is ButtonConfig => !!b);
    // Recompute when refreshKey or profile changes so post-press predictions
    // refresh without re-mounting the modal.
  }, [buttonsById, refreshKey]);

  // Refresh predictions every time the screen becomes visible in case the
  // user pressed tiles outside this modal (e.g., via Control Center widgets
  // once those ship — the predictor records via any call site).
  useEffect(() => {
    setRefreshKey((k) => k + 1);
  }, [profile]);

  const sampleSize = getSampleSize();

  const handlePress = useCallback(
    (button: ButtonConfig) => {
      if (!button.action) return;
      if (status !== 'connected') return;
      const msgId = `exec-smart-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      client.send({
        type: 'execute',
        id: msgId,
        action: button.action as Action,
      });
      setRefreshKey((k) => k + 1);
    },
    [status, client],
  );

  const screenWidth = Dimensions.get('window').width;
  const padding = 16;
  const gap = 8;
  const cols = 2;
  const cellSize = Math.floor((screenWidth - padding * 2 - gap * (cols - 1)) / cols);

  // aliveIds intentionally referenced here so the exclude set is built in
  // the render path even though predictButtons computes on its own. Keeps
  // the variable in scope for a future "smart across profiles" expansion.
  void aliveIds;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.headerRow}>
        <TouchableOpacity
          onPress={onClose}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          accessibilityRole="button"
          accessibilityLabel="Close Smart Page"
        >
          <Text style={[styles.backText, { color: colors.accent }]} allowFontScaling maxFontSizeMultiplier={1.5}>
            {'\u2190 Close'}
          </Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]} allowFontScaling maxFontSizeMultiplier={1.5}>
          Smart Page
        </Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding }}>
        <Text style={[styles.caption, { color: colors.textSecondary }]} allowFontScaling maxFontSizeMultiplier={1.5}>
          Top predictions based on your last {Math.min(sampleSize, 100)} press
          {sampleSize === 1 ? '' : 'es'}. Your main grid doesn't change.
        </Text>

        {predictions.length === 0 ? (
          <View style={[styles.emptyCard, { backgroundColor: colors.buttonBackground, borderColor: colors.buttonBorder }]}>
            <Text style={[styles.emptyTitle, { color: colors.text }]} allowFontScaling maxFontSizeMultiplier={1.5}>
              No predictions yet
            </Text>
            <Text style={[styles.emptyBody, { color: colors.textSecondary }]} allowFontScaling maxFontSizeMultiplier={1.5}>
              Use your deck for a while with Smart Page enabled, then check
              back. Predictions stay on this device.
            </Text>
          </View>
        ) : (
          <View style={[styles.grid, { gap }]}>
            {predictions.map((button) => (
              <ButtonCell
                key={button.id}
                button={button}
                size={cellSize}
                colors={colors}
                onPress={() => handlePress(button)}
              />
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  backText: { fontSize: 16, fontWeight: '600', width: 60 },
  headerTitle: { fontSize: 20, fontWeight: '800' },
  caption: { fontSize: 13, lineHeight: 18, marginBottom: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  emptyCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
  },
  emptyTitle: { fontSize: 16, fontWeight: '700', marginBottom: 6 },
  emptyBody: { fontSize: 13, lineHeight: 18 },
});
