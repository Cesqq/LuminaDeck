# LuminaDeck - App Store Review Notes

## What This App Does

LuminaDeck turns an iPhone into a customizable macro deck for controlling a Windows PC over the local WiFi network. Users create button grids that execute keyboard shortcuts, launch applications, and trigger system actions (volume control, media playback, screenshots, etc.) on their paired PC.

## Companion App Required

LuminaDeck requires a free companion app running on the user's Windows PC to function. The companion app:
- Receives button press commands from the iPhone over a secure TLS 1.3 WebSocket connection
- Executes the requested actions via Win32 SendInput API
- Runs as a lightweight system tray application (~5MB installer)

**Download**: The companion app can be downloaded from https://luminadeck.app/download

## Demo Mode

The app includes a fully functional **Demo Mode** that works without a companion PC:
- All buttons show visual feedback (haptic + animation) when tapped
- No actual PC actions are executed
- A banner at the top indicates "Demo Mode" is active
- The demo profile includes 8 pre-configured buttons (volume, media, clipboard shortcuts)

**To review without a PC**: Simply launch the app and use Demo Mode. All UI features, button editing, theme selection, settings, and the Pro upgrade flow are accessible without a companion connection.

## Network Communication

- **Local network only**: All communication stays on the user's local WiFi network
- **No cloud relay**: No data leaves the local network for core functionality
- **TLS 1.3**: All connections are encrypted with self-signed certificates
- **mDNS**: Used only during active pairing (Bonjour service discovery), stopped after pairing completes

## Permissions Requested

| Permission | Purpose |
|-----------|---------|
| NSLocalNetworkUsageDescription | Discover and connect to the LuminaDeck Companion on the user's PC |
| NSBonjourServices | mDNS service discovery for automatic pairing |
| NSCameraUsageDescription | QR code scanning for quick PC pairing |
| NSPhotoLibraryUsageDescription | Custom button icon selection from photo library |

## In-App Purchase

- **Product**: LuminaDeck Pro (non-consumable, $9.99 one-time)
- **Free tier**: 8 buttons, 1 page, 1 theme (Obsidian), 1 paired PC
- **Pro tier**: 30 buttons/page, 20 pages, 5 themes, custom images, multi-action, 5 PCs
- **Restore Purchase**: Available in Settings screen
- **Provider**: RevenueCat (StoreKit 2)

## Privacy

- No analytics SDKs included
- No third-party tracking
- Account email collected only if user creates a Supabase account (optional)
- Core functionality works entirely offline
- Privacy Manifest included (NSPrivacyAccessedAPICategoryUserDefaults for AsyncStorage)

## Technical Details

- Built with React Native (Expo SDK 54) + TypeScript
- Minimum iOS version: iOS 16
- Supports iPhone 12 and newer
- Portrait orientation only
- No background location or unnecessary background modes
- Encryption: Standard TLS 1.3 (ITSAppUsesNonExemptEncryption: false)

## Test Account

No account is required to use the app. All features work without signing in.

## Contact

For questions during review: support@luminadeck.app
