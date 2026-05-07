# Microsoft Store — LuminaDeck Studio submission copy

Paste-ready content for Partner Center → LuminaDeck Studio → new
submission. Every field below has a corresponding field in the Partner
Center form.

Before upload, rebuild the MSIX from the current hardened source. Do not use
older `0.1.0`/pre-hardening MSIX artifacts left in the repo root or staging folders.

---

## Pricing and availability

- **Price**: Free
- **Free trial**: None
- **Markets**: All markets
- **Visibility**: Public
- **Age rating**: Everyone (Use the IARC questionnaire below — it maps to
  "Everyone" automatically)

---

## IARC age rating questionnaire answers

Pick these when Partner Center routes you through IARC:

- **Category**: Utility / Productivity
- **Violence**: None
- **Sexual content**: None
- **Profanity**: None
- **Gambling**: None
- **Drug / alcohol / tobacco reference**: None
- **Fear / horror**: None
- **In-game purchases**: No (no IAP in the desktop companion — IAP is in
  the iPhone app only, which is a separate App Store listing)
- **User interaction**: No (no in-app chat, no user-to-user communication)
- **User-generated content**: No
- **Shares user location**: No
- **Shares personal info**: No
- **Internet connection required**: Yes (local network, no cloud)
- **Digital purchases**: No
- **Result**: IARC rating "3+" → maps to MS Store "Everyone"

---

## Properties

- **Category**: Productivity
- **Subcategory**: Utilities & tools
- **System requirements**: Windows 10 version 2004 or later (x64)
- **Accessibility**: Leave unchecked unless WCAG 2.1 AA verified
- **Privacy policy URL**: `https://luminaaio.com/luminadeck/privacy`
- **Website**: `https://luminaaio.com/luminadeck`
- **Support contact info**: `luminadeck@luminaaio.com`

---

## Store listing — English (US)

### Display name

```
LuminaDeck Studio
```

### Short description (<200 chars)

```
Turn your iPhone into a macro deck for your PC. Pairs in seconds over local WiFi. Zero cloud relay; QR-paired local control.
```

### Description (full)

```
LuminaDeck Studio is the Windows companion for the LuminaDeck iPhone app (sold separately on the App Store). Install it once, pair via QR code, and turn your iPhone into a full-featured macro deck for your PC.

WHAT IT DOES
Studio listens on your local WiFi for button-press events from the phone app and fires real actions on your PC — keyboard shortcuts, app launchers, volume and media controls, Discord mute/deafen shortcuts, custom macros, and more. Latency is imperceptible because nothing leaves your WiFi.

KEY FEATURES
? Zero cloud relay ? core control stays on your local network and requires QR-paired device authentication
• QR code pairing — no accounts, no cloud sign-in, paired in under 10 seconds
• Launch-ready action catalog: keybinds, app launch, media/system controls, Discord mute/deafen shortcuts, and multi-action macros
• Auto-profile switching — your deck layout changes based on which app is in the foreground
• Open protocol — well-documented WebSocket v1.2, third-party clients welcome
• System tray integration with minimal resource footprint (~60 MB RAM)
• Up to 5 paired iPhones / iPads
• Built with Tauri + Rust — fast, small, no Electron bloat

REQUIREMENTS
• Windows 10 version 2004 or later / Windows 11
• The free LuminaDeck app on iPhone — https://apps.apple.com/app/id6762442797
• Local WiFi network shared between phone and PC

PRIVACY
LuminaDeck Studio is local-first. No telemetry, no tracking, no data sent to us by default. Every feature works offline. Full details at https://luminaaio.com/luminadeck/privacy
```

### What's new in this version

```
Initial Microsoft Store release. Includes:
• Full pairing flow with the LuminaDeck iPhone app
• Launch-ready action types (keybinds, media/system controls, Discord, macros)
• Auto-profile switching based on foreground window
• Studio editor for drag-and-drop tile layout
• Stream Deck profile importer
• System tray + auto-start on login
```

### Keywords (max 7, up to 45 chars each)

```
macro deck
wifi macro pad
iphone pc controller
pc shortcuts
discord controls
productivity shortcuts
macro keyboard
```

### Copyright and trademark info

```
(c) 2026 LuminaDeck. All rights reserved.
```

### Additional license terms

Leave blank — Microsoft Standard Application License applies.

---

## Screenshots

Partner Center requires at least **one** screenshot (1366x768 to 3840x2160).
Ideally upload 3–5 showing:

1. **Studio main tile grid** — the dashboard view with a few tiles on-screen.
   Take at 1920x1080 in Windows 11 dark mode.
2. **Studio Plugins tab** — Discord/plugin status cards showing connectivity.
3. **Studio Auto-Switch rule list** — shows the "Ableton → Ableton Live" rule.
4. **Studio Settings About card** — the version 1.3.2 + privacy URL row.
5. **QR code pairing screen** — on the Connect tab.

Capture with Windows Snip & Sketch at 1920x1080. Save as PNG. Partner
Center will reject blurry/upscaled images.

---

## Store logos

Already embedded in the MSIX at the required sizes:
- `Square44x44Logo.png`, `Square71x71Logo.png`, `Square150x150Logo.png`,
  `Square310x310Logo.png`, `Wide310x150Logo.png`, `StoreLogo.png`,
  `SplashScreen.png`

You only need to upload a **Store logo** separately in Partner Center
(usually they auto-extract from MSIX, but the form asks). That's the
300x300 hero image — generate one from the 1024x1024 source icon and
upload when prompted.

---

## Submission options / Certification notes

Paste this in the **Notes for certification** field:

```
LuminaDeck Studio is the Windows companion for a paired iPhone app that acts as a macro deck. To test the core flow end-to-end, a tester would need the paired iPhone app (com.luminadeck.app on the App Store).

HOWEVER — for certification, all of Studio's UI is fully functional WITHOUT an attached phone:
  1. Launch Studio. It opens the main window and sits in the system tray.
  2. All tabs (Deck Editor, Plugins, Auto-Switch, Profiles, Settings) are navigable.
  3. The pairing screen shows the QR code and local IP even with no phones connected.
  4. Connection count remains 0 without a paired device, as expected.

The app requires two local firewall ports:
  9876 (local WebSocket/TLS listener) ? inbound on PC for compatible clients
  9877 (authenticated local WebSocket) ? used by the mobile app for QR-paired LAN control

Both use INTERNET_CLIENT_SERVER and PRIVATE_NETWORK_CLIENT_SERVER capabilities declared in the manifest. runFullTrust is declared because:
  - We call SendInput() via the windows crate to emulate keyboard shortcuts
  - We broadcast mDNS (Bonjour) for phone discovery
  - We write to user settings dirs outside the app sandbox

No internet-bound communication is made from the companion except:
  - mDNS broadcast over UDP multicast (local network only)
  - local WebSocket server accepting paired phones (local network only)

No telemetry or analytics are sent by the companion. The iPhone app has an opt-in telemetry toggle (off by default).

Support: luminadeck@luminaaio.com
```

---

## Once submitted

1. Partner Center runs automated MSIX validation (~15 min)
2. Certification runs (~24–72h for first submission, shorter for updates)
3. You'll get an email at your Partner Center contact address with
   pass/fail
4. If rejected, the rejection email includes specific reasons — most
   common first-submit issues:
   - Missing screenshots at required resolution → upload fresh ones
   - Privacy Policy URL returns 404 → make sure
     `luminaaio.com/luminadeck/privacy` is live BEFORE you click Submit
   - Description contains competitor names → we avoid that above
4. Once certification passes, the app appears at
   `https://apps.microsoft.com/detail/CZRE.LuminaDeck` within an hour.
5. Update the `download.html` page to link to that real URL.
