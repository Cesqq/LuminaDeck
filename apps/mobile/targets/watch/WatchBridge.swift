// WatchBridge.swift
//
// WCSession glue for the LuminaDeck Watch app (Phase B3).
//
// iPhone → Watch: the main app writes the "watchTiles.v1" user info on
// profile save, Watch receives via `didReceiveUserInfo` and replaces its
// local cache.
//
// Watch → iPhone: on tile tap, the Watch sends a `{ buttonId }` message;
// the iPhone relays to companion via the /intent-execute HMAC path.

import Foundation
import WatchConnectivity

final class WatchTileStore: NSObject, ObservableObject, WCSessionDelegate {
    @Published var tiles: [WatchTile] = []

    override init() {
        super.init()
        if WCSession.isSupported() {
            WCSession.default.delegate = self
            WCSession.default.activate()
        }
        load()
    }

    // MARK: - Persistence (watch side)

    private let cacheKey = "luminadeck.watchTiles.v1"

    private func load() {
        guard let data = UserDefaults.standard.data(forKey: cacheKey) else { return }
        if let decoded = try? JSONDecoder().decode([WatchTile].self, from: data) {
            tiles = decoded
        }
    }

    private func save() {
        if let data = try? JSONEncoder().encode(tiles) {
            UserDefaults.standard.set(data, forKey: cacheKey)
        }
    }

    // MARK: - Fire-press back to iPhone

    func firePress(buttonId: String) {
        guard WCSession.default.isReachable else {
            // Fallback: transferUserInfo queues when iPhone is unreachable.
            WCSession.default.transferUserInfo(["tap": buttonId])
            return
        }
        WCSession.default.sendMessage(["tap": buttonId], replyHandler: nil) { _ in
            WCSession.default.transferUserInfo(["tap": buttonId])
        }
    }

    // MARK: - Trackpad surface

    /// Send a relative mouse-move delta. Phone forwards as `mouse_move`.
    /// Drops if Watch can't reach phone — trackpad input is high-frequency
    /// and the queued-userInfo path would batch into a worthless burst on
    /// reconnect, so we just lose the frame.
    func fireMouseMove(dx: Int, dy: Int) {
        guard WCSession.default.isReachable else { return }
        WCSession.default.sendMessage(["mouseMove": ["dx": dx, "dy": dy]], replyHandler: nil) { _ in
            // ignore — the next move will replace this one
        }
    }

    /// Send a single mouse-button click event.
    func fireMouseClick(button: MouseButton) {
        guard WCSession.default.isReachable else {
            WCSession.default.transferUserInfo(["mouseClick": button.rawValue])
            return
        }
        WCSession.default.sendMessage(["mouseClick": button.rawValue], replyHandler: nil) { _ in
            WCSession.default.transferUserInfo(["mouseClick": button.rawValue])
        }
    }

    /// Send a scroll-wheel event. Positive ticks scroll up, negative scroll down.
    func fireScroll(ticks: Int) {
        guard WCSession.default.isReachable else { return }
        WCSession.default.sendMessage(["scroll": ticks], replyHandler: nil) { _ in
            // drop; high-frequency
        }
    }

    // MARK: - Text input (Scribble / keyboard / dictation)

    /// Send a UTF-8 string for the companion to inject as keystrokes via
    /// SendInput. Falls back to queued userInfo when iPhone is unreachable
    /// because text input is rare + the user clearly wants it delivered.
    func fireTextInput(text: String) {
        guard !text.isEmpty else { return }
        guard WCSession.default.isReachable else {
            WCSession.default.transferUserInfo(["textInput": text])
            return
        }
        WCSession.default.sendMessage(["textInput": text], replyHandler: nil) { _ in
            WCSession.default.transferUserInfo(["textInput": text])
        }
    }

    // MARK: - WCSessionDelegate

    func session(_ session: WCSession, activationDidCompleteWith state: WCSessionActivationState, error: Error?) {}

    func session(_ session: WCSession, didReceiveUserInfo userInfo: [String : Any] = [:]) {
        guard let tilesArray = userInfo["watchTiles"] as? [[String: Any]] else { return }
        let data = (try? JSONSerialization.data(withJSONObject: tilesArray)) ?? Data()
        if let decoded = try? JSONDecoder().decode([WatchTile].self, from: data) {
            DispatchQueue.main.async {
                self.tiles = decoded
                self.save()
            }
        }
    }
}
