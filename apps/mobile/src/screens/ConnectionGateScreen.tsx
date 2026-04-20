import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Animated,
  Easing,
  ActivityIndicator,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DEFAULT_PORT } from '@luminadeck/shared';
import { useTheme } from '../contexts/ThemeContext';
import { useConnection } from '../contexts/ConnectionContext';
import { discovery, type DiscoveredCompanion } from '../lib/discovery';

const LAST_CONNECTION_KEY = '@luminadeck/last_connection';
const SCAN_TIMEOUT_MS = 10_000;

interface LastConnection {
  ip: string;
  port: number;
  name?: string;
}

interface ConnectionGateScreenProps {
  onConnected: () => void;
}

export function ConnectionGateScreen({ onConnected }: ConnectionGateScreenProps) {
  const { colors } = useTheme();
  const { status, connect } = useConnection();

  // Discovery state
  const [companions, setCompanions] = useState<DiscoveredCompanion[]>([]);
  const [scanTimedOut, setScanTimedOut] = useState(false);
  const [isScanning, setIsScanning] = useState(false);

  // Last connection for reconnect
  const [lastConnection, setLastConnection] = useState<LastConnection | null>(null);

  // Manual connect
  const [manualExpanded, setManualExpanded] = useState(false);
  const [manualIp, setManualIp] = useState('');
  const [manualPort, setManualPort] = useState(String(DEFAULT_PORT));

  // Pulse animation
  const pulseAnim = useRef(new Animated.Value(0.6)).current;

  // Track connection status for auto-transition
  const prevStatusRef = useRef(status);

  // Load last connection from storage
  useEffect(() => {
    AsyncStorage.getItem(LAST_CONNECTION_KEY).then((raw) => {
      if (raw) {
        try {
          const parsed: LastConnection = JSON.parse(raw);
          if (parsed.ip && parsed.port) {
            setLastConnection(parsed);
          }
        } catch {
          // Corrupted data -- ignore
        }
      }
    });
  }, []);

  // Start mDNS scan on mount
  useEffect(() => {
    setIsScanning(true);
    setScanTimedOut(false);

    discovery.startScan();

    const unsubscribe = discovery.onUpdate((found) => {
      setCompanions([...found]);
    });

    const timeout = setTimeout(() => {
      setScanTimedOut(true);
      setIsScanning(false);
    }, SCAN_TIMEOUT_MS);

    return () => {
      clearTimeout(timeout);
      unsubscribe();
      discovery.stopScan();
    };
  }, []);

  // Pulse animation loop
  useEffect(() => {
    if (!isScanning) return;

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0.6,
          duration: 1000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );

    loop.start();
    return () => loop.stop();
  }, [isScanning, pulseAnim]);

  // When status becomes connected, call onConnected
  useEffect(() => {
    if (prevStatusRef.current !== 'connected' && status === 'connected') {
      onConnected();
    }
    prevStatusRef.current = status;
  }, [status, onConnected]);

  // Cancel scan timeout when a companion is found
  useEffect(() => {
    if (companions.length > 0) {
      setScanTimedOut(false);
    }
  }, [companions]);

  const handleConnectTo = useCallback(
    (ip: string, port: number) => {
      connect(ip, port);
    },
    [connect],
  );

  const handleReconnect = useCallback(() => {
    if (lastConnection) {
      connect(lastConnection.ip, lastConnection.port);
    }
  }, [lastConnection, connect]);

  const handleManualConnect = useCallback(() => {
    const trimmedIp = manualIp.trim();
    const portNum = parseInt(manualPort, 10);

    if (!trimmedIp) return;

    const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
    if (!ipRegex.test(trimmedIp)) return;

    if (isNaN(portNum) || portNum < 1 || portNum > 65535) return;

    connect(trimmedIp, portNum);
  }, [manualIp, manualPort, connect]);

  const isConnecting = status === 'connecting';

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      {/* App logo / name */}
      <View style={styles.header}>
        <Text
          style={[styles.logoText, { color: colors.accent }]}
          allowFontScaling
          maxFontSizeMultiplier={1.5}
        >
          LuminaDeck
        </Text>
        <Text
          style={[styles.tagline, { color: colors.textSecondary }]}
          allowFontScaling
          maxFontSizeMultiplier={1.5}
        >
          Connect to your companion PC
        </Text>
      </View>

      {/* Reconnect button (if last connection exists) */}
      {lastConnection && (
        <View style={styles.section}>
          <TouchableOpacity
            style={[
              styles.reconnectButton,
              {
                backgroundColor: isConnecting ? colors.buttonBackground : colors.accent,
                borderColor: colors.accent,
              },
            ]}
            onPress={handleReconnect}
            disabled={isConnecting}
            accessibilityRole="button"
            accessibilityLabel={`Reconnect to ${lastConnection.name ?? lastConnection.ip}`}
            accessibilityState={{ disabled: isConnecting }}
          >
            {isConnecting ? (
              <ActivityIndicator color={colors.text} size="small" />
            ) : (
              <Text
                style={styles.reconnectButtonText}
                allowFontScaling
                maxFontSizeMultiplier={1.5}
              >
                Reconnect to {lastConnection.name ?? lastConnection.ip}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      )}

      {/* Scanning section */}
      <View style={styles.scanSection}>
        {isScanning && companions.length === 0 && (
          <>
            <View style={styles.pulseContainer}>
              <Animated.View
                style={[
                  styles.pulseCircle,
                  {
                    borderColor: colors.accent,
                    opacity: pulseAnim,
                    transform: [
                      {
                        scale: pulseAnim.interpolate({
                          inputRange: [0.6, 1],
                          outputRange: [0.8, 1.2],
                        }),
                      },
                    ],
                  },
                ]}
              />
              <Animated.View
                style={[
                  styles.pulseCircleInner,
                  {
                    backgroundColor: colors.accent + '33',
                    opacity: pulseAnim,
                  },
                ]}
              />
            </View>
            <Text
              style={[styles.scanningText, { color: colors.textSecondary }]}
              allowFontScaling
              maxFontSizeMultiplier={1.5}
            >
              Searching for LuminaDeck Companion...
            </Text>
          </>
        )}

        {scanTimedOut && companions.length === 0 && (
          <Text
            style={[styles.noCompanionsText, { color: colors.textSecondary }]}
            allowFontScaling
            maxFontSizeMultiplier={1.5}
          >
            No companions found
          </Text>
        )}

        {/* Discovered companions */}
        {companions.length > 0 && (
          <View style={styles.companionList}>
            <Text
              style={[styles.sectionTitle, { color: colors.text }]}
              allowFontScaling
              maxFontSizeMultiplier={1.5}
            >
              Found on your network
            </Text>
            {companions.map((companion) => (
              <TouchableOpacity
                key={companion.ip}
                style={[
                  styles.companionCard,
                  {
                    backgroundColor: colors.buttonBackground,
                    borderColor: colors.buttonBorder,
                  },
                ]}
                onPress={() => handleConnectTo(companion.ip, companion.port)}
                disabled={isConnecting}
                accessibilityRole="button"
                accessibilityLabel={`Connect to ${companion.name} at ${companion.ip}`}
              >
                <View style={styles.companionInfo}>
                  <Text
                    style={[styles.companionName, { color: colors.text }]}
                    allowFontScaling
                    maxFontSizeMultiplier={1.5}
                    numberOfLines={1}
                  >
                    {companion.name}
                  </Text>
                  <Text
                    style={[styles.companionIp, { color: colors.textSecondary }]}
                    allowFontScaling
                    maxFontSizeMultiplier={1.5}
                  >
                    {companion.ip}:{companion.port}
                  </Text>
                </View>
                <Text
                  style={[styles.companionArrow, { color: colors.accent }]}
                  allowFontScaling
                  maxFontSizeMultiplier={1.5}
                >
                  {'\u203A'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      {/* Collapsible manual connect */}
      <View style={styles.section}>
        <TouchableOpacity
          style={styles.collapseHeader}
          onPress={() => setManualExpanded((prev) => !prev)}
          accessibilityRole="button"
          accessibilityLabel={manualExpanded ? 'Collapse manual connect' : 'Expand manual connect'}
          accessibilityState={{ expanded: manualExpanded }}
        >
          <Text
            style={[styles.collapseTitle, { color: colors.text }]}
            allowFontScaling
            maxFontSizeMultiplier={1.5}
          >
            Connect Manually
          </Text>
          <Text
            style={[styles.collapseChevron, { color: colors.textSecondary }]}
            allowFontScaling
            maxFontSizeMultiplier={1.5}
          >
            {manualExpanded ? '\u25B2' : '\u25BC'}
          </Text>
        </TouchableOpacity>

        {manualExpanded && (
          <View style={styles.manualForm}>
            <View style={styles.inputRow}>
              <View style={styles.ipInputContainer}>
                <Text
                  style={[styles.inputLabel, { color: colors.textSecondary }]}
                  allowFontScaling
                  maxFontSizeMultiplier={1.5}
                >
                  IP Address
                </Text>
                <TextInput
                  style={[
                    styles.textInput,
                    {
                      backgroundColor: colors.buttonBackground,
                      color: colors.text,
                      borderColor: colors.buttonBorder,
                    },
                  ]}
                  value={manualIp}
                  onChangeText={setManualIp}
                  placeholder="192.168.1.100"
                  placeholderTextColor={colors.textSecondary + '88'}
                  keyboardType="decimal-pad"
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="next"
                  accessibilityLabel="IP address input"
                  allowFontScaling
                  maxFontSizeMultiplier={1.5}
                />
              </View>
              <View style={styles.portInputContainer}>
                <Text
                  style={[styles.inputLabel, { color: colors.textSecondary }]}
                  allowFontScaling
                  maxFontSizeMultiplier={1.5}
                >
                  Port
                </Text>
                <TextInput
                  style={[
                    styles.textInput,
                    {
                      backgroundColor: colors.buttonBackground,
                      color: colors.text,
                      borderColor: colors.buttonBorder,
                    },
                  ]}
                  value={manualPort}
                  onChangeText={setManualPort}
                  placeholder={String(DEFAULT_PORT)}
                  placeholderTextColor={colors.textSecondary + '88'}
                  keyboardType="number-pad"
                  returnKeyType="done"
                  accessibilityLabel="Port number input"
                  allowFontScaling
                  maxFontSizeMultiplier={1.5}
                />
              </View>
            </View>
            <TouchableOpacity
              style={[
                styles.connectButton,
                {
                  backgroundColor: isConnecting ? colors.textSecondary : colors.accent,
                },
              ]}
              onPress={handleManualConnect}
              disabled={isConnecting}
              accessibilityRole="button"
              accessibilityLabel="Connect to companion PC"
              accessibilityState={{ disabled: isConnecting }}
            >
              <Text
                style={styles.connectButtonText}
                allowFontScaling
                maxFontSizeMultiplier={1.5}
              >
                {isConnecting ? 'Connecting...' : 'Connect'}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* QR Code button */}
      <View style={styles.section}>
        <TouchableOpacity
          style={[styles.qrButton, { borderColor: colors.accent }]}
          onPress={() => {
            // QR scanner is handled by the existing QRScannerModal component
            // For now, expand manual connect as fallback
            setManualExpanded(true);
          }}
          accessibilityRole="button"
          accessibilityLabel="Scan QR code to connect"
        >
          <Text
            style={[styles.qrButtonText, { color: colors.accent }]}
            allowFontScaling
            maxFontSizeMultiplier={1.5}
          >
            Scan QR Code
          </Text>
        </TouchableOpacity>
      </View>

      {/* Connection error feedback */}
      {status === 'error' && (
        <View style={styles.section}>
          <Text
            style={[styles.errorText, { color: colors.statusRed }]}
            allowFontScaling
            maxFontSizeMultiplier={1.5}
          >
            Connection failed. Check that the companion app is running and try again.
          </Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
    paddingTop: 48,
    paddingBottom: 32,
  },
  logoText: {
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: 1,
  },
  tagline: {
    fontSize: 14,
    marginTop: 8,
  },
  section: {
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 12,
  },
  reconnectButton: {
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  reconnectButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  scanSection: {
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 24,
    minHeight: 120,
  },
  pulseContainer: {
    width: 80,
    height: 80,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  pulseCircle: {
    position: 'absolute',
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 2,
  },
  pulseCircleInner: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  scanningText: {
    fontSize: 14,
    textAlign: 'center',
  },
  noCompanionsText: {
    fontSize: 14,
    textAlign: 'center',
    paddingVertical: 24,
  },
  companionList: {
    width: '100%',
  },
  companionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
  },
  companionInfo: {
    flex: 1,
  },
  companionName: {
    fontSize: 16,
    fontWeight: '600',
  },
  companionIp: {
    fontSize: 13,
    marginTop: 2,
  },
  companionArrow: {
    fontSize: 24,
    fontWeight: '300',
    paddingLeft: 8,
  },
  collapseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  collapseTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  collapseChevron: {
    fontSize: 12,
  },
  manualForm: {
    marginTop: 4,
  },
  inputRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  ipInputContainer: {
    flex: 3,
  },
  portInputContainer: {
    flex: 1,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  textInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
  },
  connectButton: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  connectButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  qrButton: {
    borderWidth: 1.5,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  qrButtonText: {
    fontSize: 15,
    fontWeight: '700',
  },
  errorText: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
});
