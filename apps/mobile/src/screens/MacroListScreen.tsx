import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Alert,
  Animated,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { MacroConfig } from '@luminadeck/shared';
import { useTheme } from '../contexts/ThemeContext';
import { MacroEditorScreen } from './MacroEditorScreen';

// --- Storage key ---

const MACROS_STORAGE_KEY = '@luminadeck/macros';

// --- Persistence helpers ---

async function loadMacros(): Promise<MacroConfig[]> {
  try {
    const raw = await AsyncStorage.getItem(MACROS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {
    // Corrupted — return empty
  }
  return [];
}

async function saveMacros(macros: MacroConfig[]): Promise<void> {
  await AsyncStorage.setItem(MACROS_STORAGE_KEY, JSON.stringify(macros));
}

// --- Helpers ---

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  } catch {
    return '';
  }
}

// --- Props ---

interface MacroListScreenProps {
  onClose: () => void;
}

// --- Component ---

export function MacroListScreen({ onClose }: MacroListScreenProps) {
  const { colors } = useTheme();
  const [macros, setMacros] = useState<MacroConfig[]>([]);
  const [editingMacro, setEditingMacro] = useState<MacroConfig | 'new' | null>(null);
  const [loaded, setLoaded] = useState(false);

  // Load on mount
  useEffect(() => {
    loadMacros().then((m) => {
      setMacros(m);
      setLoaded(true);
    });
  }, []);

  // Save whenever macros change (after initial load)
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    if (loaded) {
      saveMacros(macros);
    }
  }, [macros, loaded]);

  const handleSaveMacro = useCallback((macro: MacroConfig) => {
    setMacros((prev) => {
      const idx = prev.findIndex((m) => m.id === macro.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = macro;
        return next;
      }
      return [...prev, macro];
    });
    setEditingMacro(null);
  }, []);

  const handleDeleteMacro = useCallback((id: string, name: string) => {
    Alert.alert(
      'Delete Macro',
      `Are you sure you want to delete "${name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            setMacros((prev) => prev.filter((m) => m.id !== id));
          },
        },
      ],
    );
  }, []);

  // --- If editing, show editor ---
  if (editingMacro !== null) {
    return (
      <MacroEditorScreen
        macro={editingMacro === 'new' ? undefined : editingMacro}
        onSave={handleSaveMacro}
        onCancel={() => setEditingMacro(null)}
      />
    );
  }

  // --- List screen ---

  const renderItem = ({ item }: { item: MacroConfig }) => (
    <TouchableOpacity
      style={[
        styles.macroCard,
        {
          backgroundColor: colors.buttonBackground,
          borderColor: colors.buttonBorder,
        },
      ]}
      onPress={() => setEditingMacro(item)}
      accessibilityRole="button"
      accessibilityLabel={`Edit macro: ${item.name}`}
    >
      <View style={styles.macroInfo}>
        <Text
          style={[styles.macroName, { color: colors.text }]}
          numberOfLines={1}
          allowFontScaling
          maxFontSizeMultiplier={1.5}
        >
          {item.name}
        </Text>
        <Text
          style={[styles.macroMeta, { color: colors.textSecondary }]}
          allowFontScaling
          maxFontSizeMultiplier={1.5}
        >
          {item.steps.length} step{item.steps.length !== 1 ? 's' : ''}
          {item.updatedAt ? ` \u00B7 ${formatDate(item.updatedAt)}` : ''}
        </Text>
        {item.description ? (
          <Text
            style={[styles.macroDesc, { color: colors.textSecondary }]}
            numberOfLines={1}
            allowFontScaling
            maxFontSizeMultiplier={1.5}
          >
            {item.description}
          </Text>
        ) : null}
      </View>
      <TouchableOpacity
        style={styles.deleteBtn}
        onPress={() => handleDeleteMacro(item.id, item.name)}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        accessibilityRole="button"
        accessibilityLabel={`Delete macro ${item.name}`}
      >
        <Text style={[styles.deleteIcon, { color: colors.statusRed }]}>{'\u00D7'}</Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );

  const renderEmpty = () => (
    <View style={[styles.emptyContainer, { borderColor: colors.buttonBorder }]}>
      <Text
        style={[styles.emptyTitle, { color: colors.text }]}
        allowFontScaling
        maxFontSizeMultiplier={1.5}
      >
        No Macros Yet
      </Text>
      <Text
        style={[styles.emptySubtitle, { color: colors.textSecondary }]}
        allowFontScaling
        maxFontSizeMultiplier={1.5}
      >
        Create a macro to automate sequences of actions like key combos, delays, and loops.
      </Text>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close macros"
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Text
            style={[styles.headerAction, { color: colors.textSecondary }]}
            allowFontScaling
            maxFontSizeMultiplier={1.5}
          >
            Close
          </Text>
        </TouchableOpacity>
        <Text
          style={[styles.headerTitle, { color: colors.text }]}
          allowFontScaling
          maxFontSizeMultiplier={1.5}
        >
          Macros
        </Text>
        <TouchableOpacity
          onPress={() => setEditingMacro('new')}
          accessibilityRole="button"
          accessibilityLabel="Create new macro"
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Text
            style={[styles.headerAction, { color: colors.accent, fontWeight: '700' }]}
            allowFontScaling
            maxFontSizeMultiplier={1.5}
          >
            + New
          </Text>
        </TouchableOpacity>
      </View>

      {/* List */}
      <FlatList
        data={macros}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        ListEmptyComponent={loaded ? renderEmpty : null}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

// --- Styles ---

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  headerAction: {
    fontSize: 16,
    fontWeight: '600',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },

  // --- Macro card ---
  macroCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },
  macroInfo: {
    flex: 1,
    marginRight: 10,
  },
  macroName: {
    fontSize: 15,
    fontWeight: '700',
  },
  macroMeta: {
    fontSize: 12,
    marginTop: 2,
  },
  macroDesc: {
    fontSize: 12,
    marginTop: 3,
    fontStyle: 'italic',
  },
  deleteBtn: {
    paddingHorizontal: 4,
  },
  deleteIcon: {
    fontSize: 24,
    fontWeight: '700',
    lineHeight: 24,
  },

  // --- Empty state ---
  emptyContainer: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    marginTop: 40,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
});
