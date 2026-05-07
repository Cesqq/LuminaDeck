import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
} from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import { useConnection } from '../contexts/ConnectionContext';
import { useProfiles } from '../contexts/ProfileContext';
import type { ProfileSwitchRule } from '@luminadeck/shared';

interface AutoProfileScreenProps {
  onBack: () => void;
}

export function AutoProfileScreen({ onBack }: AutoProfileScreenProps) {
  const { colors } = useTheme();
  const { client, status } = useConnection();
  const { profiles } = useProfiles();
  const [rules, setRules] = useState<ProfileSwitchRule[]>([]);
  const [showProfilePicker, setShowProfilePicker] = useState<number | null>(null);

  // Local-only edits — on save, push the full list to the companion which
  // replaces its global ruleset and persists. The companion is the source
  // of truth: matcher runs there.
  const dirty = useMemo(() => true, []);

  useEffect(() => {
    if (status !== 'connected') return;
  }, [status]);

  const addRule = useCallback(() => {
    setRules((rs) => [...rs, { processName: '', profileId: profiles[0]?.id ?? '' }]);
  }, [profiles]);

  const removeRule = useCallback((idx: number) => {
    setRules((rs) => rs.filter((_, i) => i !== idx));
  }, []);

  const updateRule = useCallback((idx: number, patch: Partial<ProfileSwitchRule>) => {
    setRules((rs) => rs.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  }, []);

  const saveToCompanion = useCallback(() => {
    if (status !== 'connected') return;
    const clean = rules.filter((r) => r.processName.trim() && r.profileId.trim());
    client.send({ type: 'profile_sync', rules: clean });
  }, [client, rules, status]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { borderBottomColor: colors.buttonBorder }]}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn} accessibilityLabel="Back">
          <Text style={[styles.backIcon, { color: colors.text }]}>‹</Text>
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text }]}>Auto-Switch</Text>
        <TouchableOpacity
          onPress={saveToCompanion}
          style={[styles.saveBtn, { borderColor: colors.accent }]}
          disabled={status !== 'connected'}
        >
          <Text style={[styles.saveText, { color: status === 'connected' ? colors.accent : colors.textSecondary }]}>
            Push
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={[styles.intro, { color: colors.textSecondary }]}>
          Bind PC processes to profiles. When the bound app comes to the foreground on your PC, your phone switches to that profile automatically. Tap "Push" to save the list to the companion.
        </Text>

        {rules.map((rule, idx) => {
          const profile = profiles.find((p) => p.id === rule.profileId);
          return (
            <View
              key={idx}
              style={[styles.ruleCard, { backgroundColor: colors.buttonBackground, borderColor: colors.buttonBorder }]}
            >
              <View style={styles.ruleField}>
                <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Process name</Text>
                <TextInput
                  value={rule.processName}
                  onChangeText={(v) => updateRule(idx, { processName: v })}
                  placeholder="chrome.exe"
                  placeholderTextColor={colors.textSecondary}
                  autoCapitalize="none"
                  autoCorrect={false}
                  style={[styles.input, { color: colors.text, borderColor: colors.buttonBorder, backgroundColor: colors.background }]}
                />
              </View>

              <View style={styles.ruleField}>
                <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Profile</Text>
                <TouchableOpacity
                  onPress={() => setShowProfilePicker(showProfilePicker === idx ? null : idx)}
                  style={[styles.input, { borderColor: colors.buttonBorder, backgroundColor: colors.background, justifyContent: 'center' }]}
                >
                  <Text style={{ color: profile ? colors.text : colors.textSecondary, fontSize: 13 }}>
                    {profile?.name ?? rule.profileId ?? 'Pick profile…'}
                  </Text>
                </TouchableOpacity>

                {showProfilePicker === idx && (
                  <View style={[styles.picker, { borderColor: colors.buttonBorder, backgroundColor: colors.buttonBackground }]}>
                    {profiles.length === 0 ? (
                      <Text style={[styles.pickerEmpty, { color: colors.textSecondary }]}>
                        No profiles yet — create one in the deck first.
                      </Text>
                    ) : (
                      profiles.map((p) => (
                        <TouchableOpacity
                          key={p.id}
                          style={[styles.pickerRow, { borderBottomColor: colors.buttonBorder }]}
                          onPress={() => {
                            updateRule(idx, { profileId: p.id });
                            setShowProfilePicker(null);
                          }}
                        >
                          <Text style={{ color: colors.text, fontSize: 13 }}>{p.name}</Text>
                          <Text style={{ color: colors.textSecondary, fontSize: 10, marginTop: 2 }}>{p.id}</Text>
                        </TouchableOpacity>
                      ))
                    )}
                  </View>
                )}
              </View>

              <TouchableOpacity onPress={() => removeRule(idx)} style={styles.removeBtn}>
                <Text style={[styles.removeText, { color: colors.statusRed }]}>Remove rule</Text>
              </TouchableOpacity>
            </View>
          );
        })}

        <TouchableOpacity
          onPress={addRule}
          style={[styles.addBtn, { borderColor: colors.accent }]}
        >
          <Text style={[styles.addText, { color: colors.accent }]}>+ Add rule</Text>
        </TouchableOpacity>

        {status !== 'connected' && (
          <Text style={[styles.warn, { color: colors.statusYellow }]}>
            Connect to your PC to push rules.
          </Text>
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
  saveBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
  },
  saveText: { fontSize: 12, fontWeight: '700' },
  scroll: { padding: 16, gap: 12 },
  intro: { fontSize: 12, lineHeight: 17, marginBottom: 8 },
  ruleCard: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    gap: 10,
  },
  ruleField: { gap: 4 },
  fieldLabel: { fontSize: 11, fontWeight: '600' },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
    minHeight: 36,
  },
  picker: {
    marginTop: 4,
    borderWidth: 1,
    borderRadius: 8,
    overflow: 'hidden',
    maxHeight: 200,
  },
  pickerEmpty: { padding: 12, fontSize: 12, textAlign: 'center' },
  pickerRow: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  removeBtn: { alignSelf: 'flex-start', paddingTop: 4 },
  removeText: { fontSize: 11, fontWeight: '600' },
  addBtn: {
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
    alignItems: 'center',
  },
  addText: { fontSize: 13, fontWeight: '700' },
  warn: { fontSize: 11, textAlign: 'center', marginTop: 8 },
});
