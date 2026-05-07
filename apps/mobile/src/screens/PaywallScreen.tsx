import React, { useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import { usePro } from '../contexts/ProContext';
import { TELEMETRY_EVENTS } from '@luminadeck/shared';
import { track } from '../lib/telemetry';

interface PaywallScreenProps {
  visible: boolean;
  onClose: () => void;
}

const FREE_FEATURES = [
  '12 action keys',
  '2 pages',
  '1 theme (Obsidian)',
  'Media & system controls',
  'Clipboard shortcuts',
  'Window management',
  '1 paired PC',
];

const PRO_FEATURES = [
  '64 action keys',
  '50 pages',
  'All 15+ themes',
  'Custom layouts & iPad support',
  'Discord controls',
  'Multi-action macros',
  'GIF icons via Giphy',
  'Custom image tiles',
  'Folder organization',
  'Auto-profile switching',
  '5 paired PCs',
  'Profile import/export',
];

export function PaywallScreen({ visible, onClose }: PaywallScreenProps) {
  const { colors } = useTheme();
  const { purchase, restore, isPurchasing, isRestoring, priceString } = usePro();

  // Telemetry: paywall_view fires on each modal open (not on re-render).
  // Source is 'settings' for now — when the paywall is launched from other
  // surfaces (e.g., a locked theme tap), the caller can pass a source prop.
  useEffect(() => {
    if (visible) {
      track(TELEMETRY_EVENTS.PAYWALL_VIEW, { source: 'settings' });
    }
  }, [visible]);
  const handlePurchase = useCallback(async () => {
    await purchase();
    onClose();
  }, [purchase, onClose]);

  const handleRestore = useCallback(async () => {
    await restore();
  }, [restore]);

  const isLoading = isPurchasing || isRestoring;

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
          <TouchableOpacity
            onPress={onClose}
            style={styles.closeButton}
            accessibilityRole="button"
            accessibilityLabel="Close"
          >
            <Text style={[styles.closeText, { color: colors.textSecondary }]}>
              {'\u2715'}
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Title */}
          <Text
            style={[styles.title, { color: colors.text }]}
            accessibilityRole="header"
          >
            Unlock LuminaDeck Pro
          </Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Take full control of your PC with advanced actions, integrations, and customization.
          </Text>

          {/* Plan Cards */}
          <View style={styles.plansRow}>
            <View
              style={[
                styles.planCard,
                {
                  backgroundColor: colors.accent + '15',
                  borderColor: colors.accent,
                  borderWidth: 2,
                },
              ]}
              accessibilityRole="text"
              accessibilityLabel={`Lifetime Pro, ${priceString}, one-time purchase`}
            >
              <View style={[styles.badge, { backgroundColor: colors.accent }]}>
                <Text style={styles.badgeText}>ONE-TIME</Text>
              </View>
              <Text style={[styles.planLabel, { color: colors.text }]}>
                Lifetime Pro
              </Text>
              <Text style={[styles.planPrice, { color: colors.accent }]}>
                {priceString}
              </Text>
              <Text style={[styles.planPeriod, { color: colors.textSecondary }]}>
                one-time
              </Text>
            </View>
          </View>

          {/* Feature Comparison */}
          <View style={styles.comparisonSection}>
            {/* Pro Column */}
            <View style={[styles.featureColumn, { borderColor: colors.accent, borderWidth: 1, borderRadius: 16 }]}>
              <View style={[styles.featureHeader, { backgroundColor: colors.accent + '20' }]}>
                <Text style={[styles.featureHeaderText, { color: colors.accent }]}>PRO</Text>
              </View>
              {PRO_FEATURES.map((f, i) => (
                <View key={i} style={styles.featureRow}>
                  <Text style={[styles.checkmark, { color: colors.accent }]}>{'\u2713'}</Text>
                  <Text style={[styles.featureText, { color: colors.text }]}>{f}</Text>
                </View>
              ))}
            </View>

            {/* Free Column */}
            <View style={[styles.featureColumn, { borderColor: colors.buttonBorder, borderWidth: 1, borderRadius: 16, marginTop: 16 }]}>
              <View style={[styles.featureHeader, { backgroundColor: colors.buttonBackground }]}>
                <Text style={[styles.featureHeaderText, { color: colors.textSecondary }]}>FREE</Text>
              </View>
              {FREE_FEATURES.map((f, i) => (
                <View key={i} style={styles.featureRow}>
                  <Text style={[styles.checkmark, { color: colors.textSecondary }]}>{'\u2713'}</Text>
                  <Text style={[styles.featureText, { color: colors.textSecondary }]}>{f}</Text>
                </View>
              ))}
            </View>
          </View>
        </ScrollView>

        {/* Bottom CTA */}
        <View style={[styles.cta, { borderTopColor: colors.buttonBorder }]}>
          <TouchableOpacity
            style={[styles.purchaseButton, { backgroundColor: colors.accent, opacity: isLoading ? 0.6 : 1 }]}
            onPress={handlePurchase}
            disabled={isLoading}
            accessibilityRole="button"
            accessibilityLabel="Buy Lifetime Pro"
          >
            {isLoading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.purchaseButtonText}>
                Get Lifetime Pro — {priceString}
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleRestore}
            disabled={isLoading}
            style={styles.restoreLink}
            accessibilityRole="button"
            accessibilityLabel="Restore previous purchase"
          >
            <Text style={[styles.restoreLinkText, { color: colors.textSecondary }]}>
              Restore Purchase
            </Text>
          </TouchableOpacity>

          <Text style={[styles.legalText, { color: colors.textSecondary }]}>
            One-time in-app purchase. No subscription or auto-renewal.
          </Text>
        </View>
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
    justifyContent: 'flex-end',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeText: {
    fontSize: 18,
    fontWeight: '600',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 28,
    paddingHorizontal: 16,
  },
  plansRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 28,
  },
  planCard: {
    flex: 1,
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  badge: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingVertical: 3,
    alignItems: 'center',
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  planLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 14,
    marginBottom: 6,
  },
  planPrice: {
    fontSize: 22,
    fontWeight: '800',
  },
  planPeriod: {
    fontSize: 11,
    marginTop: 2,
  },
  planSavings: {
    fontSize: 11,
    fontWeight: '700',
    marginTop: 4,
  },
  comparisonSection: {
    marginBottom: 16,
  },
  featureColumn: {
    overflow: 'hidden',
  },
  featureHeader: {
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  featureHeaderText: {
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 1,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    gap: 10,
  },
  checkmark: {
    fontSize: 14,
    fontWeight: '700',
    width: 18,
  },
  featureText: {
    fontSize: 14,
    flex: 1,
  },
  cta: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 34,
    borderTopWidth: 1,
  },
  purchaseButton: {
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  purchaseButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
  },
  restoreLink: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  restoreLinkText: {
    fontSize: 14,
    fontWeight: '600',
  },
  legalText: {
    fontSize: 10,
    textAlign: 'center',
    lineHeight: 14,
    paddingHorizontal: 20,
  },
});
