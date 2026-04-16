pub mod tls;
pub mod pairing;

use sha2::{Sha256, Digest};

/// Generate SHA-256 fingerprint of a DER-encoded certificate.
pub fn cert_fingerprint(der_bytes: &[u8]) -> String {
    let mut hasher = Sha256::new();
    hasher.update(der_bytes);
    let hash = hasher.finalize();
    hex::encode(hash)
}
