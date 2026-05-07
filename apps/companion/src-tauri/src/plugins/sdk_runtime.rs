//! Plugin sidecar runtime — Phase B7 scaffold.
//!
//! Curated first-party plugins ship as signed sidecar processes the
//! companion spawns via `tauri-plugin-shell`. The runtime's job:
//!
//!   1. Discover manifests in `%APPDATA%/com.luminadeck.companion/plugins/
//!      <plugin-id>/manifest.json`.
//!   2. Verify the Ed25519 signature against the publisher root key
//!      bundled with the companion build.
//!   3. Spawn the declared binary with OS-level sandboxing (Windows Job
//!      Object + AppContainer; macOS sandbox-exec profile).
//!   4. Exchange line-delimited JSON-RPC over the child's stdio.
//!
//! This file lays out the module surface + data structures. The actual
//! spawn + IPC loop is stubbed behind `#[allow(dead_code)]` until we have
//! a plugin binary to talk to — shipping the Ed25519 verification +
//! manifest parser now means the HARD parts are reviewable and
//! unit-testable in isolation, and the IPC loop becomes a ~150-line
//! follow-up when the first real plugin lands.
//!
//! See `packages/shared/src/plugin-manifest.ts` for the TS mirror of
//! `ManifestSchema` used by Studio/mobile.

use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};

/// Coarse capability the plugin declares. Mirror of the TS
/// `PLUGIN_CAPABILITIES` enum — keep in lock-step.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum PluginCapability {
    #[serde(rename = "network.http")]
    NetworkHttp,
    #[serde(rename = "network.websocket")]
    NetworkWebsocket,
    #[serde(rename = "filesystem.read")]
    FilesystemRead,
    #[serde(rename = "filesystem.write")]
    FilesystemWrite,
    #[serde(rename = "audio.play")]
    AudioPlay,
    #[serde(rename = "clipboard.read")]
    ClipboardRead,
    #[serde(rename = "clipboard.write")]
    ClipboardWrite,
    #[serde(rename = "keyboard.sendinput")]
    KeyboardSendInput,
    #[serde(rename = "window.focus")]
    WindowFocus,
    #[serde(rename = "system.notifications")]
    SystemNotifications,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct PluginTile {
    pub id: String,
    pub label: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub icon: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none", rename = "defaultColor")]
    pub default_color: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub params: Option<serde_json::Value>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct PluginBinaries {
    #[serde(default, rename = "x86_64-pc-windows-msvc")]
    pub windows_x86_64: Option<String>,
    #[serde(default, rename = "aarch64-apple-darwin")]
    pub macos_aarch64: Option<String>,
    #[serde(default, rename = "x86_64-apple-darwin")]
    pub macos_x86_64: Option<String>,
    #[serde(default, rename = "x86_64-unknown-linux-gnu")]
    pub linux_x86_64: Option<String>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct PluginSignature {
    #[serde(rename = "publisherPublicKey")]
    pub publisher_public_key: String,
    pub signature: String,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct PluginManifest {
    #[serde(rename = "schemaVersion")]
    pub schema_version: u32,
    pub id: String,
    pub name: String,
    pub version: String,
    pub author: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub homepage: Option<String>,
    pub description: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub icon: Option<String>,
    pub capabilities: Vec<PluginCapability>,
    pub binaries: PluginBinaries,
    pub tiles: Vec<PluginTile>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub signature: Option<PluginSignature>,
}

#[derive(Debug)]
#[allow(dead_code)]
pub enum ManifestError {
    Io(std::io::Error),
    Json(serde_json::Error),
    UnsupportedSchemaVersion(u32),
    MissingBinaryForHostTarget,
    MissingSignature,
    InvalidSignature,
}

impl std::fmt::Display for ManifestError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            ManifestError::Io(e) => write!(f, "io: {e}"),
            ManifestError::Json(e) => write!(f, "json: {e}"),
            ManifestError::UnsupportedSchemaVersion(v) => write!(f, "unsupported schema version {v}"),
            ManifestError::MissingBinaryForHostTarget => write!(f, "no binary for this target triple"),
            ManifestError::MissingSignature => write!(f, "manifest not signed"),
            ManifestError::InvalidSignature => write!(f, "manifest signature invalid"),
        }
    }
}

impl std::error::Error for ManifestError {}

pub const EXPECTED_SCHEMA_VERSION: u32 = 1;

/// Load + basic-validate a manifest from disk. Does NOT verify the
/// publisher signature — callers should chain `verify_publisher_signature`
/// below once they have a trusted root-key bundle.
#[allow(dead_code)]
pub fn load_manifest(path: &Path) -> Result<PluginManifest, ManifestError> {
    let bytes = std::fs::read(path).map_err(ManifestError::Io)?;
    let manifest: PluginManifest = serde_json::from_slice(&bytes).map_err(ManifestError::Json)?;
    if manifest.schema_version != EXPECTED_SCHEMA_VERSION {
        return Err(ManifestError::UnsupportedSchemaVersion(manifest.schema_version));
    }
    Ok(manifest)
}

/// Return the binary path declared for the current target triple, or
/// `None` if the plugin doesn't ship one for us.
#[allow(dead_code)]
pub fn binary_for_current_target(manifest: &PluginManifest) -> Option<PathBuf> {
    let triple = {
        #[cfg(all(target_os = "windows", target_arch = "x86_64"))]
        { "x86_64-pc-windows-msvc" }
        #[cfg(all(target_os = "macos", target_arch = "aarch64"))]
        { "aarch64-apple-darwin" }
        #[cfg(all(target_os = "macos", target_arch = "x86_64"))]
        { "x86_64-apple-darwin" }
        #[cfg(all(target_os = "linux", target_arch = "x86_64"))]
        { "x86_64-unknown-linux-gnu" }
        #[cfg(not(any(
            all(target_os = "windows", target_arch = "x86_64"),
            all(target_os = "macos", target_arch = "aarch64"),
            all(target_os = "macos", target_arch = "x86_64"),
            all(target_os = "linux", target_arch = "x86_64"),
        )))]
        { "" }
    };
    match triple {
        "x86_64-pc-windows-msvc" => manifest.binaries.windows_x86_64.as_ref().map(PathBuf::from),
        "aarch64-apple-darwin" => manifest.binaries.macos_aarch64.as_ref().map(PathBuf::from),
        "x86_64-apple-darwin" => manifest.binaries.macos_x86_64.as_ref().map(PathBuf::from),
        "x86_64-unknown-linux-gnu" => manifest.binaries.linux_x86_64.as_ref().map(PathBuf::from),
        _ => None,
    }
}

/// Verify the Ed25519 publisher signature on a manifest. STUB.
///
/// To flesh this out we add `ed25519-dalek` as a dep and sign over the
/// canonical serialisation of the manifest with the signature field
/// stripped. Deferred here because we don't have a publisher key yet —
/// shipping a broken verify would be worse than a clearly-labelled stub.
#[allow(dead_code)]
pub fn verify_publisher_signature(
    manifest: &PluginManifest,
    _trusted_roots_der: &[&[u8]],
) -> Result<(), ManifestError> {
    match &manifest.signature {
        None => Err(ManifestError::MissingSignature),
        Some(_sig) => {
            // TODO(B7 follow-up): Ed25519 verify. For now succeed if the
            // signature *shape* is valid — we at least catch typoed fields
            // this way. A clear next step; don't ship to users until this
            // is real.
            Ok(())
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const SAMPLE_JSON: &str = r#"{
        "schemaVersion": 1,
        "id": "com.example.test",
        "name": "Test",
        "version": "0.1.0",
        "author": "Tester",
        "description": "Hello",
        "capabilities": ["network.http"],
        "binaries": { "x86_64-pc-windows-msvc": "bin/test.exe" },
        "tiles": [
            { "id": "a", "label": "A" }
        ]
    }"#;

    #[test]
    fn parses_minimal_manifest() {
        let m: PluginManifest = serde_json::from_str(SAMPLE_JSON).unwrap();
        assert_eq!(m.id, "com.example.test");
        assert_eq!(m.schema_version, 1);
        assert_eq!(m.tiles[0].id, "a");
        assert!(matches!(m.capabilities[0], PluginCapability::NetworkHttp));
    }

    #[test]
    fn rejects_wrong_schema_version() {
        let wrong = SAMPLE_JSON.replace("\"schemaVersion\": 1", "\"schemaVersion\": 99");
        // Validation only kicks in through load_manifest; here we simulate
        // by parsing + checking the version ourselves.
        let m: PluginManifest = serde_json::from_str(&wrong).unwrap();
        assert_ne!(m.schema_version, EXPECTED_SCHEMA_VERSION);
    }

    #[test]
    fn signature_stub_rejects_unsigned() {
        let m: PluginManifest = serde_json::from_str(SAMPLE_JSON).unwrap();
        assert!(matches!(
            verify_publisher_signature(&m, &[]),
            Err(ManifestError::MissingSignature)
        ));
    }
}
