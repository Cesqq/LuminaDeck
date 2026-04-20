import React, { useState, useMemo, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  FlatList,
  Modal,
  StyleSheet,
  Dimensions,
  type ListRenderItemInfo,
} from 'react-native';
import type { ButtonConfig } from '@luminadeck/shared';
import {
  ACTION_TILES,
  TILE_CATEGORIES,
  TILE_CATEGORY_LABELS,
  searchTiles,
  getTilesByCategory,
} from '@luminadeck/shared';
import type { ActionTile, TileCategory } from '@luminadeck/shared';
import { IconView } from '../components/IconView';
import { useTheme } from '../contexts/ThemeContext';
import { usePro } from '../contexts/ProContext';

interface TileLibraryScreenProps {
  visible: boolean;
  targetPage: number;
  targetPosition: number;
  onSelect: (button: ButtonConfig) => void;
  onClose: () => void;
}

const SCREEN_WIDTH = Dimensions.get('window').width;
const TILE_GAP = 10;
const TILE_PADDING = 16;
const TILE_COLS = 3;
const TILE_SIZE = Math.floor(
  (SCREEN_WIDTH - TILE_PADDING * 2 - TILE_GAP * (TILE_COLS - 1)) / TILE_COLS,
);

function generateButtonId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

export function TileLibraryScreen({
  visible,
  targetPage,
  targetPosition,
  onSelect,
  onClose,
}: TileLibraryScreenProps) {
  const { colors } = useTheme();
  const { isPro } = usePro();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<TileCategory | 'all'>('all');
  const categoryScrollRef = useRef<ScrollView>(null);

  const filteredTiles = useMemo(() => {
    let tiles: ActionTile[];
    if (searchQuery.trim()) {
      tiles = searchTiles(searchQuery);
    } else if (activeCategory === 'all') {
      tiles = ACTION_TILES;
    } else {
      tiles = getTilesByCategory(activeCategory);
    }
    return tiles;
  }, [searchQuery, activeCategory]);

  const handleTileSelect = useCallback(
    (tile: ActionTile) => {
      const newButton: ButtonConfig = {
        id: generateButtonId(),
        action: tile.defaultAction,
        label: tile.name,
        icon: tile.icon,
        page: targetPage,
        position: targetPosition,
      };
      onSelect(newButton);
    },
    [targetPage, targetPosition, onSelect],
  );

  const handleCustomAction = useCallback(() => {
    const blankButton: ButtonConfig = {
      id: generateButtonId(),
      action: null,
      label: 'New Action',
      page: targetPage,
      position: targetPosition,
    };
    onSelect(blankButton);
  }, [targetPage, targetPosition, onSelect]);

  const handleCategoryPress = useCallback((cat: TileCategory | 'all') => {
    setActiveCategory(cat);
    setSearchQuery('');
  }, []);

  const renderTileCard = useCallback(
    ({ item }: ListRenderItemInfo<ActionTile | { id: 'custom'; type: 'custom' }>) => {
      if ('type' in item && item.type === 'custom') {
        return (
          <TouchableOpacity
            style={[
              styles.tileCard,
              {
                width: TILE_SIZE,
                height: TILE_SIZE,
                backgroundColor: colors.buttonBackground,
                borderColor: colors.accent + '44',
                borderStyle: 'dashed',
              },
            ]}
            onPress={handleCustomAction}
            accessibilityRole="button"
            accessibilityLabel="Create custom action"
          >
            <Text style={[styles.customPlus, { color: colors.accent }]}>+</Text>
            <Text
              style={[styles.tileName, { color: colors.accent }]}
              numberOfLines={1}
              allowFontScaling
              maxFontSizeMultiplier={1.3}
            >
              Custom
            </Text>
          </TouchableOpacity>
        );
      }

      const tile = item as ActionTile;
      const isLocked = tile.requiresPro && !isPro;

      return (
        <TouchableOpacity
          style={[
            styles.tileCard,
            {
              width: TILE_SIZE,
              height: TILE_SIZE,
              backgroundColor: colors.buttonBackground,
              borderColor: colors.buttonBorder,
            },
          ]}
          onPress={() => handleTileSelect(tile)}
          activeOpacity={isLocked ? 0.5 : 0.7}
          accessibilityRole="button"
          accessibilityLabel={`${tile.name}${isLocked ? ', requires Pro' : ''}`}
        >
          <IconView name={tile.icon} size={28} color={colors.accent} />
          <Text
            style={[styles.tileName, { color: colors.text }]}
            numberOfLines={2}
            allowFontScaling
            maxFontSizeMultiplier={1.3}
          >
            {tile.name}
          </Text>
          {tile.requiresPro && (
            <View style={[styles.proBadge, { backgroundColor: colors.accent }]}>
              <Text style={styles.proBadgeText}>PRO</Text>
            </View>
          )}
        </TouchableOpacity>
      );
    },
    [colors, isPro, handleTileSelect, handleCustomAction],
  );

  // Build list data: tiles + custom action card at the end (per category or at end of all)
  const listData = useMemo(() => {
    const items: Array<ActionTile | { id: 'custom'; type: 'custom' }> = [
      ...filteredTiles,
    ];
    // Only show custom card when not searching
    if (!searchQuery.trim()) {
      items.push({ id: 'custom', type: 'custom' });
    }
    return items;
  }, [filteredTiles, searchQuery]);

  const keyExtractor = useCallback(
    (item: ActionTile | { id: 'custom'; type: 'custom' }) => item.id,
    [],
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {/* Header */}
        <View style={styles.header}>
          <Text
            style={[styles.headerTitle, { color: colors.text }]}
            allowFontScaling
            maxFontSizeMultiplier={1.5}
          >
            Add Tile
          </Text>
          <TouchableOpacity
            onPress={onClose}
            style={styles.closeButton}
            accessibilityRole="button"
            accessibilityLabel="Close tile library"
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Text style={[styles.closeIcon, { color: colors.textSecondary }]}>
              {'\u2715'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Search bar */}
        <View style={styles.searchContainer}>
          <TextInput
            style={[
              styles.searchInput,
              {
                backgroundColor: colors.buttonBackground,
                borderColor: colors.buttonBorder,
                color: colors.text,
              },
            ]}
            placeholder="Search tiles..."
            placeholderTextColor={colors.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
            accessibilityLabel="Search tiles"
          />
        </View>

        {/* Category tabs */}
        {!searchQuery.trim() && (
          <ScrollView
            ref={categoryScrollRef}
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.categoryScroll}
            contentContainerStyle={styles.categoryContent}
          >
            <TouchableOpacity
              style={[
                styles.categoryTab,
                {
                  backgroundColor:
                    activeCategory === 'all'
                      ? colors.accent
                      : colors.buttonBackground,
                  borderColor:
                    activeCategory === 'all'
                      ? colors.accent
                      : colors.buttonBorder,
                },
              ]}
              onPress={() => handleCategoryPress('all')}
              accessibilityRole="tab"
              accessibilityLabel="All categories"
              accessibilityState={{ selected: activeCategory === 'all' }}
            >
              <Text
                style={[
                  styles.categoryLabel,
                  {
                    color:
                      activeCategory === 'all'
                        ? '#FFFFFF'
                        : colors.textSecondary,
                  },
                ]}
                allowFontScaling
                maxFontSizeMultiplier={1.3}
              >
                All
              </Text>
            </TouchableOpacity>

            {TILE_CATEGORIES.map((cat) => (
              <TouchableOpacity
                key={cat}
                style={[
                  styles.categoryTab,
                  {
                    backgroundColor:
                      activeCategory === cat
                        ? colors.accent
                        : colors.buttonBackground,
                    borderColor:
                      activeCategory === cat
                        ? colors.accent
                        : colors.buttonBorder,
                  },
                ]}
                onPress={() => handleCategoryPress(cat)}
                accessibilityRole="tab"
                accessibilityLabel={`${TILE_CATEGORY_LABELS[cat]} category`}
                accessibilityState={{ selected: activeCategory === cat }}
              >
                <Text
                  style={[
                    styles.categoryLabel,
                    {
                      color:
                        activeCategory === cat
                          ? '#FFFFFF'
                          : colors.textSecondary,
                    },
                  ]}
                  allowFontScaling
                  maxFontSizeMultiplier={1.3}
                >
                  {TILE_CATEGORY_LABELS[cat]}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        {/* Tile grid */}
        <FlatList
          data={listData}
          renderItem={renderTileCard}
          keyExtractor={keyExtractor}
          numColumns={TILE_COLS}
          contentContainerStyle={styles.gridContent}
          columnWrapperStyle={styles.gridRow}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text
                style={[styles.emptyText, { color: colors.textSecondary }]}
                allowFontScaling
                maxFontSizeMultiplier={1.5}
              >
                No tiles match your search
              </Text>
            </View>
          }
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  closeButton: {
    padding: 4,
  },
  closeIcon: {
    fontSize: 22,
    fontWeight: '600',
  },
  searchContainer: {
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
  categoryScroll: {
    maxHeight: 44,
    marginBottom: 8,
  },
  categoryContent: {
    paddingHorizontal: 16,
    gap: 8,
  },
  categoryTab: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  categoryLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  gridContent: {
    paddingHorizontal: TILE_PADDING,
    paddingBottom: 32,
  },
  gridRow: {
    gap: TILE_GAP,
    marginBottom: TILE_GAP,
  },
  tileCard: {
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 8,
    position: 'relative',
  },
  tileName: {
    fontSize: 11,
    fontWeight: '500',
    textAlign: 'center',
    marginTop: 6,
    paddingHorizontal: 2,
  },
  customPlus: {
    fontSize: 28,
    fontWeight: '300',
  },
  proBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  proBadgeText: {
    color: '#FFFFFF',
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
  },
  emptyText: {
    fontSize: 14,
    fontWeight: '500',
  },
});
