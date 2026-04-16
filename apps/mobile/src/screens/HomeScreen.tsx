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
import type { ButtonConfig, ProfileConfig, PageConfig } from '@luminadeck/shared';
import { GRID_DIMENSIONS } from '@luminadeck/shared';
import { ButtonGrid } from '../components/ButtonGrid';
import { ConnectionStatus } from '../components/ConnectionStatus';
import { useTheme } from '../contexts/ThemeContext';
import { useConnection } from '../contexts/ConnectionContext';
import { usePro } from '../contexts/ProContext';
import { loadProfile, saveProfile, loadSettings, hapticStyleFromIntensity } from '../lib/storage';
import type { HapticIntensity } from '../lib/storage';
import * as Haptics from 'expo-haptics';

interface HomeScreenProps {
  onNavigateSettings: () => void;
  onEditButton: (button: ButtonConfig, pageIndex: number) => void;
}

export function HomeScreen({ onNavigateSettings, onEditButton }: HomeScreenProps) {
  const { colors } = useTheme();
  const { status, client } = useConnection();
  const { limits } = usePro();
  const [profile, setProfile] = useState<ProfileConfig | null>(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [hapticStyle, setHapticStyle] = useState<Haptics.ImpactFeedbackStyle | null>(
    Haptics.ImpactFeedbackStyle.Medium,
  );
  const pagerRef = useRef<PagerView>(null);

  useEffect(() => {
    loadProfile().then(setProfile);
    loadSettings().then((settings) => {
      setHapticStyle(hapticStyleFromIntensity(settings.hapticIntensity));
    });
  }, []);

  const handleButtonPress = useCallback(
    (button: ButtonConfig) => {
      if (!button.action) return;

      if (status === 'connected') {
        const msgId = `exec-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        client.send({
          type: 'execute',
          id: msgId,
          action: button.action as any,
        });
      }
    },
    [status, client],
  );

  const handleButtonLongPress = useCallback(
    (button: ButtonConfig) => {
      onEditButton(button, currentPage);
    },
    [onEditButton, currentPage],
  );

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

      {/* Demo mode banner */}
      {status !== 'connected' && (
        <View style={[styles.demoBanner, { backgroundColor: colors.accent + '22' }]}>
          <Text
            style={[styles.demoBannerText, { color: colors.accent }]}
            allowFontScaling
            maxFontSizeMultiplier={1.5}
          >
            Demo Mode \u2014 Connect to a companion PC to execute actions
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
              />
            </>
          )}
        </View>
      )}

      {/* Page indicator dots */}
      {pageCount > 1 && (
        <View style={styles.dotsContainer}>
          {pages.map((page, index) => (
            <View
              key={page.id}
              style={[
                styles.dot,
                {
                  backgroundColor:
                    index === currentPage ? colors.accent : colors.textSecondary + '44',
                },
              ]}
              accessibilityRole="tab"
              accessibilityLabel={`Page ${index + 1} of ${pageCount}`}
              accessibilityState={{ selected: index === currentPage }}
            />
          ))}
        </View>
      )}
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
});
