import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import { useConnection } from '../contexts/ConnectionContext';
import type { CompanionCapability } from '@luminadeck/shared';

interface PluginsScreenProps {
  onBack: () => void;
}

const PLUGIN_META: Record<string, { name: string; icon: string; desc: string }> = {
  obs: { name: 'OBS Studio', icon: '🎬', desc: 'Scene switch, record, stream control' },
  discord: { name: 'Discord', icon: '💬', desc: 'Mute / deafen via hotkeys' },
  window_monitor: { name: 'Window Monitor', icon: '🪟', desc: 'Detects active app for auto-switch' },
  auto_profile: { name: 'Auto-Profile', icon: '⇄', desc: 'Switches profile when an app gains focus' },
  macro: { name: 'Macro Engine', icon: '🎯', desc: 'Multi-step macros with delays' },
};

export function PluginsScreen({ onBack }: PluginsScreenProps) {
  const { colors } = useTheme();
  const { client, status } = useConnection();
  const [capabilities, setCapabilities] = useState<CompanionCapability[]>([]);
  const [requested, setRequested] = useState(false);

  useEffect(() => {
    if (status !== 'connected' || requested) return;
    setRequested(true);
    client.send({ type: 'request_capabilities' });
  }, [status, requested, client]);

  useEffect(() => {
    const unsub = client.onMessage((msg) => {
      if (msg.type === 'hello_ack' || msg.type === 'capabilities') {
        setCapabilities((msg as any).capabilities ?? []);
      }
    });
    return unsub;
  }, [client]);

  const knownPluginIds = ['obs', 'discord', 'window_monitor', 'auto_profile', 'macro'];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { borderBottomColor: colors.buttonBorder }]}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn} accessibilityLabel="Back">
          <Text style={[styles.backIcon, { color: colors.text }]}>‹</Text>
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text }]}>Plugins</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={[styles.intro, { color: colors.textSecondary }]}>
          Plugins are configured on your PC in LuminaDeck Studio → Plugins. This view shows what the connected companion advertises.
        </Text>

        {status !== 'connected' ? (
          <Text style={[styles.empty, { color: colors.textSecondary }]}>Not connected.</Text>
        ) : capabilities.length === 0 ? (
          <Text style={[styles.empty, { color: colors.textSecondary }]}>Loading capabilities…</Text>
        ) : (
          <>
            {knownPluginIds.map((id) => {
              const meta = PLUGIN_META[id];
              const enabled = capabilities.includes(id as CompanionCapability);
              return (
                <View
                  key={id}
                  style={[styles.row, { backgroundColor: colors.buttonBackground, borderColor: colors.buttonBorder }]}
                >
                  <Text style={styles.icon}>{meta.icon}</Text>
                  <View style={styles.rowBody}>
                    <Text style={[styles.rowName, { color: colors.text }]}>{meta.name}</Text>
                    <Text style={[styles.rowDesc, { color: colors.textSecondary }]}>{meta.desc}</Text>
                  </View>
                  <View
                    style={[
                      styles.badge,
                      {
                        backgroundColor: enabled ? colors.statusGreen + '33' : colors.buttonBackground,
                        borderColor: enabled ? colors.statusGreen : colors.buttonBorder,
                      },
                    ]}
                  >
                    <Text style={[styles.badgeText, { color: enabled ? colors.statusGreen : colors.textSecondary }]}>
                      {enabled ? 'Available' : 'Off'}
                    </Text>
                  </View>
                </View>
              );
            })}

            <Text style={[styles.intro, { color: colors.textSecondary, marginTop: 16 }]}>
              All capabilities reported: {capabilities.join(', ')}
            </Text>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  backBtn: { padding: 8 },
  backIcon: { fontSize: 28, fontWeight: '300' },
  title: { fontSize: 17, fontWeight: '600', flex: 1, textAlign: 'center' },
  headerSpacer: { width: 36 },
  scroll: { padding: 16, gap: 10 },
  intro: { fontSize: 13, lineHeight: 18, marginBottom: 12 },
  empty: { fontSize: 13, textAlign: 'center', paddingVertical: 24 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    gap: 12,
  },
  icon: { fontSize: 22, width: 32, textAlign: 'center' },
  rowBody: { flex: 1 },
  rowName: { fontSize: 14, fontWeight: '600' },
  rowDesc: { fontSize: 11, marginTop: 2 },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
  },
  badgeText: { fontSize: 10, fontWeight: '700' },
});
