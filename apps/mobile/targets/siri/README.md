# LuminaDeck Siri Vocal Shortcuts (Phase B2)

No separate Xcode target — Siri intents live inside the main app (and the
widget extension imports the same `CompanionEndpoint` helper). The Ruby
patch script `scripts/ios-apply-native-targets.rb` copies this
`VoiceShortcutIntent.swift` into both:

- `ios/LuminaDeck/VoiceShortcutIntent.swift` (main app target)
- `ios/LuminaDeckWidget/VoiceShortcutIntent.swift` (widget target)

and adds it to each target's source build phase. Builds cleanly today.

## Still TODO

1. Build a small Expo native module that presents
   `INUIAddVoiceShortcutViewController` when the user taps "Add voice
   phrase" in the mobile tile editor. The existing `ExecuteVocalShortcutIntent`
   struct is ready — only the donation UI is missing.
2. Test by speaking "Hey Siri, <phrase>" once donated — iOS invokes
   `ExecuteVocalShortcutIntent.perform()` which hits
   `http://<companion>:9878/intent-execute`.

## Collision handling

iOS warns the user in the add-phrase sheet when a phrase shadows a
system command (e.g. "Play music"). We don't need to enumerate system
phrases; the OS handles this. If the user insists on a collision-prone
phrase, the sheet still allows it — our job is just to present a clean
"Add voice phrase" entry point.

## No OAuth + no SDK

Unlike `SiriKit` apps pre-iOS 16, AppIntent-based shortcuts don't need
Apple entitlements beyond the main app bundle capabilities. The donation
is purely client-side.
