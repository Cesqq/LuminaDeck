import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import { usePro } from '../contexts/ProContext';

interface RedeemCodeModalProps {
  visible: boolean;
  onClose: () => void;
  /** Called with the granted tier when redemption succeeds. */
  onSuccess?: (tier: 'lifetime' | 'pro_1y' | 'pro_30d') => void;
}

const TIER_LABEL: Record<string, string> = {
  lifetime: 'Lifetime Pro',
  pro_1y: '1 year of Pro',
  pro_30d: '30 days of Pro',
};

/**
 * Pretty-format a code as the user types: uppercase, hyphenate every 4 chars.
 */
function formatCode(raw: string): string {
  const cleaned = raw.toUpperCase().replace(/[^A-Z0-9]/g, '');
  const groups: string[] = [];
  for (let i = 0; i < cleaned.length; i += 4) {
    groups.push(cleaned.slice(i, i + 4));
  }
  return groups.join('-').slice(0, 19); // up to 16 chars + 3 hyphens
}

export function RedeemCodeModal({ visible, onClose, onSuccess }: RedeemCodeModalProps) {
  const { colors } = useTheme();
  const { redeem } = usePro();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const reset = useCallback(() => {
    setCode('');
    setError(null);
    setSuccess(null);
    setBusy(false);
  }, []);

  const handleClose = useCallback(() => {
    reset();
    onClose();
  }, [onClose, reset]);

  const handleSubmit = useCallback(async () => {
    if (busy) return;
    const trimmed = code.replace(/[\s-]/g, '');
    if (trimmed.length < 4) {
      setError('Enter the full code shown on your invite.');
      return;
    }

    setBusy(true);
    setError(null);
    setSuccess(null);

    const result = await redeem(trimmed);
    setBusy(false);

    if (result.ok) {
      const label = TIER_LABEL[result.tier] ?? 'Pro';
      setSuccess(
        result.idempotent
          ? `Already redeemed on this device — ${label} is unlocked.`
          : `${label} unlocked. Welcome.`,
      );
      onSuccess?.(result.tier);
    } else {
      setError(result.message);
    }
  }, [busy, code, redeem, onSuccess]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        style={[styles.container, { backgroundColor: colors.background }]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.header}>
          <TouchableOpacity
            onPress={handleClose}
            style={styles.closeButton}
            accessibilityRole="button"
            accessibilityLabel="Close"
          >
            <Text style={[styles.closeText, { color: colors.textSecondary }]}>{'✕'}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.body}>
          <Text style={[styles.title, { color: colors.text }]} accessibilityRole="header">
            Redeem a Code
          </Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Have a comp or reviewer code? Enter it here to unlock Pro on this device.
          </Text>

          <TextInput
            value={code}
            onChangeText={(v) => {
              setCode(formatCode(v));
              if (error) setError(null);
            }}
            placeholder="LUMI-XXXX-XXXX"
            placeholderTextColor={colors.textSecondary}
            autoCapitalize="characters"
            autoCorrect={false}
            spellCheck={false}
            editable={!busy && !success}
            style={[
              styles.input,
              {
                color: colors.text,
                borderColor: error ? '#E25555' : colors.buttonBorder,
                backgroundColor: colors.buttonBackground,
              },
            ]}
            accessibilityLabel="Redemption code"
          />

          {error ? (
            <Text style={[styles.error, { color: '#E25555' }]} accessibilityRole="alert">
              {error}
            </Text>
          ) : null}

          {success ? (
            <Text style={[styles.success, { color: colors.accent }]} accessibilityRole="alert">
              {success}
            </Text>
          ) : null}

          {success ? (
            <TouchableOpacity
              style={[styles.primaryButton, { backgroundColor: colors.accent }]}
              onPress={handleClose}
              accessibilityRole="button"
              accessibilityLabel="Close redeem screen"
            >
              <Text style={styles.primaryButtonText}>Done</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[
                styles.primaryButton,
                { backgroundColor: colors.accent, opacity: busy ? 0.6 : 1 },
              ]}
              onPress={handleSubmit}
              disabled={busy}
              accessibilityRole="button"
              accessibilityLabel="Redeem code"
            >
              {busy ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.primaryButtonText}>Redeem</Text>
              )}
            </TouchableOpacity>
          )}

          <Text style={[styles.fineprint, { color: colors.textSecondary }]}>
            Codes are tied to this device. If you reinstall the app, redeem again with the same code.
          </Text>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
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
  closeText: { fontSize: 18, fontWeight: '600' },
  body: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 32,
  },
  input: {
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 18,
    fontSize: 20,
    letterSpacing: 2,
    textAlign: 'center',
    fontWeight: '700',
  },
  error: {
    marginTop: 14,
    fontSize: 14,
    textAlign: 'center',
  },
  success: {
    marginTop: 14,
    fontSize: 16,
    textAlign: 'center',
    fontWeight: '600',
  },
  primaryButton: {
    marginTop: 24,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
  },
  fineprint: {
    marginTop: 28,
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
  },
});
