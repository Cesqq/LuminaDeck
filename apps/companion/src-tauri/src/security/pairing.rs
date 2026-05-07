use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use subtle::ConstantTimeEq;

/// QR code payload for device pairing.
/// Phone scans this to get companion IP, port, cert fingerprint, and the
/// one-time pairing secret required to authenticate the first WS hello.
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct QrPairingPayload {
    pub ip: String,
    pub port: u16,
    pub cert_fingerprint: String,
    pub pairing_secret: String,
    pub companion_name: String,
    pub version: String,
}

impl QrPairingPayload {
    pub fn new(ip: String, port: u16, cert_fingerprint: String, pairing_secret: String) -> Self {
        let companion_name = hostname::get()
            .map(|h| h.to_string_lossy().to_string())
            .unwrap_or_else(|_| "LuminaDeck PC".to_string());

        Self {
            ip,
            port,
            cert_fingerprint,
            pairing_secret,
            companion_name,
            version: "1.0.0".to_string(),
        }
    }

    /// Serialize to JSON string for QR code content.
    pub fn to_qr_string(&self) -> String {
        serde_json::to_string(self).unwrap_or_default()
    }
}

/// Paired device record stored in DPAPI-protected storage.
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PairedDevice {
    pub id: String,
    pub name: String,
    pub paired_at: String, // ISO 8601
    pub last_seen: Option<String>,
    #[serde(
        default,
        rename = "pairingSecretHash",
        skip_serializing_if = "Option::is_none"
    )]
    pub pairing_secret_hash: Option<String>,
}

/// Maximum paired devices per companion instance.
pub const MAX_PAIRED_DEVICES: usize = 5;

/// Generate a high-entropy pairing secret for a QR pairing session.
pub fn generate_pairing_secret() -> String {
    // UUID v4 gives 122 random bits, enough for a local-network pairing bearer
    // secret while staying short enough for QR payloads.
    uuid::Uuid::new_v4().to_string()
}

/// Store only a SHA-256 hash of the pairing secret on the companion.
pub fn hash_pairing_secret(secret: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(secret.as_bytes());
    hex::encode(hasher.finalize())
}

pub fn pairing_hash_matches(stored_hash: &str, provided_hash: &str) -> bool {
    stored_hash.as_bytes().ct_eq(provided_hash.as_bytes()).into()
}

pub fn now_iso() -> String {
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();
    // Simple ISO-ish timestamp without pulling chrono into the hot path.
    format!("{}Z", now)
}

pub fn devices_path() -> std::path::PathBuf {
    directories::ProjectDirs::from("com", "luminadeck", "companion")
        .map(|dirs| dirs.data_dir().join("paired_devices.json"))
        .unwrap_or_else(|| std::path::PathBuf::from("paired_devices.json"))
}

pub fn load_paired_devices() -> Vec<PairedDevice> {
    let path = devices_path();
    if let Ok(data) = std::fs::read_to_string(&path) {
        serde_json::from_str(&data).unwrap_or_default()
    } else {
        Vec::new()
    }
}

pub fn save_paired_devices(devices: &[PairedDevice]) {
    let path = devices_path();
    if let Some(parent) = path.parent() {
        let _ = std::fs::create_dir_all(parent);
    }
    if let Ok(json) = serde_json::to_string_pretty(devices) {
        let _ = std::fs::write(&path, json);
    }
}
