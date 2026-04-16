# LuminaDeck - Final Launch Plan (Point A to Point B)

**Product**: LuminaDeck - A customizable macro deck app that turns your iPhone into a PC control surface
**Platforms**: iOS (iPhone) + Windows Desktop Companion
**Goal**: App Store launch with 5 polished themes, secure architecture, and a competitive edge
**Status**: RATIFIED - Unanimous 5/5 hard YES on Round 2 review (2026-04-09)

---

## REVIEW PANEL RESULTS

| Reviewer | Perspective | Vote | Amendments Incorporated |
|----------|-----------|------|------------------------|
| Agent 1 | Security Architect | YES | 4 of 4 |
| Agent 2 | UX/Design Lead | YES | 4 of 4 |
| Agent 3 | Business/App Store Expert | YES | 4 of 4 |
| Agent 4 | Senior Engineer | YES | 3 of 3 |
| Agent 5 | QA/Launch Manager | YES | 6 of 6 |

> All amendments have been incorporated into this finalized plan. Items marked with [AMENDED] indicate changes from the original draft based on panel feedback.

---

## 1. PRODUCT DEFINITION

### 1.1 What LuminaDeck Is
A mobile app (iPhone) paired with a lightweight Windows desktop companion that lets users create customizable button grids to:
- Execute keyboard shortcuts/keybinds on their PC
- Launch applications
- Trigger system actions (volume, media, screenshots, etc.)
- Run custom macros and multi-action sequences

### 1.2 What LuminaDeck Is NOT
- Not a remote desktop / screen mirroring app (avoids App Store guideline 4.2.7 issues)
- Not a game streaming client
- No GIFs or animated content on buttons (static images only at launch; GIF support planned for v1.1 post-launch) [AMENDED - UX Agent]
- No cloud dependency for core functionality (direct local network communication)

### 1.3 Competitive Positioning
| Feature | LuminaDeck | Touch Portal | Stream Deck Mobile | Macro Deck |
|---------|-----------|--------------|-------------------|------------|
| iOS Support | Yes | Yes | Yes | No (Android only) |
| Windows Support | Yes | Yes | Yes | Yes |
| Free Tier | Yes (8 buttons) | Yes (8 buttons) | No (subscription) | Yes |
| Custom Images | Yes (static) | Yes (static + GIF pro) | Yes | Yes |
| Themes/Icon Packs | 5 built-in | None | Limited | None |
| Pricing Model | Freemium + one-time Pro | $13.99 one-time | $4.99/mo subscription | Free/open-source |
| Setup Complexity | Simple QR pair + manual IP | Moderate | Easy | Moderate |

### 1.4 Differentiators
1. **5 polished default themes with curated icon packs** - ready to use out of the box
2. **One-time Pro purchase** (not subscription) - undercuts Touch Portal
3. **Modern UI/UX with haptic feedback** - designed for iPhone-first experience [AMENDED - UX Agent]
4. **QR code pairing + manual IP** - zero-config with reliable fallback [AMENDED - Eng Agent]
5. **Security-first** - TLS 1.3, certificate pinning, key allowlisting, no cloud relay

---

## 2. ARCHITECTURE

### 2.1 System Overview
```
[iPhone App] <--- TLS 1.3 / Local WiFi ---> [Windows Companion]
     |                                              |
     v                                              v
  Button Grid UI                          Action Executor (Win32 SendInput)
  Theme Engine                            Tray Icon + Config UI
  Image Manager                           mDNS Discovery (pairing-mode only)
  Haptic Engine                           Device Revocation Manager
  Connection Manager                      Manual IP Listener
  Demo Mode (offline)
```

### 2.2 Tech Stack

#### iOS App (iPhone)
- **Framework**: React Native (supports iOS + future Android with shared codebase)
- **Language**: TypeScript
- **Minimum Deployment Target**: iOS 16 (supports iPhone 12+) [AMENDED - QA Agent]
- **Networking**: TLS 1.3 WebSocket over local WiFi
- **Storage**: AsyncStorage for layouts, Keychain for connection secrets
- **Image Handling**: React Native Image Picker + bundled icon packs
- **Haptics**: UIImpactFeedbackGenerator (light/medium/heavy patterns) [AMENDED - UX Agent]
- **Build**: Xcode + EAS Build (Expo Application Services)

#### Windows Companion
- **Framework**: Evaluate Tauri (Rust, ~5MB) vs Electron in Week 1 spike (2-day decision) [AMENDED - Eng Agent]
- **Language**: TypeScript (Electron/Tauri) or Rust (Tauri native)
- **Keybind Execution**: Win32 `SendInput` API via native addon (N-API or ffi-napi) -- NOT SendKeys or node-global-key [AMENDED - Eng Agent]
- **Discovery**: mDNS/Bonjour broadcast only during active pairing mode [AMENDED - Security Agent]
- **Manual IP**: First-class supported connection method with prominent UI [AMENDED - Eng Agent]
- **Minimum OS**: Windows 10 21H2+ and Windows 11 (all builds) [AMENDED - QA Agent]
- **ARM64**: Not required for v1, documented as known limitation
- **Distribution**: Direct download (.exe installer) + Microsoft Store (optional)
- **Security**: `contextIsolation: true`, `nodeIntegration: false`, locked-down CSP (if Electron) [AMENDED - Security Agent]
- **Auto-Update**: Signed update channel with certificate verification [AMENDED - Security Agent]

#### Backend (Minimal - Supabase)
- **Purpose**: User accounts, Pro license validation, theme marketplace (future)
- **Provider**: Supabase (auth, database, edge functions)
- **Stripe**: Payment processing for Pro upgrade (future Windows-side)
- **Local Receipt Cache**: Pro entitlement cached locally after validation; works offline with 7-day grace period [AMENDED - Business Agent]
- **Note**: Core app functionality works WITHOUT any backend - purely local

### 2.3 Communication Protocol
1. **Discovery**: mDNS broadcast ONLY during active pairing mode (stopped once all slots filled) [AMENDED - Security Agent]
2. **Manual IP**: Direct IP:port entry as first-class connection method [AMENDED - Eng Agent]
3. **Pairing**: QR code displayed on Windows companion, scanned by iPhone
4. **Session**: TLS 1.3 WebSocket connection established
5. **Messages**: JSON action payloads with strict key-name allowlist validation [AMENDED - Security Agent]
   ```json
   { "type": "keybind", "keys": ["ctrl", "shift", "m"] }
   ```
   Valid keys: explicit allowlist of ~120 key names (a-z, 0-9, f1-f24, ctrl, alt, shift, win, tab, enter, escape, arrows, media keys, etc.)
6. **Heartbeat**: 2-second keepalive ping, connection dropped after 3 consecutive misses [AMENDED - Eng Agent]
7. **Reconnect**: Exponential backoff schedule: 500ms, 1s, 2s, 4s, 8s, cap at 30s [AMENDED - Eng Agent]

---

## 3. SECURITY PLAN

### 3.1 Network Security
- **TLS 1.3 mandatory** for all phone-to-PC communication
- **Certificate pinning** - companion generates a self-signed cert, phone pins it during QR pairing
- **Local network only** - no cloud relay, no internet required for core functionality
- **mDNS pairing-mode only** - broadcast stops when not actively pairing, does not leak companion presence continuously [AMENDED - Security Agent]

### 3.2 Authentication & Pairing
- **QR code pairing** embeds: companion IP, port, and certificate fingerprint
- **TOTP-based session tokens** rotated every 30 minutes
- **Device binding** - paired devices stored in Keychain (iOS) and DPAPI (Windows)
- **Max 5 paired devices** per companion instance
- **Device revocation** - force-unpair any device from Windows companion UI [AMENDED - Security Agent]
- **Session revocation** - immediate token invalidation on unpair

### 3.3 Action Payload Security [AMENDED - Security Agent]
- **Strict key-name allowlist** - only pre-defined key names accepted (no arbitrary strings passed to SendInput)
- **Action type validation** - payloads must match defined schemas for keybind, app_launch, system_action, multi_action
- **Path sanitization** - app launch paths validated against directory traversal
- **Rate limiting** - max 50 actions/second to prevent abuse
- **No shell execution** - actions never invoke cmd.exe, powershell, or any shell

### 3.4 Data Security
- **No sensitive data leaves local network** for core functionality
- **Keychain** (iOS) for all secrets - never UserDefaults
- **DPAPI** (Windows) for credential storage
- **No keystroke logging** - commands are action-based, not key-logged
- **Input sanitization** on all action payloads via allowlist enforcement

### 3.5 App Store Privacy
- **Privacy Nutrition Label**: Minimal data collection
  - Account email (if Pro purchase via Supabase auth)
  - No tracking, no analytics SDKs at launch
  - No third-party data sharing
- **App Privacy Report** compliant
- **NSLocalNetworkUsageDescription** properly declared

### 3.6 Code Security
- **Dependency auditing** via `npm audit` + Snyk
- **No eval()** or dynamic code execution
- **Code signing** for both iOS app and Windows installer (EV certificate - procured in Week 1) [AMENDED - Business Agent]
- **Obfuscation** for production builds (Hermes bytecode on iOS)
- **Electron hardening** (if Electron chosen): contextIsolation: true, nodeIntegration: false, strict CSP, locked IPC channels [AMENDED - Security Agent]
- **Signed auto-updates** - update packages verified against known certificate before installation [AMENDED - Security Agent]

---

## 4. UI/UX DESIGN

### 4.1 Core Screens

#### First-Run Onboarding [AMENDED - UX Agent]
- 3-step overlay walkthrough on first launch:
  1. "Welcome to LuminaDeck" - what it does (1 screen)
  2. "Connect Your PC" - QR scan or download companion prompt with deep link [AMENDED - QA Agent]
  3. "Try It Out" - pre-populated starter page with 4 demo buttons (Volume Up/Down, Play/Pause, Mute)
- Skip button available on each step
- If no companion detected: "Companion Not Found" screen with download link, setup video, and manual IP entry option [AMENDED - QA Agent]

#### Home Screen (Button Grid)
- Configurable grid: 2x4, 3x4, 4x5 layouts [AMENDED - UX Agent: 2x4 replaces 2x3]
- Each button shows: icon/image + optional label
- Long-press to edit, tap to execute
- **Haptic feedback on every tap**: UIImpactFeedbackGenerator.medium, configurable in settings [AMENDED - UX Agent]
- **Optional press sound**: subtle click, toggleable in settings [AMENDED - UX Agent]
- Swipe left/right for pages
- Top bar: connection status indicator (green/yellow/red), settings gear

#### Button Editor
- Choose action type: Keybind, App Launch, System Action, Multi-Action
- Set image: Choose from icon pack OR pick from photo library
- Set label (optional, max 16 chars with auto-ellipsis) [AMENDED - UX Agent: was 12]
- Set color/background from theme palette

#### Settings
- Connection management (paired PCs, QR scanner, manual IP entry)
- Theme selector (5 themes)
- Grid layout selector
- Haptic feedback intensity (light/medium/heavy/off) [AMENDED - UX Agent]
- Press sound toggle
- Pro upgrade prompt
- About / Support

#### Connection Screen
- QR code scanner for initial pairing
- List of paired PCs with status (online/offline)
- **Manual IP entry as first-class option** (not hidden as fallback) [AMENDED - Eng Agent]
- Companion download link + setup instructions

#### Demo Mode [AMENDED - Business Agent]
- Fully functional offline mode simulating a connected PC
- All buttons show visual feedback but no PC actions execute
- Used for App Store review and first-time exploration
- Banner: "Demo Mode - Connect a PC for full functionality"

### 4.2 Five Default Themes

#### Theme 1: "Obsidian" (Dark Professional)
- Background: #0D0D0D, Buttons: #1A1A2E with #16213E borders
- Accent: #0F3460, Text: #E0E0E0
- Style: Minimal, flat, professional
- **Accessibility**: WCAG AA contrast ratios verified [AMENDED - UX Agent]

#### Theme 2: "Aurora" (Vibrant Dark)
- Background: #0B0B1A, Buttons: gradient #1B1B3A to #2D1B69
- Accent: #7B2FBE to #00D4FF gradient
- Style: Soft glows, rounded corners, modern
- **Accessibility**: WCAG AA contrast ratios verified

#### Theme 3: "Daylight" (Clean Light)
- Background: #F5F5F5, Buttons: #FFFFFF with subtle shadows
- Accent: #2196F3, Text: #333333
- Style: iOS-native feel, clean, accessible
- **Accessibility**: WCAG AA contrast ratios verified

#### Theme 4: "Retro Neon" (Cyberpunk)
- Background: #0A0A0A, Buttons: #1A0A2E with neon borders
- Accent: #FF006E / #00FF88 / #FFD600
- Style: Pixel-influenced, neon outlines, bold
- **Accessibility**: WCAG AA contrast ratios verified

#### Theme 5: "Slate" (Neutral Minimal)
- Background: #1E1E1E, Buttons: #2D2D2D
- Accent: #4CAF50, Text: #B0B0B0
- Style: VS Code-inspired, developer-friendly
- **Accessibility**: WCAG AA contrast ratios verified

### 4.3 Icon Packs (Bundled with Each Theme) [AMENDED - Business Agent]

Each theme includes ~80 **original, generic-style icons**. Icons represent app categories with original artwork -- NO third-party trademarks or logos bundled.

**Web Browsers**: Generic browser icon, search, bookmarks, tabs
**Office/Productivity**: Document, spreadsheet, presentation, email, calendar, notes, cloud storage
**Code/Dev**: Code editor, terminal, git, debug, database, API
**Creative**: Photo editor, video editor, 3D modeling, color picker, canvas
**Communication**: Chat, video call, voice call, screen share, channel
**AI Tools**: AI assistant, prompt, generate, model, neural network
**Media**: Music player, video player, podcast, equalizer, playlist
**Gaming**: Game launcher, controller, stream, record, overlay
**System Actions**: Volume Up/Down/Mute, Play/Pause/Next/Prev, Screenshot, Lock Screen, Sleep, Brightness, WiFi Toggle, Bluetooth Toggle, Mic Mute, Camera Toggle
**Streaming**: Scene switch, go live, stop stream, recording, mute, deafen, push-to-talk
**Productivity**: Copy, paste, cut, undo, redo, save, new tab, close tab, switch window, minimize, snap left/right
**File Management**: Folder, file, archive, download, upload, trash, search

> **Note**: Users can set any image from their photo library as a button icon (Pro feature). This allows them to use actual app logos from their own screenshots if desired, without LuminaDeck bundling trademarked assets.

---

## 5. MONETIZATION

### 5.1 Free Tier [AMENDED - UX Agent]
- 1 page, up to **8 buttons (2x4 grid)** - matches Touch Portal free tier
- 1 theme (Obsidian)
- 1 paired PC
- Basic icon pack (~30 generic icons)
- All action types available

### 5.2 Pro Upgrade (One-Time Purchase: $9.99)
- Unlimited pages
- Up to 30 buttons per page (configurable grid)
- All 5 themes
- Full icon pack (~80 generic icons)
- Up to 5 paired PCs
- Custom image upload for buttons
- Multi-action sequences
- Profile import/export

### 5.3 Payment Infrastructure
- **iOS**: Apple In-App Purchase (required by App Store)
- **License Validation**: Supabase edge function validates Apple receipt
- **Local Receipt Cache**: After successful IAP validation, entitlement cached locally with 7-day offline grace period [AMENDED - Business Agent]
- **Stripe**: For Windows-side Pro features if needed (future)
- **Restore Purchase**: Required by App Store guidelines

---

## 6. DEVELOPMENT PHASES

### Phase 0: Pre-Development (Week 0 - before coding starts) [AMENDED - Business + Eng Agents]
**Goal**: Critical procurement and architectural decisions

| Task | Tool/Owner | Deliverable |
|------|-----------|-------------|
| Procure EV code-signing certificate (Windows) | Manual | Certificate ordered, SmartScreen reputation building starts | [AMENDED - Business Agent]
| Apple Developer account setup ($99/yr) | Manual | Account ready |
| Tauri vs Electron spike (2-day evaluation) | Cursor + Claude | Decision document with benchmarks | [AMENDED - Eng Agent]
| Win32 SendInput proof-of-concept | Cursor + Claude | Working keybind execution via native addon | [AMENDED - Eng Agent]

### Phase 1: Foundation (Weeks 1-3)
**Goal**: Core architecture, connection protocol, basic button grid

| Task | Tool/Owner | Deliverable |
|------|-----------|-------------|
| Project scaffolding (React Native + chosen desktop framework) | Cursor + Claude | Monorepo with shared types |
| WebSocket server in companion with TLS 1.3 | Cursor + Claude | Secure WS server |
| mDNS discovery service (pairing-mode only) | Claude | Scoped discovery module | [AMENDED - Security Agent]
| Manual IP connection as first-class path | Claude + Cursor | Direct IP connection flow | [AMENDED - Eng Agent]
| QR code pairing flow | Claude + Cursor | Pairing handshake protocol |
| Basic button grid (2x4) | Lovable (rapid UI) | Functional grid component | [AMENDED - UX Agent]
| Keybind execution engine (Win32 SendInput) | Cursor + Claude | Native addon for keystrokes | [AMENDED - Eng Agent]
| Key-name allowlist definition | Claude | ~120 valid key names defined | [AMENDED - Security Agent]
| Local storage for layouts | Claude | AsyncStorage schema |
| Haptic feedback engine | Cursor | UIImpactFeedbackGenerator integration | [AMENDED - UX Agent]

### Phase 2: Core Features (Weeks 4-6)
**Goal**: Full action system, image handling, all grid layouts

| Task | Tool/Owner | Deliverable |
|------|-----------|-------------|
| Action type system (keybind, app launch, system, multi-action) | Cursor + Claude | Action engine with payload validation |
| Button editor UI | Lovable + Cursor | Full editor with preview |
| Image picker integration (camera roll) | Claude | Image selection + crop |
| Grid layout options (2x4, 3x4, 4x5) | Cursor | Responsive grid system |
| Page system (swipe navigation) | Cursor | Multi-page support |
| Settings screen (with haptic/sound toggles) | Lovable | Settings UI |
| Connection management UI (QR + manual IP) | Cursor | Device list + status |
| Device revocation UI (Windows companion) | Cursor | Force-unpair from companion | [AMENDED - Security Agent]
| Demo mode (offline simulation) | Cursor + Claude | Functional demo without PC | [AMENDED - Business Agent]
| First-run onboarding (3-step + starter page) | Lovable + Cursor | Onboarding flow | [AMENDED - UX Agent]

### Phase 3: Themes & Polish (Weeks 7-8)
**Goal**: All 5 themes, icon packs, visual polish, accessibility [AMENDED - UX Agent]

| Task | Tool/Owner | Deliverable |
|------|-----------|-------------|
| Theme engine (dynamic styling) with accessibility built-in | Cursor + Claude | Theme provider with WCAG AA verification | [AMENDED - UX Agent]
| Design 5 themes | Canva (concepts) + code | Theme color/style configs |
| Icon pack creation (~80 original generic icons x 5 styles) | Canva + AI generation | SVG icon sets per theme | [AMENDED - Business Agent]
| VoiceOver support integration | Cursor | Full VoiceOver labels + navigation | [AMENDED - UX Agent]
| Dynamic Type support | Cursor | Text scales with system settings | [AMENDED - UX Agent]
| Button press feedback (haptic + visual + optional sound) | Cursor | Multi-sensory feedback system |
| App icon + splash screen | Canva | App Store assets |
| Companion tray app UI polish | Cursor | System tray + config window |

### Phase 4: Monetization & Auth (Weeks 9-10)
**Goal**: Pro upgrade, Supabase auth, Apple IAP

| Task | Tool/Owner | Deliverable |
|------|-----------|-------------|
| Supabase project setup | Supabase | Auth + DB + edge functions |
| Apple In-App Purchase integration | Claude + Cursor | IAP flow + receipt validation |
| Local receipt caching with offline grace period | Claude | 7-day offline entitlement cache | [AMENDED - Business Agent]
| Pro feature gating | Cursor | Feature flags by license |
| Restore purchase flow | Claude | Receipt restoration |
| Supabase edge function for receipt validation | Claude | Serverless validator |
| Profile import/export (Pro) | Cursor | JSON export/import |

### Phase 5: Security Hardening (Weeks 11-12) [AMENDED - expanded to 2 weeks per Eng Agent]
**Goal**: Penetration testing, code audit, security fixes

| Task | Tool/Owner | Deliverable |
|------|-----------|-------------|
| TLS certificate generation + pinning audit | Claude | Verified TLS implementation |
| Key-name allowlist enforcement audit | Claude + ChatGPT Codex | Allowlist validation verified | [AMENDED - Security Agent]
| Action payload schema validation audit | Claude | All payloads validated against schemas |
| Companion hardening (CSP, contextIsolation, IPC lockdown) | Cursor + Claude | Hardened companion config | [AMENDED - Security Agent]
| Auto-update signature verification | Claude | Signed update channel | [AMENDED - Security Agent]
| Dependency audit (npm audit + Snyk) | Claude | Clean audit report |
| Penetration testing (local network) | ChatGPT Codex | Security test results |
| Privacy label preparation | Manual | Accurate privacy declarations |
| Windows code signing with EV cert | Manual | Signed builds (cert procured in Phase 0) |

### Phase 6: Testing & QA (Weeks 13-14)
**Goal**: Device testing, edge cases, performance

| Task | Tool/Owner | Deliverable |
|------|-----------|-------------|
| Unit tests (action engine, protocol, allowlist) | Claude + Cursor | >80% coverage on core |
| Integration tests (phone-to-PC flow) | Manual + automated | End-to-end test suite |
| Device testing matrix | Manual | iPhone 12-16, iOS 16-18 tested | [AMENDED - QA Agent]
| Network edge cases (WiFi drops, sleep/wake, subnet changes) | Manual | Reconnection verified |
| Performance profiling (React Native) | Cursor | <100ms action latency verified |
| Windows compatibility | Manual | Win 10 21H2+, Win 11 verified | [AMENDED - QA Agent]
| Accessibility testing (VoiceOver, Dynamic Type, WCAG AA) | Manual | Accessibility acceptance criteria met | [AMENDED - UX Agent]
| Companion-not-found flow testing | Manual | Onboarding works without PC | [AMENDED - QA Agent]

### Phase 7: Beta & App Store Submission (Weeks 15-16) [AMENDED - QA Agent: expanded beta]
**Goal**: Extended beta, submit to App Store

| Task | Tool/Owner | Deliverable |
|------|-----------|-------------|
| App Store screenshots (6.7", 6.1", 5.5") | Canva | Screenshot set per device |
| App Store description + keyword research | Claude + ChatGPT | ASO-optimized listing with researched keywords | [AMENDED - QA Agent]
| App Store preview video (30 sec) | KlingAI + Canva | Demo video |
| Privacy policy page | Claude | Hosted privacy policy |
| Terms of service page | Claude | Hosted ToS |
| Press kit creation | Canva + Claude | Logo, screenshots, description, contact | [AMENDED - QA Agent]
| TestFlight beta (minimum 2 weeks, 50+ external testers) | Manual | Beta exit criteria met | [AMENDED - QA Agent]
| Beta exit criteria: crash rate <0.5%, zero P0 bugs, 80% pairing success | Manual | Criteria documented and met | [AMENDED - QA Agent]
| Submit for App Review (phased rollout: start at 10%) | Manual | Submission complete | [AMENDED - QA Agent]
| Windows installer (.exe + .msi) | Electron/Tauri Builder | Signed installer |
| Landing page / website | Lovable | Marketing site |

### Phase 8: Launch (Weeks 17-18)
**Goal**: Public release, marketing push

| Task | Tool/Owner | Deliverable |
|------|-----------|-------------|
| App Store approval + phased go-live (10% -> 25% -> 50% -> 100%) | Apple | Phased rollout | [AMENDED - QA Agent]
| Windows companion download page | Lovable | Download portal |
| Launch announcement (social, Reddit, Product Hunt) | Manual + Claude | Launch copy |
| Influencer/streamer outreach (5-10 small creators) | Manual | Outreach emails sent | [AMENDED - QA Agent]
| Support documentation / FAQ | Claude | Help center content |
| Setup tutorial video with voiceover | KlingAI + ElevenLabs | Tutorial on landing page |
| Analytics dashboard setup (Supabase) | Supabase | Basic usage metrics |
| Bug triage process setup | GitHub Issues | Issue templates ready |
| Crash monitoring alerting (Sentry or equivalent) | Manual | Alert thresholds configured | [AMENDED - QA Agent]

---

## 7. POST-LAUNCH PLAN (Weeks 19-22) [AMENDED - QA Agent: entirely new section]

### 7.1 Monitoring & Stability
- **Crash rate alerting**: Alert if crash rate exceeds 0.3% (warning) or 0.5% (critical)
- **Latency monitoring**: Track p95 action latency, alert if >200ms
- **Connection success rate**: Track pairing success rate, target >90%
- **Daily metrics review** for first 2 weeks post-launch

### 7.2 Hotfix SLA
| Severity | Response Time | Fix Deployed |
|----------|--------------|-------------|
| P0 (app crash, security issue) | 4 hours | 24 hours (request expedited App Review) |
| P1 (major feature broken) | 12 hours | 72 hours |
| P2 (minor bug, cosmetic) | 48 hours | Next scheduled release |

### 7.3 Feedback Loop
- GitHub Issues for bug reports (template with device info, OS version, steps to reproduce)
- In-app feedback button (Pro users)
- Monitor App Store reviews daily for first 30 days
- Reddit/Discord community monitoring

### 7.4 Rollback Strategy [AMENDED - QA Agent]
- **Phased rollout**: Start at 10%, pause if crash rate spikes, rollback via App Store Connect
- **Server-side feature flags**: Disable broken Pro features via Supabase without app update
- **Expedited review**: Apple allows expedited review requests for critical fixes
- **Windows companion**: Auto-update with rollback to previous version if update fails

### 7.5 v1.1 Roadmap (Weeks 19-22)
- GIF/animated button support (Pro feature) [AMENDED - UX Agent]
- Android companion app evaluation
- Additional icon packs (downloadable)
- Community theme sharing
- Folder/group organization for buttons
- Widget support (iOS Lock Screen / Home Screen)

---

## 8. MARKETING & DISTRIBUTION PLAN [AMENDED - QA Agent: entirely new section]

### 8.1 Pre-Launch (Weeks 15-16)
- Landing page live with email waitlist (Lovable)
- "Coming Soon" posts on r/streaming, r/productivityapps, r/ios
- Press kit distributed to 10 tech bloggers / YouTubers
- Product Hunt launch page drafted

### 8.2 Launch Day (Week 17)
- Product Hunt launch (coordinate for Tuesday morning)
- Reddit posts: r/streaming, r/obs, r/twitch, r/iphone, r/productivity
- Twitter/X announcement thread
- 5-10 small streamer/creator outreach (free Pro keys)

### 8.3 Post-Launch (Weeks 18-22)
- Respond to every App Store review
- Weekly Reddit/community engagement
- Iterate on ASO (keywords, screenshots) based on search data
- Consider $50-100 Apple Search Ads experiment

### 8.4 Revised Download Target
- **500 downloads in 30 days** (organic, no paid ads) [AMENDED - QA Agent: reduced from 1,000]
- **1,000 downloads in 60 days** (with ASO iteration + community growth)

---

## 9. TOOL ALLOCATION

| Tool | Primary Use |
|------|------------|
| **Claude Max (20x)** | Architecture, protocol design, security review, code generation, testing |
| **Cursor** | Primary IDE for all coding (React Native + companion) |
| **ChatGPT Pro / Codex** | Security audit, code review, alternative perspectives, penetration testing |
| **Lovable** | Rapid UI prototyping (settings, editor, onboarding, landing page) |
| **Canva** | Original icon pack design, App Store screenshots, press kit, marketing assets |
| **Supabase** | Auth, database, edge functions, feature flags, analytics |
| **Stripe** | Future payment processing (Windows-side purchases) |
| **KlingAI** | App Store preview video, tutorial video, marketing content |
| **ElevenLabs** | Voiceover for preview/tutorial videos |
| **Antigravity** | Deployment, hosting for landing page + privacy policy |

---

## 10. APP STORE COMPLIANCE CHECKLIST

- [ ] Built with iOS 26 SDK (required after April 28, 2026)
- [ ] Minimum deployment target: iOS 16
- [ ] Privacy Nutrition Labels accurately filled out
- [ ] NSLocalNetworkUsageDescription string set with clear reason
- [ ] Does NOT resemble iOS system UI or App Store interface
- [ ] Connects only to user-owned devices (guideline 4.2.7 compliant)
- [ ] Apple In-App Purchase used for Pro upgrade (no external payment)
- [ ] Restore Purchase button present and functional
- [ ] No private API usage
- [ ] No background location or unnecessary permissions
- [ ] App does not crash during review (thorough QA)
- [ ] Demo mode functional without companion PC [AMENDED - Business Agent]
- [ ] Review notes explain companion app requirement
- [ ] Companion app download link provided in review notes
- [ ] Age rating: 4+ (no objectionable content)
- [ ] COPPA compliant (no data collected from children)
- [ ] Export compliance (encryption declaration - uses standard TLS)
- [ ] App preview video follows Apple guidelines (no hands, device frames only)
- [ ] No third-party trademarks in bundled icon packs [AMENDED - Business Agent]
- [ ] VoiceOver and Dynamic Type accessibility verified [AMENDED - UX Agent]

---

## 11. RISK REGISTER

| Risk | Impact | Mitigation |
|------|--------|-----------|
| App Store rejection | High | Compliance checklist, demo mode for reviewers, detailed review notes, phased rollout |
| React Native performance on older iPhones | Medium | Profile early, use Hermes, keep UI simple, test on iPhone 12 minimum |
| WebSocket instability on WiFi | Medium | 2s heartbeat, exponential backoff, manual IP fallback, connection status UI |
| Competitor releases similar product | Low | Move fast, differentiate with themes/UX, build community |
| Apple IAP receipt fraud | Low | Server-side receipt validation + local cache with expiry |
| Windows antivirus flags companion | High | EV code signing from Week 0, SmartScreen reputation building | [AMENDED - Business Agent: raised to High]
| Icon pack IP/trademark claims | High | Original generic icons only, no third-party logos bundled | [AMENDED - Business Agent: raised to High, mitigated]
| Corporate WiFi blocks mDNS | Medium | Manual IP as first-class connection method, prominent in onboarding | [AMENDED - Eng Agent]
| Post-launch critical bug | High | Phased rollout, feature flags, expedited review process, hotfix SLA | [AMENDED - QA Agent]

---

## 12. SUCCESS METRICS (Launch + 30 Days)

- **App Store**: Approved on first or second submission
- **Downloads**: 500+ in first 30 days (organic) [AMENDED - QA Agent]
- **Crash Rate**: <0.1% (App Store standard)
- **Action Latency**: <100ms button press to PC execution (p95)
- **Pairing Success Rate**: >90% of users complete pairing on first attempt
- **Pro Conversion**: >5% of free users upgrade
- **Rating**: Maintain 4.0+ stars
- **Support**: <24hr response time on GitHub Issues
- **Beta Exit**: Crash rate <0.5%, zero P0 bugs, 80% pairing flow completion [AMENDED - QA Agent]

---

## 13. TIMELINE SUMMARY

| Week | Phase | Key Milestone |
|------|-------|--------------|
| 0 | Pre-Development | EV cert ordered, Tauri/Electron decided, SendInput POC | [AMENDED]
| 1-3 | Foundation | Working phone-to-PC connection with 2x4 grid + haptics |
| 4-6 | Core Features | Full action system, editor, multi-page, demo mode, onboarding |
| 7-8 | Themes & Polish | All 5 themes + original icon packs + accessibility |
| 9-10 | Monetization | Pro upgrade working via Apple IAP with local caching |
| 11-12 | Security | Security audit passed (expanded to 2 weeks) | [AMENDED]
| 13-14 | Testing & QA | All tests passing, device matrix verified |
| 15-16 | Beta & Submission | 2-week TestFlight (50+ testers), App Store submission | [AMENDED]
| 17-18 | Launch | Phased public release + marketing push |
| 19-22 | Post-Launch | Monitoring, hotfixes, v1.1 planning | [AMENDED]

**Total: ~18 weeks from start to launch + 4 weeks post-launch stabilization**

---

## AMENDMENT LOG

All 21 amendments from the 5-agent review panel have been incorporated:

### From Security Architect (4)
1. Added key-name allowlist for action payloads (Section 2.3, 3.3)
2. mDNS broadcast restricted to pairing-mode only (Section 2.3, 3.1)
3. Device revocation/force-unpair added to companion (Section 3.2, Phase 2)
4. Electron hardening mandated: contextIsolation, nodeIntegration:false, CSP (Section 3.6)

### From UX/Design Lead (4)
5. Free tier increased to 8 buttons / 2x4 grid (Section 5.1)
6. Haptic feedback specified as mandatory (Section 4.1, Phase 1)
7. First-run onboarding flow added (Section 4.1, Phase 2)
8. Accessibility moved from Phase 6 to Phase 3 (Section 4.2, Phase 3)

### From Business/App Store Expert (4)
9. Third-party brand icons replaced with original generic designs (Section 4.3)
10. Demo/offline mode added for App Store review (Section 4.1, Phase 2)
11. Local receipt caching added with 7-day grace period (Section 2.2, 5.3)
12. EV code-signing certificate procurement moved to Phase 0 (Phase 0)

### From Senior Engineer (3)
13. Keybind execution specified as Win32 SendInput via native addon (Section 2.2)
14. Manual IP elevated to first-class connection method (Section 2.3, 4.1)
15. Heartbeat reduced to 2 seconds with defined backoff schedule (Section 2.3)

### From QA/Launch Manager (6)
16. Post-Launch Plan added (Section 7 - entirely new)
17. TestFlight expanded to 2 weeks, 50+ testers, exit criteria defined (Phase 7)
18. Rollback strategy added: phased rollout, feature flags, expedited review (Section 7.4)
19. Minimum iOS 16 and Windows 10 21H2+ specified (Section 2.2)
20. Companion-not-found onboarding flow designed (Section 4.1)
21. Marketing/distribution plan added (Section 8 - entirely new)

---

*Plan finalized with 21 amendments from Round 1. Ratified unanimously (5/5 hard YES, zero conditions) in Round 2 review on 2026-04-09.*
