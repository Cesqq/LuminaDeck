const { withAndroidManifest, withAppBuildGradle } = require('@expo/config-plugins');

const REMOVED_PERMISSIONS = [
  'android.permission.READ_EXTERNAL_STORAGE',
  'android.permission.RECORD_AUDIO',
  'android.permission.SYSTEM_ALERT_WINDOW',
  'android.permission.WRITE_EXTERNAL_STORAGE',
];

function ensureRemovedPermission(manifest, permissionName) {
  manifest['uses-permission'] = manifest['uses-permission'] ?? [];
  const existing = manifest['uses-permission'].find(
    (entry) => entry?.$?.['android:name'] === permissionName,
  );

  if (existing) {
    existing.$['tools:node'] = 'remove';
    return;
  }

  manifest['uses-permission'].push({
    $: {
      'android:name': permissionName,
      'tools:node': 'remove',
    },
  });
}

function withAndroidManifestHardening(config) {
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults.manifest;
    manifest.$ = manifest.$ ?? {};
    manifest.$['xmlns:tools'] = manifest.$['xmlns:tools'] ?? 'http://schemas.android.com/tools';

    for (const permission of REMOVED_PERMISSIONS) {
      ensureRemovedPermission(manifest, permission);
    }

    const application = manifest.application?.[0];
    if (application?.$) {
      application.$['android:usesCleartextTraffic'] = 'true';
    }

    return config;
  });
}

function withAndroidReleaseSigning(config) {
  return withAppBuildGradle(config, (config) => {
    let contents = config.modResults.contents;

    if (!contents.includes('LUMINADECK_UPLOAD_STORE_FILE')) {
      contents = contents.replace(
        /(signingConfigs\s*\{[\s\S]*?debug\s*\{[\s\S]*?\n\s*}\s*)\n\s*}/,
        `$1
        release {
            if (project.hasProperty('LUMINADECK_UPLOAD_STORE_FILE')) {
                storeFile file(LUMINADECK_UPLOAD_STORE_FILE)
                storePassword LUMINADECK_UPLOAD_STORE_PASSWORD
                keyAlias LUMINADECK_UPLOAD_KEY_ALIAS
                keyPassword LUMINADECK_UPLOAD_KEY_PASSWORD
            }
        }
    }`,
      );
    }

    contents = contents.replace(
      /release\s*\{\s*\n\s*signingConfig signingConfigs\.debug/,
      `release {
            // Use release signing when LUMINADECK_UPLOAD_* properties are set.
            signingConfig project.hasProperty('LUMINADECK_UPLOAD_STORE_FILE') ? signingConfigs.release : signingConfigs.debug`,
    );

    config.modResults.contents = contents;
    return config;
  });
}

module.exports = function withAndroidLaunchHardening(config) {
  config = withAndroidManifestHardening(config);
  config = withAndroidReleaseSigning(config);
  return config;
};
