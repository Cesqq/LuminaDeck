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

# Android
cd apps/mobile && npx expo prebuild --platform android
# Then open android/ in Android Studio, or:
cd apps/mobile && eas build --platform android --profile preview --non-interactive

# Tests
pnpm test  # or: npx turbo run test typecheck
```

### Mac (macOS) — iOS Builds
The Mac at `rsaczr@10.0.0.50` is the iOS build machine. SSH is configured.

```bash
# From PC, sync code to Mac:
cd /path/to/LuminaDeck
tar czf /tmp/ld-sync.tar.gz --exclude='node_modules' --exclude='target' --exclude='.git' --exclude='.keys' --exclude='*.msix' --exclude='*.exe' --exclude='*.msi' apps/mobile packages/shared package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.base.json turbo.json
scp /tmp/ld-sync.tar.gz rsaczr@10.0.0.50:/tmp/
ssh rsaczr@10.0.0.50 'cd ~/LuminaDeck && tar xzf /tmp/ld-sync.tar.gz'

# On Mac, build iOS:
export PATH=$HOME/.local/bin:$PATH
eval "$(/opt/homebrew/bin/brew shellenv)"
export LANG=en_US.UTF-8
export EXPO_TOKEN=p3A3wnMLFfMrZVMpAWDhf3kwLtFdbWH1S0fn5owr
cd ~/LuminaDeck/apps/mobile
pnpm install
npx expo prebuild --platform ios --clean
cd ios && pod install && cd ..
npx eas-cli build --platform ios --profile preview --local --non-interactive --output ~/LuminaDeck-build.ipa

# Submit to TestFlight (from PC or Mac):
npx eas-cli submit --platform ios --path ~/LuminaDeck-build.ipa --non-interactive
```

**IMPORTANT**: Before local iOS build, unlock the keychain on Mac:
```bash
security unlock-keychain ~/Library/Keychains/login.keychain-db
security set-keychain-settings -t 7200 ~/Library/Keychains/login.keychain-db
```

### Credentials & Secrets
- **EAS Project**: @iczr/luminadeck (5487c725-c788-4978-a67e-1da84e7c172e)
- **Apple Team**: 7A2K2PDKW4 (Ceasar Esquivel, Individual)
- **ASC App ID**: 6762442797
- **ASC API Key**: .keys/AuthKey_5G4BLJ82KH.p8 (NEVER commit)
- **ASC API Key ID**: 5G4BLJ82KH
- **ASC Issuer ID**: b9dc67a7-763a-4031-aa71-ada7964eddd5
- **EXPO_TOKEN**: stored in Mac env (never commit)
- **Partner Center Publisher**: CN=24DA9F28-A632-4B32-AB31-FAD4EC93A0A2
- **Partner Center Name**: CZRE.LuminaDeck
- **Bundle ID**: com.luminadeck.app

### Distribution
- **iOS**: App Store via EAS Build → TestFlight → App Store
- **Windows**: Microsoft Store (MSIX, $19 Partner Center) — primary
- **Android**: Google Play ($25 one-time)
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
