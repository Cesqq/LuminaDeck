# LuminaDeck - Setup Checklist

## Developer Environment

- [x] Node.js 20+ installed
- [x] pnpm 9+ installed
- [x] Rust toolchain installed (rustup)
- [x] `pnpm install` — all JS deps resolved
- [x] `cargo check` — companion Rust compiles clean
- [x] `tsc --noEmit` — shared + mobile TypeScript clean

## Apple Developer Account

- [ ] Apple Developer Program enrollment ($99/yr)
- [ ] Create App ID: `com.luminadeck.app`
- [ ] Create App Store Connect entry
- [ ] Configure In-App Purchase product (non-consumable, $9.99)
- [ ] Generate provisioning profiles for development + distribution

## EAS Build Setup

- [ ] Install EAS CLI: `npm install -g eas-cli`
- [ ] Run `eas login` with Expo account
- [ ] Run `eas build:configure` in `apps/mobile/`
- [ ] Replace `PLACEHOLDER` in `eas.json` with real Apple IDs
- [ ] Replace `PLACEHOLDER` in `app.json` `extra.eas.projectId`
- [ ] Test development build: `eas build --platform ios --profile development`

## RevenueCat IAP

- [ ] Create RevenueCat account (https://www.revenuecat.com/)
- [ ] Create project "LuminaDeck"
- [ ] Add iOS app with bundle ID `com.luminadeck.app`
- [ ] Add App Store Connect API key to RevenueCat
- [ ] Create product "luminadeck_pro" (non-consumable, $9.99)
- [ ] Create entitlement "pro" linked to the product
- [ ] Create offering "default" with the pro package
- [ ] Copy iOS API key to `.env` as `EXPO_PUBLIC_REVENUECAT_IOS_KEY`

## Supabase (Optional — app works without it)

- [ ] Create Supabase project
- [ ] Run `supabase/migrations/001_luminadeck_schema.sql`
- [ ] Deploy edge function: `supabase functions deploy luminadeck-validate-receipt`
- [ ] Copy URL + anon key to `.env`

## Windows Companion

- [ ] Register Microsoft Partner Center account ($19 one-time) at https://partner.microsoft.com
- [ ] Reserve app name "LuminaDeck Companion" in Partner Center
- [x] Run `cargo build --release` — verified, 15MB binary
- [ ] Run `pnpm tauri:build` for NSIS installer
- [ ] Convert installer to MSIX using MSIX Packaging Tool
- [ ] Submit to Microsoft Store (see docs/MICROSOFT-STORE-GUIDE.md)
- [ ] Verify server starts on port 9876 (TLS)
- [ ] Verify system tray icon + context menu
- [ ] Test QR code display in Pair tab
- [ ] (Optional) Standard OV code-signing cert (~$65/yr from Certum) for direct download

## Environment Variables

Create `.env` in repo root (gitignored):
```
EXPO_PUBLIC_REVENUECAT_IOS_KEY=
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_ANON_KEY=
```

## Build Status

### Phase 0 (Complete)
- [x] Monorepo scaffolded (pnpm + Turborepo)
- [x] Shared types package (protocol, keys, validation)
- [x] Companion Rust backend (TLS WS, SendInput, mDNS, pairing)
- [x] Mobile screens (Home, Connect, Settings, Editor)
- [x] Supabase migration + edge function

### Phase 1+2 (Complete)
- [x] Companion Tauri commands (QR, pairing, device CRUD)
- [x] Rate limiter (50 actions/sec per peer)
- [x] Companion frontend (Status/Pair/Devices/Settings tabs, QR display)
- [x] System tray icon
- [x] First-run onboarding (3-step walkthrough)
- [x] QR scanner modal (expo-camera)
- [x] Multi-action builder in editor
- [x] Image picker (expo-image-picker, Pro-gated)
- [x] Profile import/export (expo-file-system + sharing)

### Phase 3+4 (In Progress)
- [x] RevenueCat IAP integration
- [x] Restore purchase flow
- [x] EAS Build config (eas.json)
- [x] iOS Privacy Manifest
- [ ] Icon pack SVGs (80 icons, 5 theme variants)
- [ ] VoiceOver accessibility audit
- [ ] App icon + splash screen design
- [ ] TestFlight beta

### Phase 5+ (Not Started)
- [ ] Security hardening audit
- [ ] Unit + integration tests
- [ ] Device testing matrix
- [ ] App Store submission
