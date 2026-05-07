# Android Release Keystore — One-time Setup

Required before the first Play Store upload. After this is done, every subsequent release build is automatic.

## Why this exists

Play Store rejects any APK/AAB signed with the `androiddebugkey` (which `debug.keystore` uses). You need a real release keystore that:

1. Identifies you as the publisher
2. Stays consistent across all future updates of the same app (Play Store rejects updates signed with a different key)
3. **Must never be lost.** If you lose it without using Play App Signing, you can never update the app again.

We are using **Play App Signing** (Google's recommended flow since 2021), where:

- You generate an "upload key" (this doc) and use it to sign uploads
- Google holds the actual "app signing key" that gets delivered to users
- If you lose your upload key, Google support can reset it — much safer than the legacy flow

## Pick one path

### Path A — Android Studio wizard (recommended; what you'll do anyway)

1. Open `apps/mobile/android` in Android Studio
2. Build → Generate Signed Bundle / APK → Android App Bundle → Next
3. "Create new..." under Key store path
4. Fill in:
   - Key store path: `C:\Dev\LuminaDeck\apps\mobile\android\app\release.keystore`
   - Password: pick a strong one (save in your password manager **right now** — you cannot recover this)
   - Alias: `luminadeck`
   - Key password: same as keystore password (simpler) or a different strong one
   - Validity: `25` years
   - Certificate: First/Last name, Organization (`CZRE`), City, State, Country code (`US`)
5. Click OK — Android Studio creates `release.keystore` and remembers the credentials for this Studio session
6. After it builds, Studio shows the AAB at `apps/mobile/android/app/release/app-release.aab`

The .gitignore now blocks `release.keystore` and `gradle.properties` from being committed, but **double-check** before any `git add -A` that these files don't appear in `git status`.

### Path B — CLI (if you prefer scripts)

From `apps/mobile/android/`:

```bash
keytool -genkeypair -v \
  -keystore app/release.keystore \
  -alias luminadeck \
  -keyalg RSA -keysize 2048 -validity 9125 \
  -storepass <STRONG_PASSWORD> \
  -keypass <STRONG_PASSWORD> \
  -dname "CN=Ceasar Esquivel, O=CZRE, L=<City>, ST=<State>, C=US"
```

Then create `apps/mobile/android/gradle.properties` (already in .gitignore):

```properties
LUMINADECK_UPLOAD_STORE_FILE=release.keystore
LUMINADECK_UPLOAD_KEY_ALIAS=luminadeck
LUMINADECK_UPLOAD_STORE_PASSWORD=<STRONG_PASSWORD>
LUMINADECK_UPLOAD_KEY_PASSWORD=<STRONG_PASSWORD>
```

Then build the AAB:

```bash
cd apps/mobile/android
./gradlew bundleRelease
```

Output: `apps/mobile/android/app/build/outputs/bundle/release/app-release.aab`

## Verify the signature

After building, run:

```bash
keytool -printcert -jarfile apps/mobile/android/app/build/outputs/bundle/release/app-release.aab
```

The owner should NOT say "Android Debug" — if it does, the build is still using the debug key. Re-check your `gradle.properties` paths.

## Backup

Right after creating the keystore:

1. Copy `release.keystore` to a separate offline backup (USB drive, encrypted cloud, etc.)
2. Save the passwords to your password manager
3. Note the SHA-256 fingerprint for future reference:
   ```bash
   keytool -list -v -keystore apps/mobile/android/app/release.keystore -alias luminadeck
   ```

## Already in place

- `build.gradle` reads `LUMINADECK_UPLOAD_*` properties when present, falls back to debug signing for local testing
- `apps/mobile/plugins/withAndroidLaunchHardening.js` reapplies release signing hooks and manifest permission removals after `expo prebuild`
- `.gitignore` blocks `*.keystore` (except `debug.keystore`), `*.jks`, and `gradle.properties` from accidentally being committed
- Bundle ID `com.luminadeck.app` is locked in — do NOT change this after first Play Store upload
