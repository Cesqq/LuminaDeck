# LuminaDeck Companion — Microsoft Store Distribution

## Why Microsoft Store?

- **No code-signing certificate needed** — Microsoft signs the MSIX package
- **No SmartScreen warnings** — Store apps are trusted by default
- **Auto-updates** — Store handles update delivery
- **One-time $19** — Microsoft Partner Center registration fee
- **Free forever after** — No annual certificate renewal costs

## Prerequisites

1. Microsoft Partner Center account ($19 one-time)
   - Register at https://partner.microsoft.com/dashboard
   - Use your Microsoft account (personal or org)

2. Reserve the app name "LuminaDeck Companion"
   - Partner Center → Apps and Games → New product → MSIX or PWA app
   - Reserve "LuminaDeck Companion" as the display name

## Build Process

### Step 1: Build the Tauri NSIS installer

```bash
cd apps/companion
pnpm tauri:build
```

This produces:
- `src-tauri/target/release/bundle/nsis/LuminaDeck Companion_0.1.0_x64-setup.exe`

### Step 2: Convert to MSIX using MSIX Packaging Tool

1. Install **MSIX Packaging Tool** from Microsoft Store (free)
2. Open it → "Application package" → "Create your package on this computer"
3. Select the NSIS installer as the source
4. Set:
   - Publisher: Your Partner Center publisher name
   - Package name: `LuminaDeck.Companion`
   - Version: `0.1.0.0`
5. Run through the installer wizard
6. Review and create the MSIX package

### Step 3: Submit to Partner Center

1. Go to Partner Center → Your app → Packages
2. Upload the `.msix` file
3. Fill in the Store listing:
   - Description, screenshots, category (Utilities & tools)
   - Age rating: Everyone
   - Privacy policy URL: https://luminadeck.app/privacy
4. Submit for certification

## Alternative: Direct MSIX Build (Advanced)

For CI/CD, you can build MSIX directly using `makemsix`:

```bash
# Install Windows SDK (includes makemsix.exe)
# Create AppxManifest.xml (template below)
# Package the release binary

MakeAppx.exe pack /d release-dir /p LuminaDeckCompanion.msix
```

### AppxManifest.xml Template

```xml
<?xml version="1.0" encoding="utf-8"?>
<Package xmlns="http://schemas.microsoft.com/appx/manifest/foundation/windows10"
         xmlns:uap="http://schemas.microsoft.com/appx/manifest/uap/windows10"
         xmlns:rescap="http://schemas.microsoft.com/appx/manifest/foundation/windows10/restrictedcapabilities">
  <Identity Name="LuminaDeck.Companion"
            Publisher="CN=PLACEHOLDER_PUBLISHER"
            Version="0.1.0.0"
            ProcessorArchitecture="x64" />
  <Properties>
    <DisplayName>LuminaDeck Companion</DisplayName>
    <PublisherDisplayName>LuminaDeck</PublisherDisplayName>
    <Logo>icons\icon.png</Logo>
  </Properties>
  <Dependencies>
    <TargetDeviceFamily Name="Windows.Desktop" MinVersion="10.0.19041.0" MaxVersionTested="10.0.22621.0" />
  </Dependencies>
  <Resources>
    <Resource Language="en-us" />
  </Resources>
  <Applications>
    <Application Id="LuminaDeckCompanion" Executable="luminadeck-companion.exe" EntryPoint="Windows.FullTrustApplication">
      <uap:VisualElements DisplayName="LuminaDeck Companion"
                          Description="Control your PC from your iPhone"
                          BackgroundColor="#0D0D0D"
                          Square150x150Logo="icons\128x128.png"
                          Square44x44Logo="icons\32x32.png" />
    </Application>
  </Applications>
  <Capabilities>
    <rescap:Capability Name="runFullTrust" />
    <Capability Name="privateNetworkClientServer" />
  </Capabilities>
</Package>
```

## Store Listing Content

**Title**: LuminaDeck Companion

**Short description**: Turn your iPhone into a customizable macro deck for your PC

**Description**:
LuminaDeck Companion receives commands from the LuminaDeck iPhone app and executes them on your Windows PC. Control keyboard shortcuts, launch apps, manage volume, and trigger system actions — all from your phone over secure local WiFi.

Features:
- Secure TLS 1.3 encrypted local connection
- QR code pairing for instant setup
- Supports keyboard shortcuts, app launching, and system actions
- System tray integration
- Up to 5 paired devices

Requires the free LuminaDeck app on iPhone (available on the App Store).

**Category**: Utilities & tools
**Age rating**: Everyone
**Privacy policy**: https://luminadeck.app/privacy
**Website**: https://luminadeck.app

## Capabilities Required

- `runFullTrust` — Needed for SendInput API access and system tray
- `privateNetworkClientServer` — Needed for WebSocket server on local network

## Timeline

- Account setup: 1 day
- MSIX packaging: 1 day
- Store submission: 1 day
- Microsoft certification: 3-5 business days (typically)
- Total: ~1 week from submission to live
