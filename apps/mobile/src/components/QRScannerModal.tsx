import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import type { BarcodeScanningResult } from 'expo-camera';
import type { QRPairingPayload } from '@luminadeck/shared';
import { useTheme } from '../contexts/ThemeContext';

interface QRScannerModalProps {
  visible: boolean;
  onScan: (payload: QRPairingPayload) => void;
  onClose: () => void;
}

/**
 * Validate and parse raw QR code data into a QRPairingPayload.
 * Returns the payload on success or null if the data is not a valid
 * LuminaDeck pairing QR code.
 */
function parseQRPayload(raw: string): QRPairingPayload | null {
  try {
    const parsed = JSON.parse(raw);

    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      typeof parsed.ip !== 'string' ||
      typeof parsed.port !== 'number' ||
      typeof parsed.certFingerprint !== 'string' ||
      typeof parsed.companionName !== 'string' ||
      typeof parsed.version !== 'string'
    ) {
      return null;
    }

    // Basic IP format check
    const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
    if (!ipRegex.test(parsed.ip)) {
      return null;
    }

    // Port range check
    if (parsed.port < 1 || parsed.port > 65535) {
      return null;
    }

    return {
      ip: parsed.ip,
      port: parsed.port,
      certFingerprint: parsed.certFingerprint,
      companionName: parsed.companionName,
      version: parsed.version,
    };
  } catch {
    return null;
  }
}

export function QRScannerModal({ visible, onScan, onClose }: QRScannerModalProps) {
  const { colors } = useTheme();
  const [permission, requestPermission] = useCameraPermissions();
  const [error, setError] = useState<string | null>(null);
  const [hasScanned, setHasScanned] = useState(false);

  // Reset state when modal opens
  useEffect(() => {
    if (visible) {
      setError(null);
      setHasScanned(false);
    }
  }, [visible]);

  // Request permission when modal becomes visible and not yet granted
  useEffect(() => {
    if (visible && permission && !permission.granted && permission.canAskAgain) {
      requestPermission();
    }
  }, [visible, permission, requestPermission]);

  const handleBarCodeScanned = useCallback(
    (result: BarcodeScanningResult) => {
      if (hasScanned) return;

      const payload = parseQRPayload(result.data);

      if (payload) {
        setHasScanned(true);
        setError(null);
        onScan(payload);
      } else {
        setError('This QR code is not a valid LuminaDeck pairing code. Make sure you are scanning the code displayed by the Companion app.');
      }
    },
    [hasScanned, onScan],
  );

  const handleDismissError = useCallback(() => {
    setError(null);
  }, []);

  // Permission still loading
  if (!permission) {
    return (
      <Modal
        visible={visible}
        animationType="slide"
        transparent={false}
        onRequestClose={onClose}
      >
        <View style={[styles.container, { backgroundColor: colors.background }]}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      </Modal>
    );
  }

  // Permission denied
  const showPermissionPrompt = !permission.granted;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={onClose}
      accessibilityViewIsModal
    >
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {/* Close button */}
        <View style={styles.topBar}>
          <TouchableOpacity
            onPress={onClose}
            style={styles.closeButton}
            accessibilityRole="button"
            accessibilityLabel="Close QR scanner"
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Text
              style={[styles.closeButtonText, { color: colors.text }]}
              allowFontScaling
              maxFontSizeMultiplier={1.5}
            >
              {'\u2715'}
            </Text>
          </TouchableOpacity>

          <Text
            style={[styles.headerTitle, { color: colors.text }]}
            allowFontScaling
            maxFontSizeMultiplier={1.5}
            accessibilityRole="header"
          >
            Scan QR Code
          </Text>

          {/* Spacer to center the title */}
          <View style={styles.closeButton} />
        </View>

        {showPermissionPrompt ? (
          /* Camera permission request UI */
          <View style={styles.permissionContainer}>
            <Text
              style={[styles.permissionIcon]}
              accessibilityElementsHidden
              importantForAccessibility="no"
            >
              {'\uD83D\uDCF7'}
            </Text>
            <Text
              style={[styles.permissionTitle, { color: colors.text }]}
              allowFontScaling
              maxFontSizeMultiplier={1.5}
            >
              Camera Access Required
            </Text>
            <Text
              style={[styles.permissionBody, { color: colors.textSecondary }]}
              allowFontScaling
              maxFontSizeMultiplier={1.5}
            >
              LuminaDeck needs camera access to scan the pairing QR code displayed by the Companion app on your PC.
            </Text>
            {permission.canAskAgain ? (
              <TouchableOpacity
                style={[styles.permissionButton, { backgroundColor: colors.accent }]}
                onPress={requestPermission}
                accessibilityRole="button"
                accessibilityLabel="Grant camera access"
              >
                <Text
                  style={styles.permissionButtonText}
                  allowFontScaling
                  maxFontSizeMultiplier={1.5}
                >
                  Allow Camera Access
                </Text>
              </TouchableOpacity>
            ) : (
              <Text
                style={[styles.permissionDeniedText, { color: colors.statusRed }]}
                allowFontScaling
                maxFontSizeMultiplier={1.5}
              >
                Camera permission was denied. Please enable it in your device Settings to use the QR scanner.
              </Text>
            )}
          </View>
        ) : (
          /* Camera viewfinder */
          <View style={styles.cameraContainer}>
            <CameraView
              style={styles.camera}
              facing="back"
              barcodeScannerSettings={{
                barcodeTypes: ['qr'],
              }}
              onBarcodeScanned={hasScanned ? undefined : handleBarCodeScanned}
            />

            {/* Scanning overlay */}
            <View style={styles.overlayContainer} pointerEvents="none">
              {/* Top overlay */}
              <View
                style={[styles.overlayTop, { backgroundColor: 'rgba(0,0,0,0.6)' }]}
              />
              {/* Middle row */}
              <View style={styles.overlayMiddleRow}>
                <View
                  style={[styles.overlaySide, { backgroundColor: 'rgba(0,0,0,0.6)' }]}
                />
                {/* Clear scanning window */}
                <View style={styles.scanWindow}>
                  {/* Corner brackets */}
                  <View
                    style={[
                      styles.cornerTopLeft,
                      { borderColor: colors.accent },
                    ]}
                  />
                  <View
                    style={[
                      styles.cornerTopRight,
                      { borderColor: colors.accent },
                    ]}
                  />
                  <View
                    style={[
                      styles.cornerBottomLeft,
                      { borderColor: colors.accent },
                    ]}
                  />
                  <View
                    style={[
                      styles.cornerBottomRight,
                      { borderColor: colors.accent },
                    ]}
                  />
                </View>
                <View
                  style={[styles.overlaySide, { backgroundColor: 'rgba(0,0,0,0.6)' }]}
                />
              </View>
              {/* Bottom overlay */}
              <View
                style={[styles.overlayBottom, { backgroundColor: 'rgba(0,0,0,0.6)' }]}
              />
            </View>

            {/* Instruction text below viewfinder */}
            <View style={styles.instructionContainer}>
              <Text
                style={[styles.instructionText, { color: colors.textSecondary }]}
                allowFontScaling
                maxFontSizeMultiplier={1.5}
              >
                Point your camera at the QR code shown in the LuminaDeck Companion app
              </Text>
            </View>
          </View>
        )}

        {/* Error toast */}
        {error !== null && (
          <View
            style={[styles.errorContainer, { backgroundColor: colors.statusRed + 'EE' }]}
            accessibilityRole="alert"
          >
            <Text
              style={styles.errorText}
              allowFontScaling
              maxFontSizeMultiplier={1.5}
            >
              {error}
            </Text>
            <TouchableOpacity
              onPress={handleDismissError}
              style={styles.errorDismiss}
              accessibilityRole="button"
              accessibilityLabel="Dismiss error"
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Text
                style={styles.errorDismissText}
                allowFontScaling
                maxFontSizeMultiplier={1.5}
              >
                {'\u2715'}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </Modal>
  );
}

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const SCAN_WINDOW_SIZE = Math.min(SCREEN_WIDTH * 0.65, 280);
const CORNER_SIZE = 24;
const CORNER_THICKNESS = 3;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    zIndex: 10,
  },
  closeButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 20,
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  // --- Permission UI ---
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  permissionIcon: {
    fontSize: 56,
    marginBottom: 20,
  },
  permissionTitle: {
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 12,
  },
  permissionBody: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 24,
  },
  permissionButton: {
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 28,
  },
  permissionButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  permissionDeniedText: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    paddingHorizontal: 16,
  },
  // --- Camera ---
  cameraContainer: {
    flex: 1,
  },
  camera: {
    flex: 1,
  },
  // --- Scanning overlay ---
  overlayContainer: {
    ...StyleSheet.absoluteFillObject,
  },
  overlayTop: {
    flex: 1,
  },
  overlayMiddleRow: {
    flexDirection: 'row',
    height: SCAN_WINDOW_SIZE,
  },
  overlaySide: {
    flex: 1,
  },
  scanWindow: {
    width: SCAN_WINDOW_SIZE,
    height: SCAN_WINDOW_SIZE,
  },
  overlayBottom: {
    flex: 1,
  },
  // Corner bracket decorations
  cornerTopLeft: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: CORNER_SIZE,
    height: CORNER_SIZE,
    borderTopWidth: CORNER_THICKNESS,
    borderLeftWidth: CORNER_THICKNESS,
    borderTopLeftRadius: 4,
  },
  cornerTopRight: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: CORNER_SIZE,
    height: CORNER_SIZE,
    borderTopWidth: CORNER_THICKNESS,
    borderRightWidth: CORNER_THICKNESS,
    borderTopRightRadius: 4,
  },
  cornerBottomLeft: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    width: CORNER_SIZE,
    height: CORNER_SIZE,
    borderBottomWidth: CORNER_THICKNESS,
    borderLeftWidth: CORNER_THICKNESS,
    borderBottomLeftRadius: 4,
  },
  cornerBottomRight: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: CORNER_SIZE,
    height: CORNER_SIZE,
    borderBottomWidth: CORNER_THICKNESS,
    borderRightWidth: CORNER_THICKNESS,
    borderBottomRightRadius: 4,
  },
  // --- Instruction ---
  instructionContainer: {
    position: 'absolute',
    bottom: 80,
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  instructionText: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  // --- Error toast ---
  errorContainer: {
    position: 'absolute',
    bottom: 40,
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    padding: 14,
    gap: 10,
  },
  errorText: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500',
  },
  errorDismiss: {
    padding: 4,
  },
  errorDismissText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
