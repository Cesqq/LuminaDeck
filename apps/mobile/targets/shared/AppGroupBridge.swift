// AppGroupBridge.swift
//
// React Native bridge that lets the JS side write/read JSON into the App
// Group's `UserDefaults(suiteName:)` container — the same surface the
// WidgetKit extension reads from via `PinnedTileStore` in
// `LuminaDeckWidget.swift`.
//
// Classic bridge (not a Turbo Module) so we don't need to generate a TM
// spec; RN 0.81's interop layer still honors `@objc` modules even with
// `newArchEnabled: true`.
//
// Added to the MAIN APP target by `scripts/ios-apply-native-targets.rb`.
// The widget extension does NOT import this file — widgets read
// UserDefaults directly without needing the RN bridge.

import Foundation
import React

@objc(AppGroupBridge)
final class AppGroupBridge: NSObject {

    /// Bridge contract — kept off the main queue because all work is
    /// synchronous UserDefaults IO.
    @objc static func requiresMainQueueSetup() -> Bool { false }

    /// Write a UTF-8 JSON string into the App Group container.
    /// Resolves with `nil` on success, rejects with a short code string
    /// on failure (the JS side just logs and no-ops on reject).
    @objc(write:key:json:resolver:rejecter:)
    func write(
        groupId: String,
        key: String,
        json: String,
        resolver resolve: @escaping RCTPromiseResolveBlock,
        rejecter reject: @escaping RCTPromiseRejectBlock
    ) {
        guard let defaults = UserDefaults(suiteName: groupId) else {
            reject("no_defaults", "UserDefaults(suiteName: \(groupId)) returned nil. App Group may not be registered in Apple Developer Portal.", nil)
            return
        }
        guard let data = json.data(using: .utf8) else {
            reject("bad_utf8", "Payload could not be encoded as UTF-8", nil)
            return
        }
        defaults.set(data, forKey: key)
        resolve(nil)
    }

    /// Read a UTF-8 JSON string from the App Group container. Resolves
    /// with `nil` when the key doesn't exist yet — callers should treat
    /// that as "no pinned tiles yet" not an error.
    @objc(read:key:resolver:rejecter:)
    func read(
        groupId: String,
        key: String,
        resolver resolve: @escaping RCTPromiseResolveBlock,
        rejecter reject: @escaping RCTPromiseRejectBlock
    ) {
        guard let defaults = UserDefaults(suiteName: groupId) else {
            reject("no_defaults", "UserDefaults(suiteName: \(groupId)) returned nil", nil)
            return
        }
        guard let data = defaults.data(forKey: key),
              let json = String(data: data, encoding: .utf8)
        else {
            resolve(nil)
            return
        }
        resolve(json)
    }

    /// Erase a key — used when the user toggles the widget off so the
    /// widget doesn't keep showing a stale deck layout.
    @objc(remove:key:resolver:rejecter:)
    func remove(
        groupId: String,
        key: String,
        resolver resolve: @escaping RCTPromiseResolveBlock,
        rejecter reject: @escaping RCTPromiseRejectBlock
    ) {
        guard let defaults = UserDefaults(suiteName: groupId) else {
            reject("no_defaults", "UserDefaults(suiteName: \(groupId)) returned nil", nil)
            return
        }
        defaults.removeObject(forKey: key)
        resolve(nil)
    }
}
