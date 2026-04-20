import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  TextInput,
  Alert,
  StyleSheet,
  Modal,
} from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import { useProfiles } from '../contexts/ProfileContext';
import { usePro } from '../contexts/ProContext';

interface ProfileManagerScreenProps {
  visible: boolean;
  onClose: () => void;
}

export function ProfileManagerScreen({ visible, onClose }: ProfileManagerScreenProps) {
  const { colors } = useTheme();
  const { profiles, activeProfileId, setActiveProfile, createProfile, deleteProfile, duplicateProfile } = useProfiles();
  const { isPro, limits } = usePro();
  const [showNewInput, setShowNewInput] = useState(false);
  const [newName, setNewName] = useState('');

  const handleCreate = useCallback(() => {
    if (!newName.trim()) return;
    if (!isPro && profiles.length >= (limits.maxProfiles ?? 1)) {
      Alert.alert('Pro Required', 'Free accounts can only have 1 profile. Upgrade to Pro for up to 20 profiles.');
      return;
    }
    createProfile(newName.trim());
    setNewName('');
    setShowNewInput(false);
  }, [newName, isPro, profiles.length, limits, createProfile]);

  const handleDelete = useCallback((id: string, name: string) => {
    if (profiles.length <= 1) {
      Alert.alert('Cannot Delete', 'You must have at least one profile.');
      return;
    }
    Alert.alert(
      'Delete Profile',
      `Delete "${name}"? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => deleteProfile(id) },
      ],
    );
  }, [profiles.length, deleteProfile]);

  const handleDuplicate = useCallback((id: string) => {
    if (!isPro && profiles.length >= (limits.maxProfiles ?? 1)) {
      Alert.alert('Pro Required', 'Upgrade to Pro for more profiles.');
      return;
    }
    duplicateProfile(id);
  }, [isPro, profiles.length, limits, duplicateProfile]);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Text style={[styles.closeBtnText, { color: colors.text }]}>{'\u2715'}</Text>
          </TouchableOpacity>
          <Text style={[styles.title, { color: colors.text }]}>Profiles</Text>
          <TouchableOpacity
            onPress={() => setShowNewInput(true)}
            style={[styles.addBtn, { backgroundColor: colors.accent }]}
            accessibilityRole="button"
            accessibilityLabel="Create new profile"
          >
            <Text style={styles.addBtnText}>+ New</Text>
          </TouchableOpacity>
        </View>

        {/* New Profile Input */}
        {showNewInput && (
          <View style={[styles.newRow, { borderColor: colors.buttonBorder }]}>
            <TextInput
              style={[styles.newInput, { color: colors.text, borderColor: colors.buttonBorder }]}
              value={newName}
              onChangeText={setNewName}
              placeholder="Profile name..."
              placeholderTextColor={colors.textSecondary}
              autoFocus
              maxLength={32}
              onSubmitEditing={handleCreate}
            />
            <TouchableOpacity
              onPress={handleCreate}
              style={[styles.createBtn, { backgroundColor: colors.accent }]}
            >
              <Text style={styles.createBtnText}>Create</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => { setShowNewInput(false); setNewName(''); }}>
              <Text style={[styles.cancelText, { color: colors.textSecondary }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Profile List */}
        <FlatList
          data={profiles}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => {
            const isActive = item.id === activeProfileId;
            const pageCount = item.pages.length;
            const buttonCount = item.pages.reduce((sum, p) => sum + p.buttons.length, 0);

            return (
              <TouchableOpacity
                style={[
                  styles.profileCard,
                  {
                    backgroundColor: colors.buttonBackground,
                    borderColor: isActive ? colors.accent : colors.buttonBorder,
                    borderWidth: isActive ? 2 : 1,
                  },
                ]}
                onPress={() => setActiveProfile(item.id)}
                accessibilityRole="radio"
                accessibilityState={{ selected: isActive }}
                accessibilityLabel={`${item.name} profile${isActive ? ', active' : ''}`}
              >
                <View style={styles.profileInfo}>
                  <View style={styles.profileNameRow}>
                    <Text style={[styles.profileName, { color: colors.text }]}>{item.name}</Text>
                    {isActive && (
                      <View style={[styles.activeBadge, { backgroundColor: colors.accent }]}>
                        <Text style={styles.activeBadgeText}>ACTIVE</Text>
                      </View>
                    )}
                  </View>
                  <Text style={[styles.profileMeta, { color: colors.textSecondary }]}>
                    {pageCount} page{pageCount !== 1 ? 's' : ''} · {buttonCount} button{buttonCount !== 1 ? 's' : ''} · {item.theme}
                  </Text>
                </View>

                <View style={styles.profileActions}>
                  <TouchableOpacity
                    onPress={() => handleDuplicate(item.id)}
                    style={styles.actionBtn}
                    accessibilityLabel={`Duplicate ${item.name}`}
                  >
                    <Text style={[styles.actionBtnText, { color: colors.accent }]}>Copy</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => handleDelete(item.id, item.name)}
                    style={styles.actionBtn}
                    accessibilityLabel={`Delete ${item.name}`}
                  >
                    <Text style={[styles.actionBtnText, { color: colors.statusRed }]}>Delete</Text>
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            );
          }}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12,
  },
  closeBtn: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
  closeBtnText: { fontSize: 18, fontWeight: '600' },
  title: { fontSize: 18, fontWeight: '700' },
  addBtn: { borderRadius: 8, paddingHorizontal: 14, paddingVertical: 7 },
  addBtnText: { color: '#FFF', fontSize: 13, fontWeight: '700' },
  newRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1,
  },
  newInput: { flex: 1, height: 38, borderRadius: 8, borderWidth: 1, paddingHorizontal: 12, fontSize: 14 },
  createBtn: { borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 },
  createBtnText: { color: '#FFF', fontSize: 13, fontWeight: '700' },
  cancelText: { fontSize: 13, fontWeight: '600', paddingHorizontal: 8 },
  list: { padding: 16, gap: 10 },
  profileCard: { borderRadius: 12, padding: 14 },
  profileInfo: { marginBottom: 8 },
  profileNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  profileName: { fontSize: 16, fontWeight: '700' },
  activeBadge: { borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  activeBadgeText: { color: '#FFF', fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },
  profileMeta: { fontSize: 12 },
  profileActions: { flexDirection: 'row', gap: 16 },
  actionBtn: { paddingVertical: 4 },
  actionBtnText: { fontSize: 13, fontWeight: '600' },
});
