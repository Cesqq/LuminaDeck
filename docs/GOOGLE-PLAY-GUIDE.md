# LuminaDeck — Google Play Store Distribution

## Overview

While LuminaDeck v1.0 targets iOS, the React Native codebase supports Android with minimal changes. The EAS build pipeline is already configured for Android.

## Prerequisites

- Google Play Developer account ($25 one-time) — DONE
- EAS CLI configured — DONE
- Android build artifact (.apk or .aab) from EAS

## EAS Submit Configuration

Once you have a successful Android build, submit to Google Play:

```bash
cd apps/mobile
eas submit --platform android --profile production
```

EAS will prompt for your Google Play Service Account key. Set this up:

1. Go to Google Play Console → Setup → API access
2. Create a service account or link an existing one
3. Download the JSON key file
4. Store it securely (never commit to git)
5. Run: `eas secret:create --scope project --name GOOGLE_SERVICE_ACCOUNT_KEY --type file --value ./path-to-key.json`

## Store Listing Content

**Title**: LuminaDeck - Macro Deck for PC

**Short description** (80 chars):
Turn your phone into a customizable macro deck for your Windows PC.

**Full description**:
LuminaDeck turns your phone into a powerful macro deck for controlling your Windows PC over secure local WiFi.

Create custom button grids to execute keyboard shortcuts, launch applications, control media playback, adjust volume, take screenshots, and trigger multi-action sequences — all with a single tap.

Features:
- Customizable button grids (2x4, 3x4, 4x5 layouts)
- 80+ built-in icons across 11 categories
- 5 polished themes (Obsidian, Aurora, Daylight, Retro Neon, Slate)
- Multi-action sequences with configurable delays
- Haptic feedback on every button press
- QR code pairing for instant setup
- Manual IP connection for corporate networks
- TLS 1.3 encrypted local communication
- Demo mode — try it without a PC

Free tier includes 8 buttons, 1 page, and 1 theme. Upgrade to Pro ($9.99 one-time) for unlimited pages, all themes, custom images, and multi-action buttons.

Requires the free LuminaDeck Companion app on your Windows PC.

**Category**: Tools
**Content rating**: Everyone
**Privacy policy**: https://luminadeck.app/privacy

## Timeline

Android is a v1.1 target. Focus is iOS first, then Android port once iOS is stable in the App Store.
