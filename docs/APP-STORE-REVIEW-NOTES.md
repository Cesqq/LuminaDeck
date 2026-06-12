# LuminaDeck - App Store Review Notes

## What This App Does

LuminaDeck turns an iPhone into a customizable macro deck for controlling a Windows PC over the local WiFi network. Users create button grids that execute keyboard shortcuts, launch applications, and trigger system actions (volume control, media playback, screenshots, etc.) on their paired PC.

## Companion App Required

LuminaDeck requires a free companion app running on the user's Windows PC to function. The companion app:
- Receives button press commands from the iPhone over an authenticated local-network WebSocket connection
- Executes the requested actions via Win32 SendInput API
- Runs as a lightweight system tray application (~5MB installer)

**Download**: The companion app can be downloaded from https://luminaaio.com/luminadeck/download

## Demo Mode

The app includes a fully functional **Demo Mode** that works without a companion PC:
- All buttons show visual feedback (haptic + animation) when tapped
- No actual PC actions are executed
- A banner at the top indicates "Demo Mode" is active
- The demo profile includes 8 pre-configured buttons (volume, media, clipboard shortcuts)

**To review without a PC**: Simply launch the app and use Demo Mode. All UI features, button editing, theme selection, settings, the paywall, and the Pro upgrade flow are accessible without a companion connection.

## Reviewing the Paywall (Free vs. Pro)

LuminaDeck is **freemium with a single one-time In-App Purchase** (see "In-App Purchase" below). There is no subscription and no trial.

- On a fresh install the app opens in the **Free tier** — 12 buttons, 2 pages, the Obsidian theme, and 1 paired PC. Free is fully usable; the paywall is not required to evaluate core functionality.
- Pro-only controls (e.g. Multi-Action, custom button images, additional themes/pages) are visibly marked and, when tapped, present the **paywall screen**. The paywall is reachable from Settings → "Upgrade to Pro" and from any Pro-locked control.
- The paywall offers one product: **Lifetime Pro** (one-time purchase, displayed price localized by the App Store, e.g. $9.99). Purchasing it unlocks all Pro features permanently. **Restore Purchases** is in the paywall and in Settings.

## Network Communication

- **Local network only**: All communication stays on the user's local WiFi network
- **No cloud relay**: No data leaves the local network for core functionality
- **Authenticated pairing**: QR pairing provisions a per-device secret; unpaired devices cannot execute actions
- **mDNS**: Used only during active pairing (Bonjour service discovery), stopped after pairing completes

## Permissions Requested

| Permission | Purpose |
|-----------|---------|
| NSLocalNetworkUsageDescription | Discover and connect to the LuminaDeck Companion on the user's PC |
| NSBonjourServices | mDNS service discovery for automatic pairing |
| NSCameraUsageDescription | QR code scanning for quick PC pairing |
| NSPhotoLibraryUsageDescription | Custom button icon selection from photo library |

## In-App Purchase

- **Product**: **Lifetime Pro** — a single **non-consumable** (one-time) In-App Purchase that permanently unlocks all Pro features. Localized display price (e.g. $9.99). **No subscription, no consumables, no trial.**
- **Free tier**: 12 buttons, 2 pages, 1 theme (Obsidian), 1 paired PC
- **Pro tier**: 64 action keys, 50 pages, all themes, custom button images, multi-action sequences, 5 paired PCs
- **Restore Purchase**: Available on the paywall screen and in Settings
- **Provider**: RevenueCat (StoreKit 2). Entitlement: a missing/unconfigured purchase never unlocks Pro — the app fails closed to the Free tier.

## Privacy

- No third-party advertising SDKs and no ad tracking
- Optional diagnostics/telemetry is **off by default**
- Account email is collected only if the user creates an optional account (Supabase); the app is fully usable without an account
- Core functionality works entirely offline (local-network PC control)
- Privacy Manifest included (NSPrivacyAccessedAPICategoryUserDefaults for AsyncStorage)

## Technical Details

- Built with React Native (Expo SDK 54) + TypeScript
- Minimum iOS version: iOS 16
- Supports iPhone 12 and newer
- Portrait orientation only
- No background location or unnecessary background modes
- Encryption export: ITSAppUsesNonExemptEncryption is false; core PC control uses local-network authenticated pairing rather than a cloud relay

## Test Account

No account or sign-in is required to review the app. **Free-tier features** are available immediately on launch; **Pro features** require the one-time Lifetime Pro purchase described above (use a Sandbox tester account to exercise the purchase). The optional Supabase account is unrelated to the Pro entitlement and is not needed for review.

## Contact

For questions during review: luminadeck@luminaaio.com
