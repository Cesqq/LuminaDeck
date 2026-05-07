#!/usr/bin/env bash
# Run on the Mac (rsaczr@10.0.0.50). Archives + signs + uploads the iOS
# build to App Store Connect using only Xcode tooling — no eas-cli.
#
# Prereqs (one-time, human-required):
#   1. Xcode → Settings → Accounts → Apple ID signed in
#   2. Manage Certificates → "+" → Apple Distribution (creates the cert)
#   3. App Store provisioning profile auto-downloads after #2
#   4. Source synced to ~/LuminaDeck (use sync-to-mac.sh from the PC)
#   5. ASC API key at ~/.keys/AuthKey_5G4BLJ82KH.p8 (synced separately)

set -euo pipefail

REPO_ROOT="${REPO_ROOT:-$HOME/LuminaDeck}"
APP_DIR="$REPO_ROOT/apps/mobile"
EXPORT_OPTS="$REPO_ROOT/scripts/ExportOptions.plist"
SIGN_XCCONFIG="$REPO_ROOT/scripts/ReleaseSign.xcconfig"
ARCHIVE_PATH="$HOME/LuminaDeck.xcarchive"
EXPORT_DIR="$HOME/LuminaDeck-export"
ASC_KEY_ID="5G4BLJ82KH"
ASC_KEY_ISSUER="b9dc67a7-763a-4031-aa71-ada7964eddd5"
ASC_KEY_PATH="$HOME/.keys/AuthKey_${ASC_KEY_ID}.p8"
APPLE_TEAM_ID="7A2K2PDKW4"

# Brew + locale setup (Apple Silicon Mac)
export PATH="$HOME/.local/bin:$PATH"
[ -x /opt/homebrew/bin/brew ] && eval "$(/opt/homebrew/bin/brew shellenv)"
export LANG=en_US.UTF-8

cd "$APP_DIR"

echo "[1/6] Installing JS deps…"
pnpm install --frozen-lockfile

echo "[1b/6] Cleaning stale iOS native artifacts…"
rm -rf ios/Pods ios/Podfile.lock ios/build
# Xcode may still have an indexer handle open if the workspace was opened
# for inspection. Stale DerivedData should be cleaned when possible, but it
# must not abort the archive if macOS races the delete.
rm -rf "$HOME/Library/Developer/Xcode/DerivedData"/LuminaDeck-* 2>/dev/null || true
rm -rf "$ARCHIVE_PATH" "$EXPORT_DIR"

echo "[2/6] Expo prebuild (iOS)…"
npx expo prebuild --platform ios --clean

echo "[3/6] CocoaPods install…"
cd ios
pod install --repo-update
cd ..

# Xcode 16.4 / clang 17 is stricter about fmt 11's consteval usage in
# Folly/RN pods. Pods/ is regenerated above, so re-apply the known safe
# one-line workaround before archive every time.
FMT_BASE_H="ios/Pods/fmt/include/fmt/base.h"
if [ -f "$FMT_BASE_H" ]; then
  if grep -q '^#  define FMT_CONSTEVAL consteval$' "$FMT_BASE_H"; then
    sed -i.bak 's|^#  define FMT_CONSTEVAL consteval$|/* __luminadeck_fmt_consteval_fix__ */ #  define FMT_CONSTEVAL|' "$FMT_BASE_H"
    echo "    patched fmt: disabled FMT_CONSTEVAL for clang 17 archive"
  elif grep -q '__luminadeck_fmt_consteval_fix__' "$FMT_BASE_H"; then
    echo "    fmt consteval patch already applied"
  fi
fi

# Patch Expo's prebuild output: the template hardcodes
# "CODE_SIGN_IDENTITY[sdk=iphoneos*] = iPhone Developer" in pbxproj which
# forces every archive to fall back to the Development cert. Remove the
# line so automatic signing + DEVELOPMENT_TEAM picks Apple Distribution
# for the Release archive action.
PBXPROJ="ios/LuminaDeck.xcodeproj/project.pbxproj"
if [ -f "$PBXPROJ" ]; then
  if grep -q '"CODE_SIGN_IDENTITY\[sdk=iphoneos\*\]" = "iPhone Developer"' "$PBXPROJ"; then
    sed -i '' '/"CODE_SIGN_IDENTITY\[sdk=iphoneos\*\]" = "iPhone Developer";/d' "$PBXPROJ"
    echo "    patched pbxproj: removed hardcoded iPhone Developer identity"
  fi
fi

echo "[3b/6] Applying optional native target patcher…"
# Launch-safe default: this patcher now ships the main iPhone app only.
# Set ENABLE_WIDGET=1 only after the App Group, widget App ID, keychain
# access group, and provisioning profiles have been verified in Apple
# Developer/App Store Connect. Watch remains separately gated behind
# ENABLE_WATCH=1 because xcodeproj 1.27 has a cross-platform add_dependency
# quirk and watch icons still need the final asset-catalog path.
if ! gem list -i xcodeproj >/dev/null 2>&1; then
  echo "    installing xcodeproj gem (user)…"
  gem install --user-install xcodeproj >/dev/null
fi
ruby "$REPO_ROOT/scripts/ios-apply-native-targets.rb"
cd "$APP_DIR"

echo "[4/6] Resolving xcworkspace…"
WORKSPACE=$(printf '%s\n' ios/*.xcworkspace | head -1)
if [ ! -d "$WORKSPACE" ]; then
  echo "ERROR: no xcworkspace found in ios/ — prebuild may have failed"
  ls -la ios/ | head
  exit 1
fi
SCHEME=$(basename "$WORKSPACE" .xcworkspace)
echo "    workspace: $WORKSPACE"
echo "    scheme:    $SCHEME"

echo "[5/6] Archiving (Release, unsigned/keychain-safe)…"
rm -rf "$ARCHIVE_PATH" "$EXPORT_DIR"
#
# Important: direct SSH `xcodebuild archive` reaches the framework signing
# phase and then macOS denies keychain UI (`errSecInternalComponent`). The
# proven no-touch flow is:
#   1. Archive with CODE_SIGNING_ALLOWED=NO. This verifies native code and
#      creates a valid .xcarchive without touching the login keychain.
#   2. Export/upload from a temporary LaunchAgent in gui/$UID. The process
#      then runs in the logged-in Aqua session and can use the keychain
#      without modifying keychain ACLs or asking the user to click.
xcodebuild \
  -workspace "$WORKSPACE" \
  -scheme "$SCHEME" \
  -configuration Release \
  -destination "generic/platform=iOS" \
  -archivePath "$ARCHIVE_PATH" \
  -xcconfig "$SIGN_XCCONFIG" \
  CODE_SIGNING_ALLOWED=NO \
  archive

echo "[6/6] Exporting + uploading IPA to App Store Connect via GUI LaunchAgent…"
UID_NUM=$(id -u)
LAUNCH_LABEL="com.luminadeck.export-upload"
LAUNCH_AGENT="$HOME/Library/LaunchAgents/${LAUNCH_LABEL}.plist"
EXPORT_JOB="$HOME/.luminadeck-export-upload.sh"
EXPORT_STDOUT="$HOME/luminadeck-export-upload.out"
EXPORT_STDERR="$HOME/luminadeck-export-upload.err"
mkdir -p "$HOME/Library/LaunchAgents"

cat > "$EXPORT_JOB" <<SH
#!/usr/bin/env bash
set -euo pipefail
export PATH="/opt/homebrew/bin:/opt/homebrew/sbin:/usr/bin:/bin:/usr/sbin:/sbin:\$PATH"
export LANG=en_US.UTF-8
rm -rf "$EXPORT_DIR"
echo "== export/upload started \$(date) =="
echo "archive=$ARCHIVE_PATH"
/usr/libexec/PlistBuddy -c 'Print :ApplicationProperties:CFBundleShortVersionString' "$ARCHIVE_PATH/Info.plist" || true
/usr/libexec/PlistBuddy -c 'Print :ApplicationProperties:CFBundleVersion' "$ARCHIVE_PATH/Info.plist" || true
xcodebuild \\
  -exportArchive \\
  -archivePath "$ARCHIVE_PATH" \\
  -exportPath "$EXPORT_DIR" \\
  -exportOptionsPlist "$EXPORT_OPTS" \\
  -allowProvisioningUpdates \\
  -authenticationKeyPath "$ASC_KEY_PATH" \\
  -authenticationKeyID "$ASC_KEY_ID" \\
  -authenticationKeyIssuerID "$ASC_KEY_ISSUER"
echo "== export/upload finished \$(date) =="
SH
chmod +x "$EXPORT_JOB"

cat > "$LAUNCH_AGENT" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>$LAUNCH_LABEL</string>
  <key>ProgramArguments</key>
  <array>
    <string>$EXPORT_JOB</string>
  </array>
  <key>StandardOutPath</key><string>$EXPORT_STDOUT</string>
  <key>StandardErrorPath</key><string>$EXPORT_STDERR</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>HOME</key><string>$HOME</string>
    <key>LANG</key><string>en_US.UTF-8</string>
    <key>PATH</key><string>/opt/homebrew/bin:/opt/homebrew/sbin:/usr/bin:/bin:/usr/sbin:/sbin</string>
  </dict>
</dict>
</plist>
PLIST

launchctl bootout "gui/$UID_NUM" "$LAUNCH_AGENT" >/dev/null 2>&1 || true
rm -f "$EXPORT_STDOUT" "$EXPORT_STDERR"
launchctl bootstrap "gui/$UID_NUM" "$LAUNCH_AGENT"
launchctl kickstart -kp "gui/$UID_NUM/$LAUNCH_LABEL" || true

SECONDS_WAITED=0
JOB_STARTED=0
while true; do
  if grep -q '\*\* EXPORT SUCCEEDED \*\*' "$EXPORT_STDOUT" 2>/dev/null; then
    break
  fi

  JOB_STATE=$(launchctl print "gui/$UID_NUM/$LAUNCH_LABEL" 2>/dev/null || true)
  if printf '%s\n' "$JOB_STATE" | grep -q 'state = running'; then
    JOB_STARTED=1
  elif [ "$JOB_STARTED" -eq 1 ]; then
    break
  elif [ "$SECONDS_WAITED" -ge 60 ]; then
    # Give launchd enough time to transition from bootstrap -> running.
    # Without this grace period, a fast check can unload the job before it
    # ever starts, leaving empty stdout/stderr and a false upload failure.
    break
  fi

  if [ "$SECONDS_WAITED" -ge 3600 ]; then
    echo "ERROR: export/upload timed out after 3600s"
    break
  fi

  sleep 10
  SECONDS_WAITED=$((SECONDS_WAITED + 10))
done

echo "    export stdout tail:"
tail -80 "$EXPORT_STDOUT" 2>/dev/null || true
echo "    export stderr tail:"
tail -120 "$EXPORT_STDERR" 2>/dev/null || true
echo "    launchctl state:"
printf '%s\n' "${JOB_STATE:-}" | tail -80 || true

launchctl bootout "gui/$UID_NUM" "$LAUNCH_AGENT" >/dev/null 2>&1 || true

if ! grep -q '\*\* EXPORT SUCCEEDED \*\*' "$EXPORT_STDOUT" 2>/dev/null; then
  echo "ERROR: export/upload did not report success"
  exit 1
fi

# `xcodebuild -exportArchive` with `destination: upload` already pushes
# the build to App Store Connect and runs altool internally. Done.
echo
echo "✅ Build uploaded to App Store Connect."
echo "Next: open https://appstoreconnect.apple.com → My Apps → LuminaDeck → TestFlight"
echo "      (build appears after 5–15 min processing) → submit for review."
