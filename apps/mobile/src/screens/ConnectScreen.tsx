import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  Linking,
} from 'react-native';
import * as SecureStore from 'expo-secure-store';
import type { PairedDevice } from '@luminadeck/shared';
import { DEFAULT_PORT } from '@luminadeck/shared';
import { useTheme } from '../contexts/ThemeContext';
import { useConnection } from '../contexts/ConnectionContext';
import { ConnectionStatus } from '../components/ConnectionStatus';

const PAIRED_DEVICES_KEY = 'luminadeck_paired_devices';

export function ConnectScreen() {
  const { colors } = useTheme();
  const { status, connect, disconnect } = useConnection();
  const [ipAddress, setIpAddress] = useState('');
  const [port, setPort] = useState(String(DEFAULT_PORT));
  const [pairedDevices, setPairedDevices] = useState<PairedDevice[]>([]);

  useEffect(() => {
    loadPairedDevices();
  }, []);

  const loadPairedDevices = async () => {
    try {
      const raw = await SecureStore.getItemAsync(PAIRED_DEVICES_KEY);
      if (raw) {
        const devices = JSON.parse(raw) as PairedDevice[];
        setPairedDevices(devices);
      }
    } catch {
      // No paired devices stored yet
    }
  };

  const savePairedDevice = async (device: PairedDevice) => {
    try {
      const existing = [...pairedDevices];
      const idx = existing.findIndex((d) => d.id === device.id);
      if (idx >= 0) {
        existing[idx] = { ...device, lastSeen: new Date().toISOString() };
      } else {
        existing.push(device);
      }
      await SecureStore.setItemAsync(PAIRED_DEVICES_KEY, JSON.stringify(existing));
      setPairedDevices(existing);
    } catch {
      // SecureStore failure — non-fatal
    }
  };

  const removePairedDevice = async (deviceId: string) => {
    const filtered = pairedDevices.filter((d) => d.id !== deviceId);
    try {
      await SecureStore.setItemAsync(PAIRED_DEVICES_KEY, JSON.stringify(filtered));
    } catch {
      // Ignore
    }
    setPairedDevices(filtered);
  };

  const handleConnect = useCallback(() => {
    const trimmedIp = ipAddress.trim();
    const portNum = parseInt(port, 10);

    if (!trimmedIp) {
      Alert.alert('Missing IP', 'Please enter the companion PC IP address.');
      return;
    }

    const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
    if (!ipRegex.test(trimmedIp)) {
      Alert.alert('Invalid IP', 'Please enter a valid IPv4 address (e.g. 192.168.1.100).');
      return;
    }

    if (isNaN(portNum) || portNum < 1 || portNum > 65535) {
      Alert.alert('Invalid Port', 'Port must be between 1 and 65535.');
      return;
    }

    connect(trimmedIp, portNum);

    // Save as paired device
    const deviceId = `${trimmedIp}:${portNum}`;
    savePairedDevice({
      id: deviceId,
      name: `PC at ${trimmedIp}`,
      ip: trimmedIp,
      port: portNum,
      certFingerprint: '', // Will be populated after TLS handshake
      pairedAt: new Date().toISOString(),
    });
  }, [ipAddress, port, connect, pairedDevices]);

  const handleDisconnect = useCallback(() => {
    disconnect();
  }, [disconnect]);

  const handleConnectToDevice = useCallback(
    (device: PairedDevice) => {
      setIpAddress(device.ip);
      setPort(String(device.port));
      connect(device.ip, device.port);
    },
    [connect],
  );

  const handleRemoveDevice = useCallback(
    (device: PairedDevice) => {
      Alert.alert(
        'Remove Device',
        `Remove "${device.name}" from paired devices?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Remove',
            style: 'destructive',
            onPress: () => removePairedDevice(device.id),
          },
        ],
      );
    },
    [pairedDevices],
  );

  const handleQRScan = useCallback(() => {
    Alert.alert(
      'QR Scanner',
      'Camera-based QR scanning will be available in a future update. For now, enter the IP address manually from the companion app.',
    );
  }, []);

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      {/* Connection Status */}
      <View style={styles.statusSection}>
        <ConnectionStatus status={status} colors={colors} />
        {status === 'connected' && (
          <TouchableOpacity
            onPress={handleDisconnect}
            style={[styles.disconnectButton, { borderColor: colors.statusRed }]}
            accessibilityRole="button"
            accessibilityLabel="Disconnect from companion"
          >
            <Text
              style={[styles.disconnectText, { color: colors.statusRed }]}
              allowFontScaling
              maxFontSizeMultiplier={1.5}
            >
              Disconnect
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* QR Scanner */}
      <View style={styles.section}>
        <Text
          style={[styles.sectionTitle, { color: colors.text }]}
          allowFontScaling
          maxFontSizeMultiplier={1.5}
        >
          Quick Connect
        </Text>
        <TouchableOpacity
          style={[styles.qrButton, { backgroundColor: colors.accent }]}
          onPress={handleQRScan}
          accessibilityRole="button"
          accessibilityLabel="Scan QR code to connect"
        >
          <Text
            style={styles.qrButtonText}
            allowFontScaling
            maxFontSizeMultiplier={1.5}
          >
            Scan QR Code
          </Text>
        </TouchableOpacity>
        <Text
          style={[styles.qrHint, { color: colors.textSecondary }]}
          allowFontScaling
          maxFontSizeMultiplier={1.5}
        >
          Scan the QR code shown in the LuminaDeck Companion app on your PC
        </Text>
      </View>

      {/* Manual Connection */}
      <View style={styles.section}>
        <Text
          style={[styles.sectionTitle, { color: colors.text }]}
          allowFontScaling
          maxFontSizeMultiplier={1.5}
        >
          Manual Connection
        </Text>

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
              value={ipAddress}
              onChangeText={setIpAddress}
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
              value={port}
              onChangeText={setPort}
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
              backgroundColor:
                status === 'connecting' ? colors.textSecondary : colors.accent,
            },
          ]}
          onPress={handleConnect}
          disabled={status === 'connecting'}
          accessibilityRole="button"
          accessibilityLabel="Connect to companion PC"
          accessibilityState={{ disabled: status === 'connecting' }}
        >
          <Text
            style={styles.connectButtonText}
            allowFontScaling
            maxFontSizeMultiplier={1.5}
          >
            {status === 'connecting' ? 'Connecting...' : 'Connect'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Paired Devices */}
      <View style={styles.section}>
        <Text
          style={[styles.sectionTitle, { color: colors.text }]}
          allowFontScaling
          maxFontSizeMultiplier={1.5}
        >
          Paired Devices
        </Text>

        {pairedDevices.length === 0 ? (
          <Text
            style={[styles.emptyText, { color: colors.textSecondary }]}
            allowFontScaling
            maxFontSizeMultiplier={1.5}
          >
            No paired devices yet. Connect to a companion PC to add one.
          </Text>
        ) : (
          pairedDevices.map((device) => (
            <View
              key={device.id}
              style={[styles.deviceCard, { backgroundColor: colors.buttonBackground, borderColor: colors.buttonBorder }]}
            >
              <View style={styles.deviceInfo}>
                <Text
                  style={[styles.deviceName, { color: colors.text }]}
                  allowFontScaling
                  maxFontSizeMultiplier={1.5}
                  numberOfLines={1}
                >
                  {device.name}
                </Text>
                <Text
                  style={[styles.deviceAddress, { color: colors.textSecondary }]}
                  allowFontScaling
                  maxFontSizeMultiplier={1.5}
                >
                  {device.ip}:{device.port}
                </Text>
              </View>
              <View style={styles.deviceActions}>
                <TouchableOpacity
                  onPress={() => handleConnectToDevice(device)}
                  style={[styles.deviceActionButton, { backgroundColor: colors.accent }]}
                  accessibilityRole="button"
                  accessibilityLabel={`Connect to ${device.name}`}
                >
                  <Text
                    style={styles.deviceActionText}
                    allowFontScaling
                    maxFontSizeMultiplier={1.5}
                  >
                    Connect
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => handleRemoveDevice(device)}
                  style={styles.removeButton}
                  accessibilityRole="button"
                  accessibilityLabel={`Remove ${device.name}`}
                >
                  <Text
                    style={[styles.removeText, { color: colors.statusRed }]}
                    allowFontScaling
                    maxFontSizeMultiplier={1.5}
                  >
                    Remove
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </View>

      {/* Download Companion Info */}
      <View style={[styles.section, styles.infoSection]}>
        <Text
          style={[styles.sectionTitle, { color: colors.text }]}
          allowFontScaling
          maxFontSizeMultiplier={1.5}
        >
          Get the Companion App
        </Text>
        <Text
          style={[styles.infoText, { color: colors.textSecondary }]}
          allowFontScaling
          maxFontSizeMultiplier={1.5}
        >
          LuminaDeck requires the free companion app running on your Windows PC. The companion receives commands from this app and executes them on your computer.
        </Text>
        <TouchableOpacity
          style={[styles.downloadButton, { borderColor: colors.accent }]}
          onPress={() => {
            Linking.openURL('https://luminadeck.app/download');
          }}
          accessibilityRole="link"
          accessibilityLabel="Download LuminaDeck Companion for Windows"
        >
          <Text
            style={[styles.downloadText, { color: colors.accent }]}
            allowFontScaling
            maxFontSizeMultiplier={1.5}
          >
            Download for Windows
          </Text>
        </TouchableOpacity>
      </View>
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
  statusSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 16,
  },
  disconnectButton: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  disconnectText: {
    fontSize: 13,
    fontWeight: '600',
  },
  section: {
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 12,
  },
  qrButton: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 8,
  },
  qrButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  qrHint: {
    fontSize: 12,
    textAlign: 'center',
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
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
    paddingVertical: 16,
  },
  deviceCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  deviceInfo: {
    marginBottom: 8,
  },
  deviceName: {
    fontSize: 15,
    fontWeight: '600',
  },
  deviceAddress: {
    fontSize: 13,
    marginTop: 2,
  },
  deviceActions: {
    flexDirection: 'row',
    gap: 8,
  },
  deviceActionButton: {
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  deviceActionText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  removeButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  removeText: {
    fontSize: 13,
    fontWeight: '600',
  },
  infoSection: {
    marginTop: 8,
  },
  infoText: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 12,
  },
  downloadButton: {
    borderWidth: 1.5,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  downloadText: {
    fontSize: 15,
    fontWeight: '700',
  },
});
