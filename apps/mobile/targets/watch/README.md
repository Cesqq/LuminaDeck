# LuminaDeck Watch Target (Phase B3)

watchOS companion source. NOT wired into the default archive pipeline —
`xcodeproj` 1.27 throws inside `add_dependency` when an iOS app target
gains a cross-platform watchOS dependency from a freshly-created target
in the same run. Widget + Siri don't hit this quirk and ship via the
default pipeline.

Opt in with:
```sh
ENABLE_WATCH=1 ruby scripts/ios-apply-native-targets.rb
```
…but expect to iterate on the watch side before archive works cleanly.
For most shipping purposes just leave it off; the Swift source is valid
and will build once the wiring is finished.

## Files

- `ContentView.swift` — SwiftUI 2-column grid, 6 slots, haptic click on
  tap.
- `WatchBridge.swift` — `WCSession` delegate. Receives the 6 tiles from
  iPhone via `transferUserInfo(watchTiles: [...])`, sends taps back via
  `sendMessage(tap: buttonId)` with a `transferUserInfo` fallback.

## Wiring checklist

1. Register a watchOS target via `expo-apple-targets` (`target.yml`
   points to this directory).
2. Xcode Signing & Capabilities:
   - Enable WatchConnectivity on both main app + Watch target.
3. Add an empty "Watch" mini-page to the mobile editor where the user
   picks the six tiles that sync to the Watch; drop the rest.
4. RN side (`apps/mobile/src/lib/watchBridge.ts`): build the 6-tile
   payload and call the native `pushWatchTiles()` bridge (ships as a
   small Expo module in the same PR).

## Auto-seeding

First launch of the Watch mini-page, seed with the user's six most-pressed
tiles (we have telemetry for this; the B6 predictor `predictButtons(6)`
call works as the seed when the user opts into both features).

## Battery note

The Watch never talks to the companion directly. All executes round-trip
through iPhone. That keeps the Watch battery drain minimal and makes the
Watch usable when the iPhone is paired but out of LAN range.
