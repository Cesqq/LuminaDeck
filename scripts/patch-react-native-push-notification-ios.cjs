#!/usr/bin/env node

/**
 * LuminaDeck ships without React Native's deprecated iOS push notification
 * native module. RN 0.81.5 still constructs a NativeEventEmitter at
 * PushNotificationIOS.js module load, and on iOS that throws when
 * NativePushNotificationManagerIOS is null.
 *
 * This patch keeps incidental PushNotificationIOS access from becoming a
 * production-fatal JS exception during startup.
 */

const fs = require('fs');
const path = require('path');

const file = path.join(
  __dirname,
  '..',
  'node_modules',
  'react-native',
  'Libraries',
  'PushNotificationIOS',
  'PushNotificationIOS.js',
);

const sentinel = '__luminadeck_pushnotif_stub_patched__';

if (!fs.existsSync(file)) {
  console.warn(`[luminadeck-patch] ${file} not found; skipping`);
  process.exit(0);
}

const source = fs.readFileSync(file, 'utf8');

if (source.includes(sentinel)) {
  console.log('[luminadeck-patch] PushNotificationIOS stub already applied');
  process.exit(0);
}

const original = `const PushNotificationEmitter =
  new NativeEventEmitter<NativePushNotificationIOSEventDefinitions>(
    // T88715063: NativeEventEmitter only used this parameter on iOS. Now it uses it on all platforms, so this code was modified automatically to preserve its behavior
    // If you want to use the native module on other platforms, please remove this condition and test its behavior
    Platform.OS !== 'ios' ? null : NativePushNotificationManagerIOS,
  );`;

const replacement = `// ${sentinel}
const _luminadeckStubEmitter: any = {
  addListener: () => ({remove: () => {}}),
  removeAllListeners: () => {},
  listenerCount: () => 0,
  emit: () => {},
};

const PushNotificationEmitter: any =
  Platform.OS === 'ios' && !NativePushNotificationManagerIOS
    ? _luminadeckStubEmitter
    : new NativeEventEmitter<NativePushNotificationIOSEventDefinitions>(
        // T88715063: NativeEventEmitter only used this parameter on iOS. Now it uses it on all platforms, so this code was modified automatically to preserve its behavior
        // If you want to use the native module on other platforms, please remove this condition and test its behavior
        Platform.OS !== 'ios' ? null : NativePushNotificationManagerIOS,
      );`;

if (!source.includes(original)) {
  console.error('[luminadeck-patch] PushNotificationIOS emitter block not found; RN file changed');
  process.exit(1);
}

fs.writeFileSync(file, source.replace(original, replacement));
console.log('[luminadeck-patch] PushNotificationIOS null-native-module stub applied');
