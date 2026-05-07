# LuminaDeck Widget Target (Phase B1)

iOS 26 Control Center + Lock Screen widget. Wired into the prebuilt Xcode
project by `scripts/ios-apply-native-targets.rb` — NO `expo-apple-targets`
or other community plugins involved. Runs after `expo prebuild` and before
`xcodebuild archive` as step `3b/6` of `scripts/ios-archive-and-upload.sh`.

## Status

**Builds cleanly on `xcodebuild -scheme LuminaDeck -destination generic/platform=iOS`** with widget embedded. Next step: archive + TestFlight + real-device validation.

## Files

- `LuminaDeckWidget.swift` — `ControlWidget` + `WidgetBundle`. Reads
  pinned-tile descriptors from the shared App Group `UserDefaults` key
  `luminadeck.pinnedTiles.v1`.
- `AppIntent.swift` — parameterised `AppIntent` that POSTs an HMAC-signed
  request to `http://<host>:9878/intent-execute`. Reads endpoint from
  `../shared/CompanionEndpoint.swift`.
- `Info.plist` — WidgetKit extension manifest.

## Shared code

`apps/mobile/targets/shared/CompanionEndpoint.swift` holds the HMAC POST
+ Keychain helper used by BOTH this widget AND the main app's Siri vocal
shortcut intent (see `../siri/`). The Ruby patch script copies it into
both `ios/LuminaDeckWidget/CompanionEndpoint.swift` and
`ios/LuminaDeck/CompanionEndpoint.swift` during wiring.

## Build pipeline

1. PC → Mac: `bash scripts/sync-to-mac.sh`
2. Mac: `bash scripts/ios-archive-and-upload.sh` runs automatically:
   - `expo prebuild --platform ios --clean`
   - `pod install`
   - pbxproj iPhone-Developer strip
   - **`ruby scripts/ios-apply-native-targets.rb`** ← adds widget + siri
   - `xcodebuild archive` + `xcodebuild -exportArchive destination=upload`

`xcodeproj` Ruby gem is a transitive CocoaPods dependency; the archive
script installs it via `gem install --user-install xcodeproj` if missing.

## App Group + Keychain sharing

- **App Group** `group.com.luminadeck.shared` — written to both main app
  and widget entitlements by the patch script.
- **Keychain access group** `$(AppIdentifierPrefix)com.luminadeck.app` —
  same. Lets the widget read the pair-key the main app wrote during pairing.

You still need to register the App Group in Apple Developer Portal once
per team:
1. https://developer.apple.com/account/resources/identifiers/
2. `+` → App Groups → register `group.com.luminadeck.shared`.
3. Attach it to both the main app identifier (`com.luminadeck.app`) and
   the widget identifier (`com.luminadeck.app.widget`).
Automatic signing picks up the change at next archive.

## Runtime contract with the RN side

`apps/mobile/src/lib/widgetSync.ts` serialises up to six pinned tiles as
`{ [slotId: string]: PinnedTile }` and writes to the App Group
UserDefaults. The native bridge that does the actual `UserDefaults`
write is a small Expo module we still need to build — for now the TS
side exports `writePinnedTiles()` as a no-op. Once that bridge lands the
widget starts rendering real tiles instead of the placeholder.

## Security (mirrors plan B1 + security judge)

- Pair-key + companion host/port in iOS Keychain under
  `kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly` (set from the main
  app during pairing; widget has read access after first unlock).
- HMAC-SHA256 signed requests with ±30 s timestamp window to block replay.
- No network traffic leaves the LAN — we talk directly to the companion
  over HTTP on port 9878, not through any relay.
