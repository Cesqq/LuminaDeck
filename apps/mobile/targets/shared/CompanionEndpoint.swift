// CompanionEndpoint.swift
//
// Shared HMAC-signed HTTP client used by both the widget's AppIntent and
// the main app's Siri vocal-shortcut intent. Placed here so the iOS main
// app target and the WidgetKit extension can both include it without
// duplicating code — the Ruby patch script adds this file to both
// targets' source build phases.
//
// Canonical payload format matches
// `apps/companion/src-tauri/src/intent_endpoint.rs` exactly:
//   signature = hex(HMAC-SHA256(pair_key, "<timestamp_ms>." + body))

import Foundation
import CryptoKit

struct CompanionEndpoint {
    let host: String
    let port: Int
    let pairKey: Data
    let deviceId: String

    static let keychainService = "com.luminadeck.pairing"
    static let pairKeyAccount = "pairKey"
    static let hostAccount = "companionHost"
    static let portAccount = "companionPort"
    static let deviceIdAccount = "deviceId"

    static func fromKeychain() -> CompanionEndpoint? {
        guard let pairKey = Keychain.data(account: pairKeyAccount),
              let host = Keychain.string(account: hostAccount),
              let portString = Keychain.string(account: portAccount),
              let port = Int(portString),
              let deviceId = Keychain.string(account: deviceIdAccount)
        else { return nil }
        return CompanionEndpoint(host: host, port: port, pairKey: pairKey, deviceId: deviceId)
    }

    func postIntent(body: Data) async throws {
        let ts = UInt64(Date().timeIntervalSince1970 * 1000)
        let sig = hmacHex(key: pairKey, timestamp: ts, body: body)
        var req = URLRequest(url: URL(string: "http://\(host):\(port)/intent-execute")!)
        req.httpMethod = "POST"
        req.httpBody = body
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.setValue(String(ts), forHTTPHeaderField: "X-LuminaDeck-Timestamp")
        req.setValue(sig, forHTTPHeaderField: "X-LuminaDeck-Signature")
        req.timeoutInterval = 5
        _ = try await URLSession.shared.data(for: req)
    }

    private func hmacHex(key: Data, timestamp: UInt64, body: Data) -> String {
        var canonical = Data("\(timestamp).".utf8)
        canonical.append(body)
        let mac = HMAC<SHA256>.authenticationCode(for: canonical, using: SymmetricKey(data: key))
        return mac.map { String(format: "%02x", $0) }.joined()
    }
}

enum Keychain {
    static func data(account: String) -> Data? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: CompanionEndpoint.keychainService,
            kSecAttrAccount as String: account,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne,
        ]
        var out: AnyObject?
        let status = SecItemCopyMatching(query as CFDictionary, &out)
        guard status == errSecSuccess, let data = out as? Data else { return nil }
        return data
    }

    static func string(account: String) -> String? {
        data(account: account).flatMap { String(data: $0, encoding: .utf8) }
    }
}
