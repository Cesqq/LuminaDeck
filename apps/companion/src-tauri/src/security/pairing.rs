use serde::{Deserialize, Serialize};

/// QR code payload for device pairing.
/// Phone scans this to get companion IP, port, and cert fingerprint.
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct QrPairingPayload {
    pub ip: String,
    pub port: u16,
    pub cert_fingerprint: String,
    pub companion_name: String,
    pub version: String,
}

impl QrPairingPayload {
    pub fn new(ip: String, port: u16, cert_fingerprint: String) -> Self {
        let companion_name = hostname::get()
            .map(|h| h.to_string_lossy().to_string())
            .unwrap_or_else(|_| "LuminaDeck PC".to_string());

        Self {
            ip,
            port,
            cert_fingerprint,
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
}

/// Maximum paired devices per companion instance.
pub const MAX_PAIRED_DEVICES: usize = 5;
