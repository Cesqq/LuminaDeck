import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
} from 'react-native';
import {
  PROFILE_PACKS,
  instantiatePack,
  type ProfilePack,
  type ProfilePackCategory,
} from '@luminadeck/shared';
import { useTheme } from '../contexts/ThemeContext';
import { useProfiles } from '../contexts/ProfileContext';
import { usePro } from '../contexts/ProContext';

const CATEGORY_ORDER: ProfilePackCategory[] = [
  'soundboard', 'streaming', 'coder', 'vtuber', 'daw', 'video',
];
const CATEGORY_LABELS: Record<ProfilePackCategory, string> = {
  streaming: 'Streaming',
  vtuber: 'VTubing',
  daw: 'Music (DAW)',
  video: 'Video editing',
  coder: 'Coding',
  soundboard: 'Soundboard / Memes',
};

interface ProfilePackStoreScreenProps {
  onClose: () => void;
  onInstalled?: () => void;
}

export function ProfilePackStoreScreen({ onClose, onInstalled }: ProfilePackStoreScreenProps) {
  const { colors, setTheme } = useTheme();
  const { upsertProfile } = useProfiles();
  const { isPro } = usePro();
  const [installingId, setInstallingId] = useState<string | null>(null);

  const handleInstall = useCallback(
    (pack: ProfilePack) => {
      if (pack.isProOnly && !isPro) {
        Alert.alert(
          'Pro Pack',
          `${pack.name} is a Pro pack. Upgrade to LuminaDeck Pro to install.`,
        );
        return;
      }
      Alert.alert(
        `Install ${pack.name}?`,
        'A new profile will be added to your list and activated. You can rename or delete it later from Manage Profiles.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Install',
            style: 'default',
            onPress: () => {
              setInstallingId(pack.id);
              try {
                const profile = instantiatePack(pack);
                upsertProfile(profile, true);
                // v1.3.0: auto-apply the pack's theme so installing a pack
                // gives an immediate visual identity shift. Free-tier
                // users who can't access Pro themes still get the new
                // visual on install — paywall enforcement (if we want it
                // for themes) lives in setTheme inside ThemeContext.
                if (profile.theme) {
                  setTheme(profile.theme);
                }
                onInstalled?.();
                onClose();
              } finally {
                setInstallingId(null);
              }
            },
          },
        ],
      );
    },
    [isPro, upsertProfile, onInstalled, onClose],
  );

  const packsByCategory = CATEGORY_ORDER.map((c) => ({
    category: c,
    items: PROFILE_PACKS.filter((p) => p.category === c),
  })).filter((g) => g.items.length > 0);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.headerRow}>
        <TouchableOpacity
          onPress={onClose}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          accessibilityRole="button"
          accessibilityLabel="Close profile packs"
        >
          <Text style={[styles.backText, { color: colors.accent }]} allowFontScaling maxFontSizeMultiplier={1.5}>
            {'\u2190 Close'}
          </Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]} allowFontScaling maxFontSizeMultiplier={1.5}>
          Profile Packs
        </Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={[styles.intro, { color: colors.textSecondary }]} allowFontScaling maxFontSizeMultiplier={1.5}>
          One-tap installs tuned for common creator workflows. DAW and video
          packs require LuminaDeck Pro. Every pack lands as a regular profile
          you can edit, rename, or delete afterwards.
        </Text>

        {packsByCategory.map(({ category, items }) => (
          <View key={category} style={styles.categoryGroup}>
            <Text style={[styles.categoryHeader, { color: colors.textSecondary }]} allowFontScaling maxFontSizeMultiplier={1.5}>
              {CATEGORY_LABELS[category]}
            </Text>
            {items.map((pack) => {
              const locked = pack.isProOnly && !isPro;
              return (
                <TouchableOpacity
                  key={pack.id}
                  onPress={() => handleInstall(pack)}
                  disabled={installingId === pack.id}
                  accessibilityRole="button"
                  accessibilityLabel={`${pack.name} pack, ${pack.description}${locked ? ', requires Pro' : ''}`}
                  style={[
                    styles.card,
                    {
                      backgroundColor: colors.buttonBackground,
                      borderColor: locked ? colors.buttonBorder : pack.accentColor,
                      opacity: installingId === pack.id ? 0.5 : 1,
                    },
                  ]}
                >
                  <View style={[styles.accentStrip, { backgroundColor: pack.accentColor, opacity: locked ? 0.4 : 1 }]} />
                  <View style={styles.cardBody}>
                    <View style={styles.titleRow}>
                      <Text style={[styles.cardTitle, { color: colors.text }]} allowFontScaling maxFontSizeMultiplier={1.5}>
                        {pack.name}
                      </Text>
                      {locked ? (
                        <View style={[styles.proPill, { borderColor: pack.accentColor }]}>
                          <Text style={[styles.proPillText, { color: pack.accentColor }]} allowFontScaling maxFontSizeMultiplier={1.5}>
                            PRO
                          </Text>
                        </View>
                      ) : (
                        <Text style={[styles.tileCount, { color: colors.textSecondary }]} allowFontScaling maxFontSizeMultiplier={1.5}>
                          {pack.profile.pages.reduce((n, p) => n + p.buttons.length, 0)} tiles
                        </Text>
                      )}
                    </View>
                    <Text
                      style={[styles.cardDesc, { color: colors.textSecondary }]}
                      allowFontScaling
                      maxFontSizeMultiplier={1.5}
                    >
                      {pack.description}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  backText: {
    fontSize: 16,
    fontWeight: '600',
    width: 60,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
  },
  scroll: {
    padding: 16,
    paddingBottom: 60,
  },
  intro: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 16,
  },
  categoryGroup: {
    marginBottom: 18,
  },
  categoryHeader: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 8,
  },
  card: {
    borderWidth: 1,
    borderRadius: 12,
    flexDirection: 'row',
    marginBottom: 10,
    overflow: 'hidden',
  },
  accentStrip: {
    width: 5,
  },
  cardBody: {
    flex: 1,
    padding: 12,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  cardDesc: {
    fontSize: 13,
    lineHeight: 18,
  },
  tileCount: {
    fontSize: 11,
    fontWeight: '600',
  },
  proPill: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  proPillText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
});
