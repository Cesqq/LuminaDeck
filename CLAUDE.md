## LuminaDeck Project

iPhone macro deck + Windows companion app. iOS + Windows + Android.

## Architecture

- **Monorepo**: pnpm + Turborepo
- **Mobile** (`apps/mobile`): Expo SDK 54, React Native, TypeScript
- **Companion** (`apps/companion`): Tauri v2, Rust backend, HTML frontend
- **Shared** (`packages/shared`): Types, protocol, validation, key allowlist

## Build Pipeline

### PC (Windows) — Companion + Android
```bash
# Companion (Rust/Tauri)
cd apps/companion/src-tauri && cargo build --release
cd apps/companion && npx tauri build  # Creates NSIS + MSI installers

# Android — Android Studio is the only path
cd apps/mobile && npx expo prebuild --platform android
# Then open android/ in Android Studio:
#   Build → Generate Signed Bundle / APK → Android App Bundle → release

# Tests
pnpm test  # or: npx turbo run test typecheck
```

### Mac (macOS) — iOS Builds
The Mac at `rsaczr@10.0.0.50` is the iOS build machine. SSH is configured.
**Pipeline is Xcode-only — no `eas-cli` for build, submit, or credentials.**

From the PC, two scripts drive the whole flow:
```bash
# 1. Sync source + ASC API key to Mac
bash scripts/sync-to-mac.sh

# 2. Trigger archive + upload to App Store Connect via SSH
ssh rsaczr@10.0.0.50 'bash ~/LuminaDeck/scripts/ios-archive-and-upload.sh'
```

The archive script runs `pnpm install`, `expo prebuild --platform ios --clean`,
`pod install`, then `xcodebuild archive` and `xcodebuild -exportArchive` with
`destination=upload` so the IPA goes straight to App Store Connect via the ASC
API key at `~/.keys/AuthKey_5G4BLJ82KH.p8`. From there, finish in App Store
Connect → TestFlight or submit for review.

**One-time human prereqs on the Mac:**
1. Xcode → Settings → Accounts → Apple ID signed in
2. Manage Certificates → "+" → **Apple Distribution** (for App Store builds)
3. App Store provisioning profile auto-downloads after the cert exists

**If the keychain locks during archive:**
```bash
security unlock-keychain ~/Library/Keychains/login.keychain-db
security set-keychain-settings -t 7200 ~/Library/Keychains/login.keychain-db
```

### Credentials & Secrets
- **Apple Team**: 7A2K2PDKW4 (Ceasar Esquivel, Individual)
- **ASC App ID**: 6762442797
- **ASC API Key**: .keys/AuthKey_5G4BLJ82KH.p8 (NEVER commit)
- **ASC API Key ID**: 5G4BLJ82KH
- **ASC Issuer ID**: b9dc67a7-763a-4031-aa71-ada7964eddd5
- **Partner Center Publisher**: CN=24DA9F28-A632-4B32-AB31-FAD4EC93A0A2
- **Partner Center Name**: CZRE.LuminaDeck
- **Bundle ID**: com.luminadeck.app

### Distribution
- **iOS**: App Store via Xcode archive → App Store Connect → TestFlight → App Store
- **Windows**: Microsoft Store (MSIX, $19 Partner Center) — primary
- **Android**: Google Play ($25 one-time) via Android Studio signed bundle
- No EV code-signing cert needed — Store handles signing

## Testing
```bash
npx turbo run test typecheck  # 80+ unit tests, all TS checks
cd apps/companion/src-tauri && cargo check  # Rust
node scripts/test-protocol.js  # E2E WebSocket protocol (needs companion running)
```

## graphify

This project has a graphify knowledge graph at graphify-out/.

Rules:
- Before answering architecture or codebase questions, read graphify-out/GRAPH_REPORT.md for god nodes and community structure
- If graphify-out/wiki/index.md exists, navigate it instead of reading raw files
- After modifying code files in this session, run `python3 -c "from graphify.watch import _rebuild_code; from pathlib import Path; _rebuild_code(Path('.'))"` to keep the graph current
