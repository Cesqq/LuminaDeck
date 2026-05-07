import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
} from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import { useProfiles } from '../contexts/ProfileContext';
import type { GridLayout, PageConfig } from '@luminadeck/shared';

interface PagesScreenProps {
  onBack: () => void;
}

const LAYOUT_OPTIONS: GridLayout[] = ['2x4', '3x4', '4x5', '5x3', '8x4', '8x8'];

export function PagesScreen({ onBack }: PagesScreenProps) {
  const { colors } = useTheme();
  const { activeProfile, updateProfile } = useProfiles();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');

  const pages = activeProfile?.pages ?? [];

  const persistPages = useCallback(
    (nextPages: PageConfig[]) => {
      if (!activeProfile) return;
      updateProfile({ ...activeProfile, pages: nextPages });
    },
    [activeProfile, updateProfile],
  );

  const addPage = useCallback(
    (layout: GridLayout) => {
      if (!activeProfile) return;
      const page: PageConfig = {
        id: 'page-' + Date.now().toString(36),
        name: `Page ${pages.length + 1}`,
        buttons: [],
        layout,
      };
      persistPages([...pages, page]);
    },
    [activeProfile, pages, persistPages],
  );

  const renamePage = useCallback(
    (id: string, name: string) => {
      if (!name.trim()) return;
      persistPages(pages.map((p) => (p.id === id ? { ...p, name: name.trim() } : p)));
      setEditingId(null);
    },
    [pages, persistPages],
  );

  const deletePage = useCallback(
    (id: string) => {
      if (pages.length <= 1) {
        Alert.alert('Keep at least one page', 'Your deck needs one page minimum.');
        return;
      }
      Alert.alert('Delete page?', 'All tiles on this page will be removed.', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => persistPages(pages.filter((p) => p.id !== id)),
        },
      ]);
    },
    [pages, persistPages],
  );

  const movePage = useCallback(
    (id: string, dir: -1 | 1) => {
      const idx = pages.findIndex((p) => p.id === id);
      if (idx === -1) return;
      const swapIdx = idx + dir;
      if (swapIdx < 0 || swapIdx >= pages.length) return;
      const copy = pages.slice();
      [copy[idx], copy[swapIdx]] = [copy[swapIdx], copy[idx]];
      persistPages(copy);
    },
    [pages, persistPages],
  );

  const changeLayout = useCallback(
    (id: string, layout: GridLayout) => {
      persistPages(pages.map((p) => (p.id === id ? { ...p, layout } : p)));
    },
    [pages, persistPages],
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { borderBottomColor: colors.buttonBorder }]}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn} accessibilityLabel="Back">
          <Text style={[styles.backIcon, { color: colors.text }]}>‹</Text>
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text }]}>Pages</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={[styles.intro, { color: colors.textSecondary }]}>
          {pages.length} page{pages.length === 1 ? '' : 's'} in "{activeProfile?.name ?? '—'}". Swipe between pages on the deck view. Each page has its own grid layout.
        </Text>

        {pages.map((page, idx) => {
          const editing = editingId === page.id;
          return (
            <View
              key={page.id}
              style={[styles.card, { backgroundColor: colors.buttonBackground, borderColor: colors.buttonBorder }]}
            >
              <View style={styles.cardRow}>
                {editing ? (
                  <TextInput
                    value={draft}
                    onChangeText={setDraft}
                    autoFocus
                    onBlur={() => renamePage(page.id, draft)}
                    onSubmitEditing={() => renamePage(page.id, draft)}
                    style={[styles.nameInput, { color: colors.text, borderColor: colors.accent }]}
                  />
                ) : (
                  <TouchableOpacity
                    onPress={() => {
                      setEditingId(page.id);
                      setDraft(page.name);
                    }}
                    style={{ flex: 1 }}
                  >
                    <Text style={[styles.name, { color: colors.text }]}>{page.name}</Text>
                    <Text style={[styles.meta, { color: colors.textSecondary }]}>
                      {page.buttons.length} tile{page.buttons.length === 1 ? '' : 's'} · layout {page.layout}
                    </Text>
                  </TouchableOpacity>
                )}
                <View style={styles.orderBtns}>
                  <TouchableOpacity
                    onPress={() => movePage(page.id, -1)}
                    disabled={idx === 0}
                    style={[styles.orderBtn, { borderColor: colors.buttonBorder, opacity: idx === 0 ? 0.3 : 1 }]}
                  >
                    <Text style={{ color: colors.text }}>↑</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => movePage(page.id, 1)}
                    disabled={idx === pages.length - 1}
                    style={[styles.orderBtn, { borderColor: colors.buttonBorder, opacity: idx === pages.length - 1 ? 0.3 : 1 }]}
                  >
                    <Text style={{ color: colors.text }}>↓</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.layoutRow}>
                <Text style={[styles.layoutLabel, { color: colors.textSecondary }]}>Layout</Text>
                <View style={styles.layoutChips}>
                  {LAYOUT_OPTIONS.map((l) => {
                    const active = page.layout === l;
                    return (
                      <TouchableOpacity
                        key={l}
                        onPress={() => changeLayout(page.id, l)}
                        style={[
                          styles.chip,
                          {
                            borderColor: active ? colors.accent : colors.buttonBorder,
                            backgroundColor: active ? colors.accent + '22' : 'transparent',
                          },
                        ]}
                      >
                        <Text
                          style={{
                            color: active ? colors.accent : colors.textSecondary,
                            fontSize: 11,
                            fontWeight: '700',
                          }}
                        >
                          {l}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              <TouchableOpacity onPress={() => deletePage(page.id)} style={styles.deleteBtn}>
                <Text style={[styles.deleteText, { color: colors.statusRed }]}>Delete page</Text>
              </TouchableOpacity>
            </View>
          );
        })}

        <TouchableOpacity
          onPress={() => addPage('3x4')}
          style={[styles.addBtn, { borderColor: colors.accent }]}
        >
          <Text style={[styles.addText, { color: colors.accent }]}>+ New page (3×4)</Text>
        </TouchableOpacity>
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
  scroll: { padding: 16, gap: 12 },
  intro: { fontSize: 12, lineHeight: 17, marginBottom: 8 },
  card: { padding: 12, borderRadius: 12, borderWidth: 1, gap: 10 },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { fontSize: 15, fontWeight: '700' },
  meta: { fontSize: 11, marginTop: 2 },
  nameInput: {
    flex: 1,
    borderBottomWidth: 1,
    paddingVertical: 4,
    fontSize: 15,
    fontWeight: '700',
  },
  orderBtns: { flexDirection: 'row', gap: 4 },
  orderBtn: {
    width: 30,
    height: 30,
    borderWidth: 1,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  layoutRow: { gap: 6 },
  layoutLabel: { fontSize: 11, fontWeight: '600' },
  layoutChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
  },
  deleteBtn: { alignSelf: 'flex-start' },
  deleteText: { fontSize: 11, fontWeight: '600' },
  addBtn: {
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
    alignItems: 'center',
  },
  addText: { fontSize: 13, fontWeight: '700' },
});
