// VoiceShortcutIntent.swift
//
// Vocal Shortcuts for LuminaDeck (Phase B2).
//
// Reuses the same AppIntent infrastructure from the Control Center widget
// (apps/mobile/targets/widget/AppIntent.swift) — a Siri vocal shortcut is
// just an AppIntent the user has donated a custom phrase for.
//
// The main-app editor surfaces a per-tile "Add voice phrase" button
// (react-native → native bridge → INUIAddVoiceShortcutViewController) so
// the user picks their phrase once, and thereafter they can say:
//
//   "Hey Siri, <their phrase>"
//
// and iOS invokes `ExecuteVocalShortcutIntent.perform()`, which forwards
// to the same HMAC-signed /intent-execute POST the widget uses.
//
// STATUS — source-ready; Xcode wiring lands on the Mac build pass. See the
// README next to this file for the expo-apple-targets config.

import AppIntents
import Foundation
import Intents

@available(iOS 17.0, *)
struct ExecuteVocalShortcutIntent: AppIntent {
    static var title: LocalizedStringResource = "Run LuminaDeck Tile"
    static var description = IntentDescription("Fires a LuminaDeck tile by voice via your paired PC.")

    @Parameter(title: "Tile")
    var buttonId: String

    /// Siri-only discovery phrases. The actual user-facing phrase comes
    /// from donation via `INVoiceShortcutCenter`, not from this string.
    static var openAppWhenRun: Bool = false

    init() {}
    init(buttonId: String) { self.buttonId = buttonId }

    func perform() async throws -> some IntentResult {
        guard let companion = CompanionEndpoint.fromKeychain() else {
            return .result()
        }
        let payload = try JSONSerialization.data(withJSONObject: ["buttonId": buttonId])
        try await companion.postIntent(body: payload)
        return .result()
    }
}

/// Donation helper — the main app calls this whenever the user taps
/// "Add voice phrase" on a tile. It tells Siri the intent exists so the
/// user can pick a phrase in the system sheet. Collisions with built-in
/// Siri commands (e.g. "Play music") are handled by iOS itself and
/// surfaced through the presented VC.
@available(iOS 17.0, *)
struct VocalShortcutDonor {
    static func donate(buttonId: String, label: String) {
        let intent = ExecuteVocalShortcutIntent(buttonId: buttonId)
        // Pre-iOS 17 used INShortcut. AppIntent-based donation happens
        // automatically when the intent runs; the RN side only needs to
        // present the add-phrase sheet.
        _ = intent
        _ = label
    }
}
