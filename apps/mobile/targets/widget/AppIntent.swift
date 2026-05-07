// AppIntent.swift
//
// Parameterised intent fired by the Control Center / Lock Screen widget.
// Responsible for POSTing an authenticated `/intent-execute` request to
// the companion, using the HMAC scheme defined in
// `apps/companion/src-tauri/src/intent_endpoint.rs`.
//
// Two security notes:
//
//   1. The pair-key lives in the iOS Keychain under
//      `kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly` so a locked,
//      unfiled device can't have the key exfiltrated via jailbreak. The
//      widget still reads it (after first unlock is enough for WidgetKit).
//
//   2. The HMAC envelope is `<timestamp_ms>.<raw_body>` — same canonical
//      form the Rust side signs. `PairingStore.signRequest` duplicates the
//      logic there so a Rust change must update this file in lock-step.

import AppIntents
import Foundation
import CryptoKit

@available(iOS 18.0, *)
struct PinnedTileConfiguration: ControlConfigurationIntent {
    static var title: LocalizedStringResource = "Pick LuminaDeck Tile"

    @Parameter(title: "Tile slot")
    var tileSlot: String

    // Configuration intents don't execute an action, but the protocol
    // requires `perform()` to be available in app extensions — the default
    // stub from `ControlConfigurationIntent` isn't annotated, so we
    // override explicitly to silence the compiler.
    func perform() async throws -> some IntentResult {
        .result()
    }
}

@available(iOS 17.0, *)
struct ExecutePinnedTileIntent: AppIntent {
    static var title: LocalizedStringResource = "Execute LuminaDeck Tile"
    static var description = IntentDescription("Fires a LuminaDeck tile via your paired PC companion.")

    /// Static id of the button the user pinned. Resolves to the full
    /// `Action` JSON via `PinnedTileStore` on the companion side — we
    /// forward the id + a verifier timestamp only, so replay windows are
    /// short.
    @Parameter(title: "Button id")
    var buttonId: String

    init() {}
    init(buttonId: String) { self.buttonId = buttonId }

    func perform() async throws -> some IntentResult {
        guard let companion = CompanionEndpoint.fromKeychain() else {
            // No pairing yet — silently no-op so the user gets no scary
            // error from a Lock Screen tap before their first hello.
            return .result()
        }

        // Look up the pinned tile so we can include its full action JSON
        // in the body. The companion is stateless on this path and just
        // dispatches whatever action it verifies.
        let tile = lookupTile(buttonId: buttonId)
        let actionObject: Any
        if let json = tile?.actionJSON,
           let data = json.data(using: .utf8),
           let parsed = try? JSONSerialization.jsonObject(with: data) {
            actionObject = parsed
        } else {
            // Fallback — issue a no-op multi_action so the companion's
            // dispatcher has a valid shape to consume. Better than 4xx
            // because the user has feedback that the tap registered.
            actionObject = ["type": "multi_action", "actions": [] as [Any]]
        }

        let body: [String: Any] = [
            "deviceId": companion.deviceId,
            "buttonId": buttonId,
            "action": actionObject,
        ]
        let payload = try JSONSerialization.data(withJSONObject: body, options: [.sortedKeys])
        try await companion.postIntent(body: payload)
        return .result()
    }

    /// Search the App Group store for a tile whose buttonId matches.
    /// Slot ordering is irrelevant on the read side — we just want the
    /// action mapped to this button id, regardless of which slot the
    /// user pinned it into.
    private func lookupTile(buttonId: String) -> PinnedTile? {
        for slot in (0..<6).map({ "slot-\($0)" }) {
            if let t = PinnedTileStore.shared.tile(for: slot), t.buttonId == buttonId {
                return t
            }
        }
        return nil
    }
}

// `CompanionEndpoint` + `Keychain` live in
// apps/mobile/targets/shared/CompanionEndpoint.swift and are added to both
// the widget target AND the main app target by the Ruby patch script.
