use rcgen::{CertificateParams, KeyPair};
use std::path::PathBuf;
use thiserror::Error;

#[derive(Debug, Error)]
pub enum TlsError {
    #[error("Certificate generation failed: {0}")]
    GenerationFailed(String),

    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),

    #[error("Rustls error: {0}")]
    Rustls(String),
}

/// Paths for stored TLS certificate and key.
pub struct TlsPaths {
    pub cert_path: PathBuf,
    pub key_path: PathBuf,
}

/// Get the data directory for LuminaDeck companion.
fn data_dir() -> PathBuf {
    directories::ProjectDirs::from("com", "luminadeck", "companion")
        .map(|dirs| dirs.data_dir().to_path_buf())
        .unwrap_or_else(|| PathBuf::from("."))
}

/// Get paths for cert and key files.
pub fn tls_paths() -> TlsPaths {
    let dir = data_dir().join("tls");
    TlsPaths {
        cert_path: dir.join("cert.pem"),
        key_path: dir.join("key.pem"),
    }
}

/// Generate a self-signed TLS certificate for the companion.
/// Returns (cert_pem, key_pem, cert_der_bytes).
pub fn generate_self_signed_cert() -> Result<(String, String, Vec<u8>), TlsError> {
    let mut params = CertificateParams::new(vec!["luminadeck-companion".to_string()])
        .map_err(|e| TlsError::GenerationFailed(e.to_string()))?;

    // Add SANs for local network IPs
    params.subject_alt_names.push(
        rcgen::SanType::IpAddress(std::net::IpAddr::V4(std::net::Ipv4Addr::LOCALHOST)),
    );

    let key_pair = KeyPair::generate()
        .map_err(|e| TlsError::GenerationFailed(e.to_string()))?;

    let cert = params.self_signed(&key_pair)
        .map_err(|e| TlsError::GenerationFailed(e.to_string()))?;

    let cert_pem = cert.pem();
    let key_pem = key_pair.serialize_pem();
    let cert_der = cert.der().to_vec();

    Ok((cert_pem, key_pem, cert_der))
}

/// Ensure TLS certificate exists. Generate if missing.
/// Returns the DER bytes of the certificate for fingerprinting.
pub fn ensure_tls_cert() -> Result<Vec<u8>, TlsError> {
    let paths = tls_paths();

    if paths.cert_path.exists() && paths.key_path.exists() {
        // Load existing cert DER for fingerprint
        let cert_pem = std::fs::read_to_string(&paths.cert_path)?;
        let mut reader = std::io::BufReader::new(cert_pem.as_bytes());
        let certs = rustls_pemfile::certs(&mut reader)
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| TlsError::Io(e))?;

        if let Some(cert) = certs.first() {
            return Ok(cert.to_vec());
        }
    }

    // Generate new cert
    let (cert_pem, key_pem, cert_der) = generate_self_signed_cert()?;

    // Save to disk
    std::fs::create_dir_all(paths.cert_path.parent().unwrap())?;
    std::fs::write(&paths.cert_path, &cert_pem)?;
    std::fs::write(&paths.key_path, &key_pem)?;

    log::info!("Generated new TLS certificate at {:?}", paths.cert_path);

    Ok(cert_der)
}
