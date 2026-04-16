//! Session token management for authenticated connections.
//!
//! Uses TOTP-based tokens rotated every 30 minutes.
//! Tokens are generated from a shared secret established during QR pairing.

use base64::Engine;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use parking_lot::Mutex;
use totp_rs::{Algorithm, Secret, TOTP};

const TOKEN_PERIOD_SECS: u64 = 1800; // 30 minutes
const TOKEN_DIGITS: usize = 8;
const TOKEN_SKEW: u8 = 1; // Allow 1 period of clock skew

/// Session manager that validates TOTP tokens from paired devices.
pub struct SessionManager {
    /// Map of device_id → shared secret (base32-encoded)
    secrets: Mutex<HashMap<String, String>>,
}

impl SessionManager {
    pub fn new() -> Self {
        Self {
            secrets: Mutex::new(HashMap::new()),
        }
    }

    /// Generate a new shared secret for a device during pairing.
    /// Returns the base32-encoded secret (to be shared via QR code or pairing handshake).
    pub fn create_session(&self, device_id: &str) -> String {
        let secret = Secret::generate_secret();
        let encoded = secret.to_encoded().to_string();
        self.secrets.lock().insert(device_id.to_string(), encoded.clone());
        encoded
    }

    /// Validate a TOTP token from a device.
    /// Returns true if the token is valid for the current or adjacent time window.
    pub fn validate_token(&self, device_id: &str, token: &str) -> bool {
        let secrets = self.secrets.lock();
        let secret = match secrets.get(device_id) {
            Some(s) => s.clone(),
            None => return false,
        };
        drop(secrets);

        match build_totp(&secret) {
            Ok(totp) => totp.check_current(token).unwrap_or(false),
            Err(e) => {
                log::warn!("TOTP validation error for {}: {}", device_id, e);
                false
            }
        }
    }

    /// Generate the current valid token for a device (used for testing).
    pub fn generate_token(&self, device_id: &str) -> Option<String> {
        let secrets = self.secrets.lock();
        let secret = secrets.get(device_id)?.clone();
        drop(secrets);

        let totp = build_totp(&secret).ok()?;
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs();
        totp.generate(now).into()
    }

    /// Revoke a device's session (on unpair).
    pub fn revoke_session(&self, device_id: &str) {
        self.secrets.lock().remove(device_id);
    }

    /// Check if a device has an active session.
    pub fn has_session(&self, device_id: &str) -> bool {
        self.secrets.lock().contains_key(device_id)
    }

    /// Get the number of active sessions.
    pub fn active_sessions(&self) -> usize {
        self.secrets.lock().len()
    }
}

fn build_totp(secret_b32: &str) -> Result<TOTP, String> {
    TOTP::new(
        Algorithm::SHA256,
        TOKEN_DIGITS,
        TOKEN_SKEW,
        TOKEN_PERIOD_SECS as u64,
        Secret::Encoded(secret_b32.to_string())
            .to_bytes()
            .map_err(|e| format!("Secret decode error: {}", e))?,
    )
    .map_err(|e| format!("TOTP build error: {}", e))
}

/// Payload included in QR code for establishing shared TOTP secret.
#[derive(Debug, Serialize, Deserialize)]
pub struct SessionSetupPayload {
    pub device_id: String,
    pub totp_secret: String, // Base32-encoded
    pub period_secs: u64,
}

impl SessionSetupPayload {
    pub fn new(device_id: String, totp_secret: String) -> Self {
        Self {
            device_id,
            totp_secret,
            period_secs: TOKEN_PERIOD_SECS,
        }
    }
}
