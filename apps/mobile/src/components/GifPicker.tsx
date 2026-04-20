import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  Image,
  StyleSheet,
  ActivityIndicator,
  Modal,
  Dimensions,
} from 'react-native';
import type { ThemeColors } from '@luminadeck/shared';

const GIPHY_API_KEY = process.env.EXPO_PUBLIC_GIPHY_API_KEY ?? '';
const GIPHY_BASE = 'https://api.giphy.com/v1/gifs';
const PAGE_SIZE = 25;

interface GifResult {
  id: string;
  title: string;
  url: string; // fixed_width URL
  width: number;
  height: number;
}

interface GifPickerProps {
  visible: boolean;
  colors: ThemeColors;
  onSelect: (gifUrl: string) => void;
  onClose: () => void;
}

export function GifPicker({ visible, colors, onSelect, onClose }: GifPickerProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<GifResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load trending on open
  useEffect(() => {
    if (visible && results.length === 0) {
      void fetchTrending();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const fetchTrending = useCallback(async () => {
    if (!GIPHY_API_KEY) {
      console.warn('[GifPicker] No GIPHY_API_KEY configured');
      return;
    }
    setLoading(true);
    try {
      const resp = await fetch(
        `${GIPHY_BASE}/trending?api_key=${GIPHY_API_KEY}&limit=${PAGE_SIZE}&offset=0&rating=g`,
      );
      const data = await resp.json();
      setResults(mapResults(data.data));
      setOffset(PAGE_SIZE);
      setHasMore(data.pagination?.total_count > PAGE_SIZE);
    } catch (e) {
      console.error('[GifPicker] Trending fetch failed:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchSearch = useCallback(async (q: string, off: number = 0) => {
    if (!GIPHY_API_KEY || !q.trim()) return;
    setLoading(true);
    try {
      const resp = await fetch(
        `${GIPHY_BASE}/search?api_key=${GIPHY_API_KEY}&q=${encodeURIComponent(q)}&limit=${PAGE_SIZE}&offset=${off}&rating=g`,
      );
      const data = await resp.json();
      const mapped = mapResults(data.data);
      if (off === 0) {
        setResults(mapped);
      } else {
        setResults((prev) => [...prev, ...mapped]);
      }
      setOffset(off + PAGE_SIZE);
      setHasMore(data.pagination?.total_count > off + PAGE_SIZE);
    } catch (e) {
      console.error('[GifPicker] Search failed:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSearch = useCallback((text: string) => {
    setQuery(text);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      if (text.trim()) {
        setOffset(0);
        fetchSearch(text, 0);
      } else {
        fetchTrending();
      }
    }, 400);
  }, [fetchSearch, fetchTrending]);

  const handleLoadMore = useCallback(() => {
    if (loading || !hasMore) return;
    if (query.trim()) {
      fetchSearch(query, offset);
    }
  }, [loading, hasMore, query, offset, fetchSearch]);

  const handleSelect = useCallback((gif: GifResult) => {
    onSelect(gif.url);
    onClose();
  }, [onSelect, onClose]);

  const renderGif = useCallback(({ item }: { item: GifResult }) => (
    <TouchableOpacity
      style={[styles.gifCard, { backgroundColor: colors.buttonBackground }]}
      onPress={() => handleSelect(item)}
      accessibilityRole="button"
      accessibilityLabel={item.title || 'GIF'}
    >
      <Image
        source={{ uri: item.url }}
        style={styles.gifImage}
        resizeMode="cover"
      />
    </TouchableOpacity>
  ), [colors, handleSelect]);

  const { width } = Dimensions.get('window');
  const numColumns = 3;
  const cardSize = (width - 48 - 16) / numColumns;

  if (!GIPHY_API_KEY) {
    return (
      <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
        <View style={[styles.container, { backgroundColor: colors.background }]}>
          <View style={styles.header}>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Text style={[styles.closeBtnText, { color: colors.text }]}>{'\u2715'}</Text>
            </TouchableOpacity>
            <Text style={[styles.title, { color: colors.text }]}>GIF Icons</Text>
            <View style={styles.closeBtn} />
          </View>
          <View style={styles.emptyState}>
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              Giphy API key not configured. Add EXPO_PUBLIC_GIPHY_API_KEY to your environment.
            </Text>
          </View>
        </View>
      </Modal>
    );
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Text style={[styles.closeBtnText, { color: colors.text }]}>{'\u2715'}</Text>
          </TouchableOpacity>
          <Text style={[styles.title, { color: colors.text }]}>Choose a GIF</Text>
          <View style={styles.closeBtn} />
        </View>

        {/* Search */}
        <View style={styles.searchRow}>
          <TextInput
            style={[styles.searchInput, { color: colors.text, borderColor: colors.buttonBorder, backgroundColor: colors.buttonBackground }]}
            value={query}
            onChangeText={handleSearch}
            placeholder="Search Giphy..."
            placeholderTextColor={colors.textSecondary}
            autoCorrect={false}
            returnKeyType="search"
          />
        </View>

        {/* Grid */}
        <FlatList
          data={results}
          renderItem={renderGif}
          keyExtractor={(item) => item.id}
          numColumns={numColumns}
          contentContainerStyle={styles.grid}
          columnWrapperStyle={{ gap: 8 }}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.5}
          ListFooterComponent={loading ? <ActivityIndicator color={colors.accent} style={{ padding: 16 }} /> : null}
          ListEmptyComponent={
            !loading ? (
              <View style={styles.emptyState}>
                <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                  {query ? 'No GIFs found' : 'Loading trending GIFs...'}
                </Text>
              </View>
            ) : null
          }
        />

        {/* Giphy attribution */}
        <View style={styles.attribution}>
          <Text style={[styles.attributionText, { color: colors.textSecondary }]}>
            Powered by GIPHY
          </Text>
        </View>
      </View>
    </Modal>
  );
}

function mapResults(data: any[]): GifResult[] {
  return (data ?? []).map((gif: any) => ({
    id: gif.id,
    title: gif.title ?? '',
    url: gif.images?.fixed_width?.url ?? gif.images?.original?.url ?? '',
    width: parseInt(gif.images?.fixed_width?.width ?? '200', 10),
    height: parseInt(gif.images?.fixed_width?.height ?? '200', 10),
  })).filter((g) => g.url);
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  closeBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeBtnText: {
    fontSize: 18,
    fontWeight: '600',
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
  },
  searchRow: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  searchInput: {
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 14,
    fontSize: 15,
  },
  grid: {
    paddingHorizontal: 16,
    gap: 8,
  },
  gifCard: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: 10,
    overflow: 'hidden',
  },
  gifImage: {
    width: '100%',
    height: '100%',
  },
  emptyState: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
  },
  attribution: {
    paddingVertical: 8,
    alignItems: 'center',
  },
  attributionText: {
    fontSize: 10,
  },
});
