// WatchSessionBridge.swift
//
// iPhone-side WCSession delegate that receives messages from the Apple
// Watch (button taps, trackpad mouse events, Scribble text) and re-emits
// them to the React Native runtime via `RCTEventEmitter`. The TS side
// (`apps/mobile/src/lib/watchBridge.ts → subscribeWatchTaps` and the new
// trackpad/text helpers) listens via `DeviceEventEmitter` and dispatches
// to the existing WS protocol.
//
// Why a single delegate, not three: WCSession is a singleton — only one
// `delegate` slot exists per process. We multiplex by message-key.
//
// Wiring: added to the MAIN APP target by
// `scripts/ios-apply-native-targets.rb` alongside `AppGroupBridge`.

import Foundation
import WatchConnectivity
import React

@objc(WatchSessionBridge)
final class WatchSessionBridge: RCTEventEmitter, WCSessionDelegate {

    private static var didActivate = false

    // Each event name appears in `supportedEvents` AND in the JS-side
    // listener subscriptions. Add here when you ship a new Watch feature.
    private static let eventTap = "luminadeck.watch.tap"
    private static let eventMouseMove = "luminadeck.watch.mouseMove"
    private static let eventMouseClick = "luminadeck.watch.mouseClick"
    private static let eventScroll = "luminadeck.watch.scroll"
    private static let eventTextInput = "luminadeck.watch.textInput"

    override init() {
        super.init()
        Self.activateIfPossible(delegate: self)
    }

    /// Idempotent activation. WCSession.activate() is safe to call once
    /// per process; doing it twice is a no-op but logs an Apple warning.
    private static func activateIfPossible(delegate: WCSessionDelegate) {
        guard WCSession.isSupported(), !didActivate else { return }
        didActivate = true
        WCSession.default.delegate = delegate
        WCSession.default.activate()
    }

    @objc override func supportedEvents() -> [String]! {
        return [
            Self.eventTap,
            Self.eventMouseMove,
            Self.eventMouseClick,
            Self.eventScroll,
            Self.eventTextInput,
        ]
    }

    @objc override static func requiresMainQueueSetup() -> Bool { false }

    /// Disable RN module thread requirement so emit happens off the JS
    /// thread without ping-pong.
    override var methodQueue: DispatchQueue {
        return DispatchQueue(label: "com.luminadeck.watch-bridge")
    }

    // MARK: - WCSessionDelegate

    func session(
        _ session: WCSession,
        activationDidCompleteWith activationState: WCSessionActivationState,
        error: Error?
    ) {
        if let error = error {
            NSLog("[WatchSessionBridge] activation error: \(error.localizedDescription)")
        }
    }

    func sessionDidBecomeInactive(_ session: WCSession) {}
    func sessionDidDeactivate(_ session: WCSession) {
        // Reactivate so the bridge keeps working after a watch swap.
        WCSession.default.activate()
    }

    /// Live messages — used for high-frequency / interactive payloads
    /// (taps, mouse moves, scroll). Delivered only when iPhone is awake
    /// and reachable.
    func session(_ session: WCSession, didReceiveMessage message: [String : Any]) {
        dispatch(message: message)
    }

    /// Queued userInfo — used for "must-deliver" payloads when iPhone
    /// is unreachable (e.g. button tap deferred until reconnect). The
    /// Watch falls back to this in `WatchTileStore.firePress` etc.
    func session(_ session: WCSession, didReceiveUserInfo userInfo: [String : Any] = [:]) {
        dispatch(message: userInfo)
    }

    private func dispatch(message: [String: Any]) {
        // Tap (existing v1.4 surface)
        if let buttonId = message["tap"] as? String {
            sendEvent(withName: Self.eventTap, body: ["buttonId": buttonId])
            return
        }

        // Trackpad: mouseMove = { dx, dy }
        if let move = message["mouseMove"] as? [String: Any] {
            sendEvent(withName: Self.eventMouseMove, body: move)
            return
        }
        if let button = message["mouseClick"] as? String {
            sendEvent(withName: Self.eventMouseClick, body: ["button": button])
            return
        }
        if let ticks = message["scroll"] as? Int {
            sendEvent(withName: Self.eventScroll, body: ["ticks": ticks])
            return
        }

        // Scribble / keyboard / dictation
        if let text = message["textInput"] as? String, !text.isEmpty {
            sendEvent(withName: Self.eventTextInput, body: ["text": text])
            return
        }

        NSLog("[WatchSessionBridge] unrecognised message keys: \(Array(message.keys))")
    }
}
