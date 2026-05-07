# LuminaDeck — Submission Checklist (2026-04-29)

Single source-of-truth for full submission to **Apple App Store**, **Google Play**, and **Microsoft Store**. Every text field copy-pasteable, every asset path absolute, every Gates blocker resolved or queued.

This checklist supersedes any earlier submission notes. Generated after a Tipsy → Fill → Gates → Cipher → Kylie pipeline run.

---

## Status snapshot

| Store | Listing copy | Assets | Gates | Submission state |
|---|---|---|---|---|
| **Apple App Store** | ✅ ready | ⚠️ iOS screenshots needed | ✅ pass + 2 warnings | iOS v1.3.2 (1) uploading to TestFlight |
| **Google Play** | ✅ ready | ✅ all in repo | ✅ pass + 1 warning | Android keystore step blocking AAB |
| **Microsoft Store** | ✅ ready | ⚠️ Studio screenshots needed | ✅ pass + 0 warnings | MSIX rebuild needed (versions just synced) |

Cipher prose check: 38 / 36 / 42 (Apple / Play / MS) — all under 70 block threshold ✅

---

## Apple App Store

**Source listing:** [`C:/Users/czr05/Fill/Lumina Deck/apple_app_store.md`](C:/Users/czr05/Fill/Lumina Deck/apple_app_store.md)

### Beta — TestFlight (paste into ASC → TestFlight → Test Information)

| Field | Char limit | Status | Where it lives |
|---|---|---|---|
| Beta App Description | 4000 | 612 ✅ | Block A |
| What to Test | 4000 | 754 ✅ | Block B |
| Email | — | luminadeck@luminaaio.com | — |
| Marketing URL | — | https://luminaaio.com/luminadeck | — |
| Privacy Policy URL | — | https://luminaaio.com/luminadeck/privacy | — |

### Full submission — App Store (paste into ASC → App Information + Pricing + 1.3.2 Version)

| Field | Limit | Status |
|---|---|---|
| Name | 30 | 10 ✅ "LuminaDeck" |
| Subtitle | 30 | 28 ✅ "Your phone is the macro deck" |
| Promotional Text | 170 | 162 ⚠️ tight (95%) |
| Description | 4000 | 2779 ✅ |
| Keywords | 100 | 96 ⚠️ tight (96%) |
| What's New | 4000 | 735 ✅ |
| Primary Category | — | Productivity |
| Secondary Category | — | Utilities |
| Age Rating | — | 4+ |
| Copyright | — | (c) 2026 LuminaDeck |

### Apple required iOS screenshots (NOT YET CAPTURED)

- iPhone 6.9" (iPhone 16 Pro Max) — **1290 × 2796**, 3–10 shots
- iPad 13" (iPad Pro 13") — **2048 × 2732**, 3–10 shots — required because `app.json` has `supportsTablet: true`
- Capture path: iOS Simulator on Mac via SSH after the next prebuild + sim build (see "Open items" below)

### Reviewer notes (paste into ASC → Version → App Review Information)

```
LuminaDeck has no login or paywall. Every feature in this build is
accessible without an account.

To exercise the core flow, you'll need a Windows PC running LuminaDeck
Studio (free download at https://luminaaio.com/luminadeck — let us know
if you'd prefer we ship a Studio MSIX directly to the review email).

Steps:
1. Install Studio on a Windows 10/11 machine on the same Wi-Fi as
   the test device.
2. Open Studio. The Connect tab shows a QR code.
3. On the iPhone/iPad app, tap Connect → Scan QR Code → point at the QR.
4. Pairing completes in under 10 seconds. The deck is now live.
5. Tap any tile to confirm an action fires on the PC.

If for any reason a Windows machine isn't available, the app's Demo
Mode (offered on first launch as "Continue in Demo Mode") shows the
full UI without firing any actions — sufficient to evaluate the deck
editor, profile management, themes, and pricing.

No demo credentials needed. No payment required to evaluate the app.
```

### IARC age-rating answers (Apple uses Apple's questionnaire — equivalent answers)

| Question | Answer |
|---|---|
| Cartoon or fantasy violence | None |
| Realistic violence | None |
| Sexual content/nudity | None |
| Profanity / crude humor | None |
| Alcohol / tobacco / drugs | None |
| Mature/suggestive themes | None |
| Horror / fear themes | None |
| Gambling | None |
| Contests | None |
| User-generated content | None (no UGC, no chat) |
| Unrestricted web access | None |
| Frequent/intense medical info | None |

Result: **Apple 4+**, IARC equivalent **Everyone (3+)**

---

## Google Play

**Source listing:** [`C:/Users/czr05/Fill/Lumina Deck/google_play.md`](C:/Users/czr05/Fill/Lumina Deck/google_play.md)
**Submission checklist:** [`C:/Dev/LuminaDeck/marketing/play-store/PLAY-CONSOLE-CHECKLIST.md`](marketing/play-store/PLAY-CONSOLE-CHECKLIST.md)

### Internal Testing (paste into Play Console → Testing → Internal testing)

| Field | Char limit | Status |
|---|---|---|
| Tester Instructions | 4000 | 798 ✅ |
| Email subject | 100 | 40 ✅ |
| Email body | 4000 | 977 ✅ |

### Production submission (paste into Play Console → Main store listing)

| Field | Limit | Status |
|---|---|---|
| Title | 50 | 10 ✅ "LuminaDeck" |
| Short Description | 80 | 68 ✅ |
| Full Description | 4000 | 2917 ✅ |
| What's New | 500 | 496 ⚠️ tight (99%) |
| Category | — | Tools |
| Tags | — | Productivity, Tools, Utilities, Streaming, Developer Tools |
| Privacy Policy URL | — | https://luminaaio.com/luminadeck/privacy |
| Target audience | — | 18+ |

### Google Play assets (all in repo)

| Asset | File | Status |
|---|---|---|
| Hi-res icon (512×512) | [`marketing/play-store/hi-res-icon-512.png`](marketing/play-store/hi-res-icon-512.png) | ✅ |
| Feature graphic (1024×500) | [`marketing/play-store/feature-graphic-1024x500.png`](marketing/play-store/feature-graphic-1024x500.png) | ✅ |
| Screenshots (×7, 1080×2400) | [`marketing/play-store/screenshots/01..07-*.png`](marketing/play-store/screenshots/) | ✅ source-direct adb captures |

### Data Safety form (paste into Play Console → App content → Data safety)

```
Does your app collect or share any of the required user data types?
→ No

Is all user data encrypted in transit?
→ No data is collected. (TLS on the local WebSocket exists, but
   covers operational data only — button presses, profile sync.)

Do you provide a way for users to request data deletion?
→ Not applicable — no data is collected. Uninstalling the app
   removes all locally-stored profiles + settings.
```

### IARC content rating answers — same as Apple matrix above. Result: **Everyone**.

### Android keystore (BLOCKER — your manual step)

See [`docs/SETUP-ANDROID-KEYSTORE.md`](docs/SETUP-ANDROID-KEYSTORE.md). Use Android Studio → Build → Generate Signed Bundle / APK → Android App Bundle. Output: `apps/mobile/android/app/build/outputs/bundle/release/app-release.aab`.

---

## Microsoft Store

**Source listing:** [`C:/Users/czr05/Fill/Lumina Deck/microsoft_store.md`](C:/Users/czr05/Fill/Lumina Deck/microsoft_store.md)
**Identity:** Publisher `CN=24DA9F28-A632-4B32-AB31-FAD4EC93A0A2`, Package Name `CZRE.LuminaDeck`

### Package flighting (Partner Center → Packages → Package flights)

| Field | Limit | Status |
|---|---|---|
| Description for flight testers | 1500 | 718 ✅ |
| What's new for flight testers | 1500 | 706 ✅ |

### Full submission (Partner Center → Store listings → English (US))

| Field | Limit | Status |
|---|---|---|
| Display name | 256 | 17 ✅ "LuminaDeck Studio" |
| Description | 10,000 | 3947 ✅ |
| Short description | 200 | 182 ✅ |
| Release notes | 1500 | 847 ✅ |
| Search terms (×7) | 30 each | per Fill output |
| Category | — | Productivity → Utilities and tools |
| System requirements | — | Windows 10 v2004+ (x64), Windows 11 |
| Pricing | — | Free |
| Privacy URL | — | https://luminaaio.com/luminadeck/privacy |

### Microsoft Store screenshots (NOT YET CAPTURED)

- 5–10 PNG/JPG at **1366 × 768** minimum (16:9)
- Recommend Windows 11 dark-mode captures of: deck editor, plugin config, OBS plugin in action, auto-profile rule list, system tray flow
- Capture on this PC; Studio runs locally — see "Open items" below

### Microsoft Store logos

| Logo | Size | File |
|---|---|---|
| Store logo | 300×300 (1240×1240 source) | `apps/companion/src-tauri/icons/icon.png` (existing 1024×1024 — needs resize to 1240×1240) |
| Square 150×150 | 150×150 | `apps/companion/src-tauri/icons/128x128.png` |
| Square 44×44 | 44×44 | `apps/companion/src-tauri/icons/32x32.png` |

### runFullTrust justification (Partner Center → App declarations)

```
LuminaDeck Studio uses the runFullTrust capability to call the Win32
SendInput API for emulating user keyboard/mouse events on the same PC.
This is the core product function: when the user taps a tile on their
phone, Studio receives the action over the LAN WebSocket and emulates
the corresponding keyboard shortcut, mouse click, or system action.

Additional Win32 APIs used:
- SetForegroundWindow / GetForegroundWindow — auto-profile switching
  reads the foreground window's process name to swap deck layouts.
- mDNS multicast (raw UDP, not allowed in UWP sandbox) — local-network
  device discovery for first-time pairing.
- File I/O outside the AppData sandbox — read TLS certs from
  %ProgramData%\LuminaDeck for self-signed local-only HTTPS.

No data leaves the user's local network. No telemetry. No outbound
HTTP/S calls in shipped builds.
```

### IARC content rating — same answers as Apple/Play. Result: **Everyone (3+)**.

### MSIX rebuild (BLOCKER — needed before upload)

The four version manifests have just been reconciled to **1.3.0** as of 2026-04-29:
- `apps/companion/src-tauri/Cargo.toml` — 1.3.0 ✅
- `apps/companion/src-tauri/tauri.conf.json` — 1.3.0 ✅ (was 1.1.0)
- `apps/companion/src-tauri/Package.appxmanifest` — Version="1.3.0.0" ✅ (was 1.1.0.0)
- `apps/companion/msix-staging/AppxManifest.xml` — Version="1.3.0.0" ✅ (was 0.1.0.0)

Re-run `scripts/build-msix.ps1` to produce a fresh MSIX before uploading to Partner Center, otherwise the cert system flags a regression.

---

## Launch announcement (Kylie / @luminaautomations)

8-slide carousel + caption + audio pick + Reel companion ready in:
```
OneDrive/IG Posts/Lumina/2026-04-28_luminaautomations_luminadeck-launch/
OneDrive/IG Posts/_captions/2026-04-28_luminaautomations_luminadeck-launch.md
```

Lead angle: **B — Your Phone Is Already There** (Apple-tone, lowest legal risk). Angle A ($150 hardware comparison) and C ($9.99 once vs $36/yr) appear as supporting beats in slide 06.

Audio: "Seaside Eyes (Instrumental)" — Bertie Newman (biz-safe, business-account licensed).
Posting window: Tuesday or Wednesday 7:30–9:00 AM CT (primary), Sunday 6:00–8:00 PM CT (backup).
Clark Kent verdict: APPROVE — 8.0/10 mean.

Workflow (mobile-first per agent spec):
1. Files → OneDrive → IG Posts → Lumina → 2026-04-28_luminaautomations_luminadeck-launch
2. Save all 8 PNGs to Photos in slide order
3. IG → + → POST → select 8 in order → Add Music → "Seaside Eyes Instrumental Bertie Newman"
4. Caption: SHORT v1 from caption.md
5. First comment: 17 hashtags from caption.md
6. No AI label needed — no synthetic visuals in this carousel

---

## Open items (asset captures + manual steps)

| Item | Where | Effort | Blocker? |
|---|---|---|---|
| iOS screenshots (1290×2796 + 2048×2732) | Mac SSH, iOS Simulator | ~30 min | Apple full launch, NOT TestFlight |
| MS Store screenshots (1366×768, ×5–10) | This Windows PC, Studio dark mode | ~15 min | MS Store full submission |
| Republish privacy policy at luminaaio.com | Lumina website project (separate repo) | ~5 min + git push | Yes — current website still says "iPhone" only |
| Android keystore + signed AAB | Android Studio | ~5 min once | Yes — Play Console submission |
| MSIX rebuild after version sync | `scripts/build-msix.ps1` | ~3 min | Yes — Partner Center upload |
| iPad layout smoke test | iOS Simulator iPad Pro 13" | ~5 min | Soft — Apple supportsTablet=true |

---

## Manual click-through

### Apple App Store Connect

1. https://appstoreconnect.apple.com → My Apps → LuminaDeck (App ID `6762442797`)
2. **TestFlight** tab → Test Information → paste Block A + Block B from `apple_app_store.md`
3. After ASC processing finishes (next 5–60 min from upload), build appears in "iOS Builds" → click into it → submit Export Compliance: Does your app use encryption? **No** (LAN-only, TLS auto-exempt)
4. Add internal/external testers as needed
5. **App Store** tab → click into the iOS App version 1.3.2:
   - Paste Name, Subtitle, Promotional Text, Description, Keywords, What's New from `apple_app_store.md`
   - Upload screenshots once captured (1290×2796 iPhone + 2048×2732 iPad)
   - Reviewer notes block from this checklist
   - Submit for review

### Google Play Console

1. https://play.google.com/console → All apps → LuminaDeck
2. **Testing → Internal testing**: create new release, upload signed AAB
   - Release notes: paste Block E from `google_play.md`
3. **Main store listing**: paste from `google_play.md`:
   - Title, Short, Full descriptions
   - Upload icon, feature graphic, 7 screenshots from `marketing/play-store/`
4. **App content**:
   - Privacy policy URL: https://luminaaio.com/luminadeck/privacy
   - Data safety: paste from this checklist (no data collected)
   - Content rating: complete IARC questionnaire (use answers above)
   - Target audience: 18+
5. **Production**: when ready, promote internal testing release to production

### Microsoft Partner Center

1. https://partner.microsoft.com → Apps and games → LuminaDeck Studio
2. Run `scripts/build-msix.ps1` locally to produce a fresh 1.3.0.0 MSIX
3. **Packages**: upload the MSIX, fill in flight settings if doing staged rollout
4. **Store listings → English (US)**: paste from `microsoft_store.md`:
   - Display name, descriptions, release notes, search terms
   - Capture and upload 5–10 Studio screenshots (1366×768+, dark mode)
5. **Properties → Capabilities + App declarations**: paste runFullTrust justification
6. **Pricing and availability**: Free, all markets
7. **Age rating**: complete IARC (use answers above)
8. **Submit to the Store**

---

## Generated artifacts (full file map)

| File | Purpose |
|---|---|
| `C:/Users/czr05/Tipsy/profiles/lumina-deck.md` | Brand DNA, voice, three winning angles, do-not-say list |
| `C:/Users/czr05/Tipsy/profiles/lumina-deck-launch-calendar.csv` | 14-day launch calendar, 24 posts |
| `C:/Users/czr05/Fill/Lumina Deck/apple_app_store.md` | Apple listing — beta + full |
| `C:/Users/czr05/Fill/Lumina Deck/google_play.md` | Play listing — beta + full |
| `C:/Users/czr05/Fill/Lumina Deck/microsoft_store.md` | MS Store listing — flight + full |
| `C:/Users/czr05/Gates/Reports/2026-04-29_lumina-deck.md` | Pre-submission audit, all three stores |
| `C:/Users/czr05/Cipher/Reports/2026-04-29_lumina-deck.md` | AI-prose detector scan |
| `OneDrive/IG Posts/Lumina/2026-04-28_luminaautomations_luminadeck-launch/` | 8 carousel slides + reel |
| `C:/Dev/LuminaDeck/marketing/SUBMISSION-CHECKLIST-2026-04-29.md` | This file |

## Code edits applied this session (Gates fixes)

- `apps/companion/src-tauri/tauri.conf.json` — version 1.1.0 → 1.3.0
- `apps/companion/src-tauri/Package.appxmanifest` — Version 1.1.0.0 → 1.3.0.0; description rewritten platform-neutral, TLS 1.3 → TLS-encrypted
- `apps/companion/msix-staging/AppxManifest.xml` — Version 0.1.0.0 → 1.3.0.0; iPhone → phone in description
- `apps/mobile/android/app/src/main/AndroidManifest.xml` — added `tools:node="remove"` to RECORD_AUDIO, SYSTEM_ALERT_WINDOW, READ/WRITE_EXTERNAL_STORAGE
- `docs/PRIVACY-POLICY.md` — iPhone → phone, added Google Play Billing + Microsoft Store, TLS 1.3 → "TLS 1.2 or 1.3 negotiated by the local TLS stack"
- `C:/Users/czr05/Fill/Lumina Deck/microsoft_store.md` — removed update-check ping references (3 places), Stream Deck profile importer → Hardware-deck profile importer (3 places), TLS 1.3 → TLS-encrypted (2 places), version mismatch note marked resolved
- `C:/Users/czr05/Fill/Lumina Deck/apple_app_store.md` — TLS 1.3 → TLS-encrypted, "iPhone keyboard" → "your phone keyboard"
- `C:/Users/czr05/Fill/Lumina Deck/google_play.md` — TLS 1.3 → TLS-encrypted (2 places, including Data Safety form)

Net file changes: 8 files modified across mobile + companion + Fill outputs + privacy. No code-behavior changes (config + manifest + copy only). All Cargo + JS tests still green from the v1.4 session.
