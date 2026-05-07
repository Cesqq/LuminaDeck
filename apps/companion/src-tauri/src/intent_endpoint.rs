//! Authentication + dispatch primitives for the B1 iOS-Widget
//! `/intent-execute` path. See the v2 plan section B1 for the full
//! requirement — the short version:
//!
//! Widgets and Control Center tiles can't hold open a WebSocket, so they
//! need an HTTP-shaped fall-back that companion can authenticate without a
//! live handshake. We use HMAC-SHA256 with a per-pairing pre-shared key,
//! plus a ±30-second timestamp window to block replay. The key lives in
//! the OS keyring (Windows Credential Manager / macOS Keychain) — the same
//! place OBS passwords land, so a keyring compromise is already game over
//! and we don't create a new secret-storage surface.
//!
//! This module contains the *auth + dispatch contract* (key mgmt, verify,
//! IntentError shape). The actual HTTP listener that consumes it ships in
//! a follow-up PR — deferred here so we don't lock the codebase into a
//! specific HTTP crate (hyper vs tiny_http vs axum) before we've agreed on
//! one. Keep this file self-contained and unit-testable against the auth
//! logic alone; layering a listener on top is a ~80-line addition.

use hmac::{Hmac, Mac};
use sha2::Sha256;
use subtle::ConstantTimeEq;

type HmacSha256 = Hmac<Sha256>;

const KEYRING_SERVICE: &str = "luminadeck.pair_key";
const TIMESTAMP_TOLERANCE_MS: i128 = 30_000;

#[derive(Debug)]
pub enum IntentError {
    /// Wall-clock drift between client and companion exceeds ±30s. Also
    /// covers replays (attacker resends a captured old signature).
    TimestampOutOfRange,
    /// `X-LuminaDeck-Signature` is not valid hex or the wrong length.
    MalformedSignature,
    /// HMAC comparison failed (different key, forged body, or tampered
    /// timestamp). Deliberately does NOT reveal which.
    SignatureMismatch,
    /// Keyring access failed — typically a first-run permission prompt
    /// being denied, or the keyring daemon not running on Linux builds.
    KeyringUnavailable(String),
}

impl std::fmt::Display for IntentError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            IntentError::TimestampOutOfRange => write!(f, "timestamp out of range"),
            IntentError::MalformedSignature => write!(f, "malformed signature"),
            IntentError::SignatureMismatch => write!(f, "signature mismatch"),
            IntentError::KeyringUnavailable(e) => write!(f, "keyring unavailable: {e}"),
        }
    }
}

impl std::error::Error for IntentError {}

/// Canonical string the client signs. Structure is
/// `<timestamp_ms>.<raw_request_body>`; the delimiter prevents an attacker
/// from shifting bytes between fields.
fn canonical_payload(timestamp_ms: u64, body: &[u8]) -> Vec<u8> {
    let prefix = format!("{timestamp_ms}.");
    let mut out = Vec::with_capacity(prefix.len() + body.len());
    out.extend_from_slice(prefix.as_bytes());
    out.extend_from_slice(body);
    out
}

/// Fetch the pair-key for a given device id, creating and persisting one
/// if none exists yet. The key is 32 bytes of uuid-v4-derived entropy
/// (CSPRNG-backed).
///
/// Keyring errors on Linux (no dbus / no gnome-keyring) surface as
/// `KeyringUnavailable` — the HTTP endpoint should fall back to 503 with a
/// user-visible tray notification rather than executing unauthenticated.
#[allow(dead_code)]
pub fn get_or_create_pair_key(device_id: &str) -> Result<Vec<u8>, IntentError> {
    let entry = keyring::Entry::new(KEYRING_SERVICE, device_id)
        .map_err(|e| IntentError::KeyringUnavailable(e.to_string()))?;

    match entry.get_password() {
        Ok(hex_str) => hex::decode(hex_str.trim())
            .map_err(|e| IntentError::KeyringUnavailable(format!("corrupt stored key: {e}"))),
        Err(keyring::Error::NoEntry) => {
            let fresh = random_key_32();
            let encoded = hex::encode(&fresh);
            entry
                .set_password(&encoded)
                .map_err(|e| IntentError::KeyringUnavailable(e.to_string()))?;
            Ok(fresh)
        }
        Err(e) => Err(IntentError::KeyringUnavailable(e.to_string())),
    }
}

/// Overwrite the stored pair-key. Called when the user revokes a paired
/// device or re-pairs from scratch — forces all issued signatures to
/// become invalid.
#[allow(dead_code)]
pub fn regenerate_pair_key(device_id: &str) -> Result<Vec<u8>, IntentError> {
    let entry = keyring::Entry::new(KEYRING_SERVICE, device_id)
        .map_err(|e| IntentError::KeyringUnavailable(e.to_string()))?;
    let fresh = random_key_32();
    entry
        .set_password(&hex::encode(&fresh))
        .map_err(|e| IntentError::KeyringUnavailable(e.to_string()))?;
    Ok(fresh)
}

/// 256-bit key from two concatenated v4 UUIDs. Good enough for a
/// symmetric HMAC secret — the `uuid` crate uses `rand` under the hood.
#[allow(dead_code)]
fn random_key_32() -> Vec<u8> {
    let a = uuid::Uuid::new_v4().as_bytes().to_vec();
    let b = uuid::Uuid::new_v4().as_bytes().to_vec();
    let mut out = Vec::with_capacity(32);
    out.extend_from_slice(&a);
    out.extend_from_slice(&b);
    out
}

/// Compute the signature an authenticated client would send.
///
/// Exposed publicly because the Rust companion needs this in two places:
/// (a) unit tests (so the test can generate a valid signature without
/// duplicating the HMAC logic), and (b) a future pairing-QR flow that
/// includes a server-signed freshness proof. Callers who just want to
/// verify should use `verify_request` instead.
#[allow(dead_code)]
pub fn sign_request(pair_key: &[u8], timestamp_ms: u64, body: &[u8]) -> String {
    let mut mac = HmacSha256::new_from_slice(pair_key).expect("hmac accepts any key length");
    mac.update(&canonical_payload(timestamp_ms, body));
    hex::encode(mac.finalize().into_bytes())
}

/// Verify a request. Returns `Ok(())` when the signature matches the
/// canonical payload AND the timestamp is within ±30 s of `now_ms`.
///
/// `signature_hex` is the client-supplied `X-LuminaDeck-Signature` header
/// value. Constant-time compare via `subtle::ConstantTimeEq` blocks timing
/// oracles on the outer boundary.
#[allow(dead_code)]
pub fn verify_request(
    pair_key: &[u8],
    timestamp_ms: u64,
    body: &[u8],
    signature_hex: &str,
    now_ms: u64,
) -> Result<(), IntentError> {
    // Timestamp window first — cheaper than HMAC, and an attacker can't
    // force a stale signature past this gate even with a valid key.
    let diff = (now_ms as i128) - (timestamp_ms as i128);
    if diff.abs() > TIMESTAMP_TOLERANCE_MS {
        return Err(IntentError::TimestampOutOfRange);
    }

    let supplied = hex::decode(signature_hex.trim()).map_err(|_| IntentError::MalformedSignature)?;
    if supplied.len() != 32 {
        return Err(IntentError::MalformedSignature);
    }

    let expected = {
        let mut mac = HmacSha256::new_from_slice(pair_key).expect("hmac accepts any key length");
        mac.update(&canonical_payload(timestamp_ms, body));
        mac.finalize().into_bytes()
    };

    if expected.ct_eq(&supplied).unwrap_u8() == 1 {
        Ok(())
    } else {
        Err(IntentError::SignatureMismatch)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const KEY: &[u8; 32] = b"0123456789abcdef0123456789abcdef";

    #[test]
    fn sign_and_verify_roundtrip() {
        let body = br#"{"buttonId":"abc","action":{"type":"system_action","action":"volume_up"}}"#;
        let ts: u64 = 1_700_000_000_000;
        let sig = sign_request(KEY, ts, body);
        assert!(verify_request(KEY, ts, body, &sig, ts).is_ok());
    }

    #[test]
    fn rejects_wrong_key() {
        let body = b"payload";
        let ts: u64 = 1_700_000_000_000;
        let sig = sign_request(KEY, ts, body);
        let other_key = b"XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX";
        assert!(matches!(
            verify_request(other_key, ts, body, &sig, ts),
            Err(IntentError::SignatureMismatch)
        ));
    }

    #[test]
    fn rejects_tampered_body() {
        let body = b"payload";
        let ts: u64 = 1_700_000_000_000;
        let sig = sign_request(KEY, ts, body);
        let tampered = b"different payload";
        assert!(matches!(
            verify_request(KEY, ts, tampered, &sig, ts),
            Err(IntentError::SignatureMismatch)
        ));
    }

    #[test]
    fn rejects_tampered_timestamp() {
        let body = b"payload";
        let ts: u64 = 1_700_000_000_000;
        let sig = sign_request(KEY, ts, body);
        let tampered_ts = ts + 1;
        // Within tolerance so the timestamp gate lets it through, but the
        // HMAC will fail because the client baked `ts` into the signature.
        assert!(matches!(
            verify_request(KEY, tampered_ts, body, &sig, tampered_ts),
            Err(IntentError::SignatureMismatch)
        ));
    }

    #[test]
    fn rejects_stale_timestamp() {
        let body = b"payload";
        let ts: u64 = 1_700_000_000_000;
        let sig = sign_request(KEY, ts, body);
        // 45 s in the future: well outside the ±30 s window.
        assert!(matches!(
            verify_request(KEY, ts, body, &sig, ts + 45_000),
            Err(IntentError::TimestampOutOfRange)
        ));
    }

    #[test]
    fn rejects_future_timestamp() {
        let body = b"payload";
        let ts: u64 = 1_700_000_000_000;
        let sig = sign_request(KEY, ts, body);
        assert!(matches!(
            verify_request(KEY, ts, body, &sig, ts - 45_000),
            Err(IntentError::TimestampOutOfRange)
        ));
    }

    #[test]
    fn rejects_malformed_signature() {
        let body = b"payload";
        let ts: u64 = 1_700_000_000_000;
        assert!(matches!(
            verify_request(KEY, ts, body, "not-hex!!!", ts),
            Err(IntentError::MalformedSignature)
        ));
        assert!(matches!(
            verify_request(KEY, ts, body, "deadbeef", ts),
            Err(IntentError::MalformedSignature)
        ));
    }
}
