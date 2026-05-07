import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import PagerView from 'react-native-pager-view';
import type { Action, ButtonConfig, PageConfig, FolderAction } from '@luminadeck/shared';
import type { CellGesture } from '../components/ButtonCell';
import { GRID_DIMENSIONS } from '@luminadeck/shared';
import { ButtonGrid } from '../components/ButtonGrid';
import { FolderView } from '../components/FolderView';
import { ConnectionStatus } from '../components/ConnectionStatus';
import { TileLibraryScreen } from './TileLibraryScreen';
import { SmartPageScreen } from './SmartPageScreen';
import { TrackpadOverlay } from '../components/TrackpadOverlay';
import { useTheme } from '../contexts/ThemeContext';
import { useConnection } from '../contexts/ConnectionContext';
import { usePro } from '../contexts/ProContext';
import { useProfiles } from '../contexts/ProfileContext';
import { loadSettings, hapticStyleFromIntensity } from '../lib/storage';
import type { HapticIntensity } from '../lib/storage';
import { recordButtonPress, isPredictorEnabled, setCurrentProfileId } from '../lib/predictor';
import * as Haptics from 'expo-haptics';
import { Modal } from 'react-native';

interface TileLibraryState {
  visible: boolean;
  page: number;
  position: number;
}

interface FolderState {
  folder: FolderAction;
}

interface TrackpadState {
  sensitivity: number;
  naturalScroll: boolean;
  haptics: boolean;
  accelCurve: 'linear' | 'classic';
  lockToPrimary: boolean;
}

interface HomeScreenProps {
  onNavigateSettings: () => void;
  onEditButton: (button: ButtonConfig, pageIndex: number) => void;
}

export function HomeScreen({ onNavigateSettings, onEditButton }: HomeScreenProps) {
  const { colors } = useTheme();
  const { status, client } = useConnection();
  const { limits } = usePro();
  // Single source of truth: the active profile lives in ProfileContext and is
  // driven by (a) user switches in ProfileManagerScreen and (b) remote
  // `profile_update` / `profile_switch` pushes from Studio. Reading it here
  // means both of those paths flow straight into the rendered deck without
  // a separate storage round-trip — fixes the "nothing happens when I swap
  // profile" + "Push to Phone does nothing" bugs in v1.1.0 (3).
  const { activeProfile, updateProfile } = useProfiles();
  const profile = activeProfile;
  const [currentPage, setCurrentPage] = useState(0);
  const [hapticStyle, setHapticStyle] = useState<Haptics.ImpactFeedbackStyle | null>(
    Haptics.ImpactFeedbackStyle.Medium,
  );
  const [tileLibrary, setTileLibrary] = useState<TileLibraryState | null>(null);
  const [openFolder, setOpenFolder] = useState<FolderState | null>(null);
  const [showSmart, setShowSmart] = useState(false);
  const [trackpad, setTrackpad] = useState<TrackpadState | null>(null);
  const pagerRef = useRef<PagerView>(null);

  // Re-point the predictor at the active profile's ring buffer whenever it
  // switches — presses should always land in the right bucket.
  useEffect(() => {
    if (profile?.id) setCurrentProfileId(profile.id);
  }, [profile?.id]);

  useEffect(() => {
    loadSettings().then((settings) => {
      setHapticStyle(hapticStyleFromIntensity(settings.hapticIntensity));
    });
  }, []);

  // Central action dispatch. Tap and all gesture paths funnel here so the
  // folder-open short-circuit + the 'disconnected = do nothing' rule stay in
  // one place.
  const sendAction = useCallback(
    (action: Action) => {
      if (action.type === 'folder') {
        setOpenFolder({ folder: action as FolderAction });
        return;
      }
      // v1.2.0: trackpad action opens the cursor overlay locally; the
      // overlay then streams mouse_* messages directly. We don't ship
      // the action through `execute` because the companion side
      // intentionally doesn't have a Trackpad branch in actions::Action.
      if (action.type === 'trackpad') {
        setTrackpad({
          sensitivity: action.sensitivity ?? 1.0,
          naturalScroll: action.naturalScroll ?? false,
          haptics: action.haptics ?? true,
          accelCurve: action.accelCurve ?? 'classic',
          lockToPrimary: action.lockToPrimary ?? false,
        });
        return;
      }
      if (status === 'connected') {
        const msgId = `exec-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        client.send({
          type: 'execute',
          id: msgId,
          action: action as any,
        });
      }
    },
    [status, client],
  );

  const handleButtonPress = useCallback(
    (button: ButtonConfig) => {
      if (!button.action) return;
      recordButtonPress(button.id);
      sendAction(button.action);
    },
    [sendAction],
  );

  const handleButtonLongPress = useCallback(
    (button: ButtonConfig) => {
      // If the tile binds a long-press gesture, fire it instead of opening
      // the editor. Users opt into this tradeoff by configuring the binding.
      const bound = button.gestures?.longPress;
      if (bound) {
        recordButtonPress(button.id);
        sendAction(bound);
        return;
      }
      onEditButton(button, currentPage);
    },
    [onEditButton, currentPage, sendAction],
  );

  const handleButtonGesture = useCallback(
    (button: ButtonConfig, gesture: CellGesture) => {
      const bound = button.gestures?.[gesture];
      if (bound) {
        recordButtonPress(button.id);
        sendAction(bound);
      }
    },
    [sendAction],
  );

  const handleEmptyPress = useCallback(
    (position: number) => {
      setTileLibrary({ visible: true, page: currentPage, position });
    },
    [currentPage],
  );

  const handleTileSelect = useCallback(
    (newButton: ButtonConfig) => {
      setTileLibrary(null);
      if (!profile) return;

      const pageIdx = newButton.page;
      const page = profile.pages[pageIdx];
      if (!page) return;

      // If the new button has no action, open the editor for customization
      if (!newButton.action) {
        onEditButton(newButton, pageIdx);
        return;
      }

      // Append the button via ProfileContext so the change lands in the
      // shared profiles store + flows out to any re-renders (editor, Smart
      // Page, etc.) without a second storage read.
      const updatedButtons = [...page.buttons, newButton];
      const updatedPages = [...profile.pages];
      updatedPages[pageIdx] = { ...page, buttons: updatedButtons };
      updateProfile({ ...profile, pages: updatedPages });
    },
    [profile, onEditButton, updateProfile],
  );

  const handleTileLibraryClose = useCallback(() => {
    setTileLibrary(null);
  }, []);

  const handleFolderBack = useCallback(() => {
    setOpenFolder(null);
  }, []);

  if (!profile) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  const pages = profile.pages.slice(0, limits.maxPages);
  const pageCount = pages.length;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Top bar */}
      <View style={styles.topBar}>
        <ConnectionStatus status={status} colors={colors} />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          {isPredictorEnabled() && (
            <TouchableOpacity
              onPress={() => setShowSmart(true)}
              style={styles.settingsButton}
              accessibilityRole="button"
              accessibilityLabel="Open Smart Page"
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Text
                style={[styles.settingsIcon, { color: colors.accent }]}
                allowFontScaling
                maxFontSizeMultiplier={1.5}
              >
                {'\u2728'}
              </Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            onPress={onNavigateSettings}
            style={styles.settingsButton}
            accessibilityRole="button"
            accessibilityLabel="Open settings"
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Text
              style={[styles.settingsIcon, { color: colors.textSecondary }]}
              allowFontScaling
              maxFontSizeMultiplier={1.5}
            >
              {'\u2699'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <Modal
        visible={showSmart}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowSmart(false)}
      >
        <SmartPageScreen profile={profile} onClose={() => setShowSmart(false)} />
      </Modal>

      {/* Demo mode banner */}
      {status !== 'connected' && (
        <View style={[styles.demoBanner, { backgroundColor: colors.accent + '22' }]}>
          <Text
            style={[styles.demoBannerText, { color: colors.accent }]}
            allowFontScaling
            maxFontSizeMultiplier={1.5}
          >
            Demo Mode — Connect to a companion PC to execute actions
          </Text>
        </View>
      )}

      {/* Pager with button grids */}
      {pageCount > 1 ? (
        <PagerView
          ref={pagerRef}
          style={styles.pager}
          initialPage={0}
          onPageSelected={(e) => setCurrentPage(e.nativeEvent.position)}
        >
          {pages.map((page, index) => (
            <View key={page.id} style={styles.pageContainer}>
              <PageHeader page={page} colors={colors} />
              <ButtonGrid
                buttons={page.buttons.slice(0, limits.maxButtons)}
                layout={page.layout}
                colors={colors}
                hapticStyle={hapticStyle}
                onPress={handleButtonPress}
                onLongPress={handleButtonLongPress}
                onEmptyPress={handleEmptyPress}
                onGesture={handleButtonGesture}
              />
            </View>
          ))}
        </PagerView>
      ) : (
        <View style={styles.singlePageContainer}>
          {pages[0] && (
            <>
              <PageHeader page={pages[0]} colors={colors} />
              <ButtonGrid
                buttons={pages[0].buttons.slice(0, limits.maxButtons)}
                layout={pages[0].layout}
                colors={colors}
                hapticStyle={hapticStyle}
                onPress={handleButtonPress}
                onLongPress={handleButtonLongPress}
                onEmptyPress={handleEmptyPress}
                onGesture={handleButtonGesture}
              />
            </>
          )}
        </View>
      )}

      {/* Page indicator dots — v1.1.1: active page becomes a wider pill so
          the indicator works as a glanceable progress hint, not just a
          color toggle. Inactive dots stay 8x8 circles. */}
      {pageCount > 1 && (
        <View style={styles.dotsContainer}>
          {pages.map((page, index) => {
            const isActive = index === currentPage;
            return (
              <View
                key={page.id}
                style={[
                  styles.dot,
                  isActive && styles.dotActive,
                  {
                    backgroundColor: isActive
                      ? colors.accent
                      : colors.textSecondary + '44',
                  },
                ]}
                accessibilityRole="tab"
                accessibilityLabel={`Page ${index + 1} of ${pageCount}`}
                accessibilityState={{ selected: isActive }}
              />
            );
          })}
        </View>
      )}

      {/* Tile library modal */}
      {tileLibrary && (
        <TileLibraryScreen
          visible={tileLibrary.visible}
          targetPage={tileLibrary.page}
          targetPosition={tileLibrary.position}
          onSelect={handleTileSelect}
          onClose={handleTileLibraryClose}
        />
      )}

      {/* Folder sub-grid overlay */}
      {openFolder && (
        <FolderView
          folder={openFolder.folder}
          colors={colors}
          hapticStyle={hapticStyle}
          onBack={handleFolderBack}
          onButtonPress={handleButtonPress}
          onButtonLongPress={handleButtonLongPress}
        />
      )}

      {/* Trackpad overlay (v1.2.0+, polished v1.2.1) */}
      <TrackpadOverlay
        visible={!!trackpad}
        colors={colors}
        client={client}
        sensitivity={trackpad?.sensitivity}
        naturalScroll={trackpad?.naturalScroll}
        haptics={trackpad?.haptics}
        accelCurve={trackpad?.accelCurve}
        lockToPrimary={trackpad?.lockToPrimary}
        onClose={() => setTrackpad(null)}
      />
    </View>
  );
}

// --- Page header sub-component ---

function PageHeader({
  page,
  colors,
}: {
  page: PageConfig;
  colors: import('@luminadeck/shared').ThemeColors;
}) {
  return (
    <View style={styles.pageHeader}>
      <Text
        style={[styles.pageName, { color: colors.textSecondary }]}
        allowFontScaling
        maxFontSizeMultiplier={1.5}
        numberOfLines={1}
      >
        {page.name}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 8,
  },
  settingsButton: {
    padding: 4,
  },
  settingsIcon: {
    fontSize: 24,
  },
  demoBanner: {
    marginHorizontal: 16,
    marginBottom: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  demoBannerText: {
    fontSize: 12,
    textAlign: 'center',
    fontWeight: '500',
  },
  pager: {
    flex: 1,
  },
  pageContainer: {
    flex: 1,
  },
  singlePageContainer: {
    flex: 1,
  },
  pageHeader: {
    paddingHorizontal: 16,
    paddingBottom: 4,
  },
  pageName: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  dotsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  dotActive: {
    width: 22,
    height: 8,
    borderRadius: 4,
  },
});
