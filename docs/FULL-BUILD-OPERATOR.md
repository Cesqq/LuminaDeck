# LuminaDeck - Full Build Operator Plan

**Generated**: 2026-04-15
**Status**: RESEARCH COMPLETE — All 5 agents returned. Decisions locked. Executing.

---

## SYSTEM ROLE

Principal engineer, product architect, and autonomous operator.
Plan, build, validate, and ship a working system.

Execution rules:
- Do NOT ask for permission to continue
- Do NOT stop at planning
- Make reasonable assumptions, proceed, log them
- Speed and iteration > perfection

---

## OBJECTIVE

Take LuminaDeck from ratified plan (0% built) to a fully working, near-shippable product.

Responsible for: concept → architecture → build → testing → polish → deploy-ready

---

## IDEA INPUT

**Project Name**: LuminaDeck

**Project Type**: Mobile App (iOS) + Desktop Companion (Windows) — Macro Deck

**Core Idea**: Turn an iPhone into a customizable macro deck for PC control. Users create button grids that execute keyboard shortcuts, launch applications, trigger system actions (volume, media, screenshots), and run multi-action sequences on their Windows PC — all over secure local WiFi. Freemium model: 8 free buttons, $9.99 one-time Pro for unlimited pages, 5 themes, custom images.

**Inspirations / References**:
- Touch Portal ($13.99 one-time, iOS+Windows, 8 free buttons)
- Elgato Stream Deck Mobile ($4.99/mo subscription, iOS+Windows)
- Macro Deck (free/open-source, Android only)
- Elgato Stream Deck hardware ($150+ physical device we're replacing with software)

**Target Platform**: iOS (iPhone 12+, iOS 16+) + Windows (10 21H2+, 11)

**Constraints**:
- 18-week timeline to App Store launch + 4 weeks post-launch
- App Store compliance mandatory (guideline 4.2.7, demo mode, Apple IAP)
- Security-first: TLS 1.3, cert pinning, key allowlisting, no cloud relay
- No third-party trademarks in bundled icons
- EV code-signing cert needed for Windows (SmartScreen)
- Must work on corporate WiFi where mDNS may be blocked (manual IP fallback)

---

## 1. NORTH STAR (IDEAL VERSION)

The ultimate LuminaDeck is the definitive software replacement for the $150 Elgato Stream Deck hardware:

**Core Experience**: Seamless, zero-config connection. Pick up your phone, it auto-connects to your PC. Tap buttons with satisfying haptic feedback. Sub-50ms latency feels instant.

**Key Features**:
- Unlimited customizable button grids with drag-and-drop editor
- Multi-action sequences with delays, conditions, and loops
- Plugin system for OBS, Spotify, Philips Hue, Home Assistant
- Community marketplace for shared profiles and icon packs
- Cross-platform: iOS, Android, macOS, Windows, Linux
- Folder organization, nested pages, dynamic buttons (show CPU temp, time, etc.)
- GIF/animated button icons
- Companion widget on iOS Lock Screen and Home Screen
- Voice commands as triggers
- iPad support with larger grids

**Addictive Hook**: The "customize and share" loop — users spend hours perfecting their layouts, then share them. Each new integration (OBS, Spotify, etc.) creates a new reason to open the app.

**Monetization**:
- $9.99 Pro (one-time, lifetime)
- $2.99/yr Icon Pack subscription (optional, community marketplace cut)
- Enterprise license for studios/offices

---

## 2. DELIBERATE SUBSET (SHIP FAST)

The smallest version that proves the concept and feels real:

### INCLUDED (MVP / v1.0)
- iPhone button grid (2x4, 3x4, 4x5 layouts)
- Windows companion (tray app + config UI)
- TLS 1.3 WebSocket connection over local WiFi
- QR code pairing + manual IP entry
- 4 action types: keybind, app launch, system action, multi-action
- Button editor (icon, label, color, action)
- 5 themes with ~80 original icons each
- Haptic feedback (configurable intensity)
- Multi-page support with swipe navigation
- Demo mode (works without companion)
- First-run onboarding (3 steps)
- Pro upgrade via Apple IAP ($9.99)
- Free tier: 8 buttons, 1 theme, 1 PC
- Profile import/export (Pro)

### EXCLUDED (v1.1+)
- Android app
- macOS/Linux companion
- Plugin/integration system (OBS, Spotify, etc.)
- Community marketplace
- GIF/animated buttons
- iOS widgets
- Dynamic buttons (live data)
- Voice triggers
- iPad layouts
- Folders/grouping

---

## 3. EXECUTION ARCHITECTURE

### Tech Stack

**Frontend (iOS)**:
- React Native + Expo (EAS Build)
- TypeScript
- expo-haptics, expo-camera (QR), expo-secure-store
- react-native-iap for Apple IAP
- react-native-zeroconf for mDNS discovery

**Backend (Windows Companion)**:
- **Tauri v2** (Rust backend, WebView2 frontend) — 3-10MB installer
- `windows` crate (microsoft/windows-rs) for Win32 SendInput — direct FFI
- `tokio-tungstenite` + `rustls` for TLS 1.3 WebSocket server
- `tauri-plugin-tray-icon` for system tray
- `mdns-sd` crate for Bonjour/mDNS broadcast
- `windows-dpapi` crate for credential storage
- `tauri-plugin-updater` for signed auto-updates

**Backend (Cloud — minimal)**:
- Supabase (auth, license validation, feature flags)
- Apple receipt validation via Supabase Edge Functions

**Hosting**:
- iOS: App Store
- Windows: Direct download + optional Microsoft Store
- Landing page: Lovable / Vercel
- Privacy policy + ToS: Static hosting

### System Design

```
┌─────────────────────┐         TLS 1.3 WebSocket        ┌──────────────────────┐
│    iPhone App        │ ◄──────────────────────────────► │  Windows Companion    │
│                      │         Local WiFi Only           │                      │
│  ┌────────────────┐  │                                   │  ┌────────────────┐  │
│  │ Button Grid UI │  │    {"type":"keybind",             │  │ Action Engine   │  │
│  │ Theme Engine   │  │     "keys":["ctrl","c"]}          │  │ (Win32 SendInput)│ │
│  │ Haptic Engine  │  │                                   │  │ App Launcher    │  │
│  │ Image Manager  │  │                                   │  │ System Actions  │  │
│  │ Page System    │  │                                   │  │ Multi-Action    │  │
│  └────────────────┘  │                                   │  └────────────────┘  │
│                      │                                   │                      │
│  ┌────────────────┐  │         QR Code Pairing           │  ┌────────────────┐  │
│  │ Connection Mgr │  │ ◄──────────────────────────────► │  │ Pairing Server │  │
│  │ QR Scanner     │  │         (cert fingerprint)        │  │ mDNS Broadcast │  │
│  │ Manual IP      │  │                                   │  │ Device Manager │  │
│  │ Demo Mode      │  │                                   │  │ Tray Icon      │  │
│  └────────────────┘  │                                   │  └────────────────┘  │
│                      │                                   │                      │
│  ┌────────────────┐  │                                   │  ┌────────────────┐  │
│  │ AsyncStorage   │  │                                   │  │ DPAPI Storage  │  │
│  │ Keychain       │  │                                   │  │ Config (JSON)  │  │
│  │ IAP Manager    │  │                                   │  │ Auto-Updater   │  │
│  └────────────────┘  │                                   │  └────────────────┘  │
└─────────────────────┘                                   └──────────────────────┘
         │                                                          │
         ▼                                                          │
┌─────────────────────┐                                             │
│  Supabase (optional) │                                            │
│  - Auth              │                                            │
│  - Receipt validation│                                            │
│  - Feature flags     │                                            │
└─────────────────────┘                                             │
```

### File / Folder Structure

```
luminadeck/
├── apps/
│   ├── mobile/                    # React Native / Expo iOS app
│   │   ├── app/                   # App screens (Expo Router)
│   │   │   ├── (tabs)/
│   │   │   │   ├── index.tsx      # Button grid (home)
│   │   │   │   ├── settings.tsx   # Settings screen
│   │   │   │   └── connect.tsx    # Connection management
│   │   │   ├── editor/
│   │   │   │   └── [buttonId].tsx # Button editor
│   │   │   ├── onboarding/
│   │   │   │   └── index.tsx      # First-run flow
│   │   │   └── _layout.tsx
│   │   ├── components/
│   │   │   ├── ButtonGrid.tsx
│   │   │   ├── ButtonCell.tsx
│   │   │   ├── ThemeProvider.tsx
│   │   │   ├── ConnectionStatus.tsx
│   │   │   ├── QRScanner.tsx
│   │   │   └── HapticButton.tsx
│   │   ├── lib/
│   │   │   ├── websocket.ts       # WS client + reconnect logic
│   │   │   ├── actions.ts         # Action type definitions
│   │   │   ├── storage.ts         # AsyncStorage helpers
│   │   │   ├── keychain.ts        # Secure storage
│   │   │   ├── themes.ts          # Theme definitions
│   │   │   ├── icons.ts           # Icon pack registry
│   │   │   ├── iap.ts             # In-App Purchase
│   │   │   └── discovery.ts       # mDNS + manual IP
│   │   ├── assets/
│   │   │   ├── icons/
│   │   │   │   ├── obsidian/      # Theme 1 icons
│   │   │   │   ├── aurora/        # Theme 2 icons
│   │   │   │   ├── daylight/      # Theme 3 icons
│   │   │   │   ├── retro-neon/    # Theme 4 icons
│   │   │   │   └── slate/         # Theme 5 icons
│   │   │   └── splash/
│   │   ├── app.json
│   │   ├── eas.json
│   │   └── package.json
│   │
│   └── companion/                 # Windows companion (Tauri or Electron)
│       ├── src/
│       │   ├── main/
│       │   │   ├── server.ts      # WebSocket server + TLS
│       │   │   ├── actions/
│       │   │   │   ├── keybind.ts     # Win32 SendInput executor
│       │   │   │   ├── app-launch.ts  # Application launcher
│       │   │   │   ├── system.ts      # System actions (volume, etc.)
│       │   │   │   └── multi.ts       # Multi-action sequencer
│       │   │   ├── security/
│       │   │   │   ├── allowlist.ts   # Key-name allowlist (~120 keys)
│       │   │   │   ├── tls.ts         # TLS cert generation
│       │   │   │   ├── pairing.ts     # QR + cert fingerprint
│       │   │   │   └── dpapi.ts       # Windows DPAPI storage
│       │   │   ├── discovery.ts   # mDNS broadcast
│       │   │   ├── tray.ts        # System tray icon
│       │   │   └── updater.ts     # Auto-update + signing
│       │   └── renderer/
│       │       ├── App.tsx        # Config UI
│       │       ├── DeviceList.tsx # Paired devices
│       │       └── Settings.tsx   # Companion settings
│       ├── native/
│       │   └── sendinput/         # N-API addon or Rust FFI
│       └── package.json
│
├── packages/
│   └── shared/                    # Shared types + protocol
│       ├── types.ts               # Action types, message schemas
│       ├── protocol.ts            # WebSocket message protocol
│       ├── keys.ts                # Key-name allowlist definition
│       └── validation.ts          # Payload validators (Zod)
│
├── supabase/
│   ├── functions/
│   │   └── validate-receipt/      # Apple receipt validation
│   └── migrations/
│
├── docs/
│   ├── LUMINADECK-LAUNCH-PLAN.md
│   ├── SETUP-CHECKLIST.md
│   └── FULL-BUILD-OPERATOR.md
│
├── turbo.json                     # Turborepo config
├── package.json                   # Root workspace
├── tsconfig.base.json
└── .gitignore
```

---

## 4. BUILD PLAN (STEP-BY-STEP)

### Phase 0: Pre-Development (This session)

```
Step 1:  Initialize monorepo (pnpm workspaces + Turborepo)
Step 2:  Scaffold Expo app (apps/mobile)
Step 3:  Scaffold companion app — Tauri or Electron based on research
Step 4:  Create shared types package (packages/shared)
Step 5:  Win32 SendInput proof-of-concept (native addon)
Step 6:  TLS 1.3 self-signed cert generation utility
Step 7:  Basic WebSocket server in companion (echo test)
Step 8:  Basic WebSocket client in mobile (connect + send test)
Step 9:  Verify end-to-end: phone tap → companion receives → logs action
```

### Phase 1: Foundation (Weeks 1-3)

```
Step 10: Build key-name allowlist (~120 keys) with VK code mapping
Step 11: Implement SendInput keybind executor with modifier support
Step 12: Build action payload validation (Zod schemas)
Step 13: Implement TLS 1.3 on WebSocket server
Step 14: QR code generation on companion (IP + port + cert fingerprint)
Step 15: QR scanner on mobile (expo-camera)
Step 16: Pairing handshake protocol (exchange + store creds)
Step 17: Manual IP entry as first-class connection path
Step 18: mDNS discovery (pairing mode only, stops when paired)
Step 19: Build 2x4 button grid component
Step 20: Haptic feedback engine (light/medium/heavy/off)
Step 21: AsyncStorage schema for layouts
Step 22: Keychain storage for connection secrets
Step 23: Connection status indicator (green/yellow/red)
Step 24: Reconnection logic (exponential backoff: 500ms→30s cap)
Step 25: 2-second heartbeat with 3-miss disconnect
```

### Phase 2: Core Features (Weeks 4-6)

```
Step 26: Action type system (keybind, app_launch, system, multi_action)
Step 27: App launch executor (validated paths, no shell)
Step 28: System action executor (volume, media, screenshot, lock, etc.)
Step 29: Multi-action sequencer (ordered list with delays)
Step 30: Button editor UI (action picker, image, label, color)
Step 31: Image picker integration (camera roll)
Step 32: Grid layout options (2x4, 3x4, 4x5)
Step 33: Page system with swipe navigation
Step 34: Settings screen (haptic, sound, grid, theme, connection)
Step 35: Connection management UI (QR + manual IP + device list)
Step 36: Device revocation from companion UI
Step 37: Demo mode (offline simulation, visual feedback only)
Step 38: First-run onboarding (3-step + starter page with 4 demo buttons)
Step 39: Rate limiting (50 actions/sec max)
```

### Phase 3-8: See launch plan for full breakdown

---

## 5. RESEARCH SYNTHESIS (2026-04-15)

All 5 research agents returned. Decisions locked:

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Desktop framework | **Tauri v2** | 3-10MB vs 80-120MB Electron, direct Rust FFI for SendInput |
| SendInput method | **`windows` crate direct** | Zero-cost FFI, type-safe, sub-microsecond per call |
| Mobile framework | **Expo SDK 53** (managed) | All features supported, no bare workflow eject needed |
| QR scanning | **react-native-vision-camera v4** | GPU frame processing, 60fps, better than expo-camera |
| IAP | **RevenueCat (react-native-purchases)** | Handles StoreKit 2 + receipt validation, free under $2.5K MTR |
| Theming | **react-native-unistyles v3** | Dynamic theming, performant, Expo compatible |
| Secure storage | **expo-secure-store** | First-party Expo, iOS Keychain wrapper |
| mDNS | **react-native-zeroconf** (mobile) + **mdns-sd** (companion) | Reliable on iOS, pure-Rust on Windows |
| Pricing | **$9.99 one-time** validated | Undercuts Touch Portal ($13.99), destroys Stream Deck sub ($2.99/mo) |

### Critical: iOS 26 SDK Deadline (April 28, 2026)
- Must build with Xcode 26 from day one
- Liquid Glass visual treatment auto-applies — must test all 5 themes
- Privacy Manifest (PrivacyInfo.xcprivacy) required
- Updated age rating questionnaire (July 2025 overhaul)

### Competitor Gaps Identified
- No iOS-first macro deck exists — LuminaDeck owns this lane
- Touch Portal: dated UI, complex setup (4.5 stars, $13.99)
- Stream Deck Mobile: subscription hated, connectivity issues ($2.99/mo)
- Macro Deck: tiny iOS community, Windows-only server

---

## 6. AUTONOMOUS EXECUTION LOG

Execution started: 2026-04-15

---

## ASSUMPTIONS LOG

1. pnpm + Turborepo for monorepo (standard for TS monorepos in 2026)
2. Expo Router for mobile navigation (current Expo standard)
3. Zod for payload validation (lightweight, TS-native)
4. Self-signed TLS certs generated at companion install time
5. TOTP session tokens via otplib or similar
6. **DECIDED: Tauri v2** (not Electron) per research
7. **DECIDED: Expo managed workflow** (not bare, not SwiftUI)
8. **DECIDED: RevenueCat** for IAP (not react-native-iap DIY)
9. Anti-cheat may block SendInput for some games — documented as known limitation
10. iOS 26 SDK / Xcode 26 required from start (April 28 deadline)

---

*Research complete. All decisions locked. Execution begins now.*
