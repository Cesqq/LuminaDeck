use async_trait::async_trait;
use crate::actions::ActionError;
use crate::plugins::Plugin;

use std::sync::Arc;
use futures_util::{SinkExt, StreamExt};
use tokio_tungstenite::tungstenite::Message;
use serde_json::json;
use base64::{Engine as _, engine::general_purpose::STANDARD as B64};
use sha2::{Digest, Sha256};

const KEYRING_SERVICE: &str = "com.luminadeck.companion";
const KEYRING_USER_OBS_PASSWORD: &str = "obs-password";
const DEFAULT_HOST: &str = "localhost";
const DEFAULT_PORT: u16 = 4455;

/// Non-secret config persisted to disk at `plugins/obs.json`.
/// Password lives in the OS keyring (Windows Credential Manager / macOS
/// Keychain), NEVER in this struct or the JSON file.
#[derive(Clone, Debug, serde::Serialize, serde::Deserialize)]
struct ObsConfig {
    host: String,
    port: u16,
}

impl Default for ObsConfig {
    fn default() -> Self {
        Self { host: DEFAULT_HOST.to_string(), port: DEFAULT_PORT }
    }
}

/// Internal connection state shared across sync/async boundaries.
struct ObsInner {
    /// Sender half of the WebSocket, if connected.
    writer: Option<futures_util::stream::SplitSink<
        tokio_tungstenite::WebSocketStream<
            tokio_tungstenite::MaybeTlsStream<tokio::net::TcpStream>,
        >,
        Message,
    >>,
    available: bool,
    last_error: Option<String>,
}

/// OBS Studio plugin — connects to the OBS WebSocket v5 server with
/// optional SHA-256 challenge/response authentication.
pub struct ObsPlugin {
    inner: Arc<tokio::sync::Mutex<ObsInner>>,
    config: ObsConfig,
}

impl ObsPlugin {
    pub fn new() -> Self {
        let config = Self::load_config().unwrap_or_default();
        Self {
            inner: Arc::new(tokio::sync::Mutex::new(ObsInner {
                writer: None,
                available: false,
                last_error: None,
            })),
            config,
        }
    }

    fn config_path() -> std::path::PathBuf {
        directories::ProjectDirs::from("com", "luminadeck", "companion")
            .map(|d| d.data_dir().join("plugins").join("obs.json"))
            .unwrap_or_else(|| std::path::PathBuf::from("plugins/obs.json"))
    }

    fn load_config() -> Option<ObsConfig> {
        let data = std::fs::read_to_string(Self::config_path()).ok()?;
        serde_json::from_str(&data).ok()
    }

    fn save_config(cfg: &ObsConfig) -> Result<(), String> {
        let path = Self::config_path();
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }
        let json = serde_json::to_string_pretty(cfg).map_err(|e| e.to_string())?;
        std::fs::write(&path, json).map_err(|e| e.to_string())
    }

    fn read_password() -> Option<String> {
        keyring::Entry::new(KEYRING_SERVICE, KEYRING_USER_OBS_PASSWORD)
            .ok()?
            .get_password()
            .ok()
    }

    fn write_password(pw: &str) -> Result<(), String> {
        let entry = keyring::Entry::new(KEYRING_SERVICE, KEYRING_USER_OBS_PASSWORD)
            .map_err(|e| format!("keyring init failed: {e}"))?;
        if pw.is_empty() {
            // Empty password → clear any existing entry (best-effort).
            let _ = entry.delete_credential();
            Ok(())
        } else {
            entry
                .set_password(pw)
                .map_err(|e| format!("keyring write failed: {e}"))
        }
    }

    /// Compute the OBS v5 auth string:
    ///   auth = base64(sha256( base64(sha256(password + salt)) + challenge ))
    fn compute_auth(password: &str, salt: &str, challenge: &str) -> String {
        let mut h1 = Sha256::new();
        h1.update(password.as_bytes());
        h1.update(salt.as_bytes());
        let secret = B64.encode(h1.finalize());

        let mut h2 = Sha256::new();
        h2.update(secret.as_bytes());
        h2.update(challenge.as_bytes());
        B64.encode(h2.finalize())
    }

    /// Perform the OBS WebSocket v5 handshake (Hello -> Identify -> Identified).
    /// Auth is included only if the server's Hello advertised it.
    async fn try_connect(
        inner: &Arc<tokio::sync::Mutex<ObsInner>>,
        host: &str,
        port: u16,
    ) -> Result<(), String> {
        let url = format!("ws://{host}:{port}");
        let ws_result = tokio::time::timeout(
            std::time::Duration::from_secs(3),
            tokio_tungstenite::connect_async(&url),
        )
        .await;

        let (ws_stream, _) = match ws_result {
            Ok(Ok(pair)) => pair,
            Ok(Err(e)) => return Err(format!("OBS WebSocket connect failed: {e}")),
            Err(_) => return Err("OBS WebSocket connect timed out".to_string()),
        };

        let (writer, mut reader) = ws_stream.split();

        // Expect OpCode 0 = Hello
        let hello_msg = tokio::time::timeout(std::time::Duration::from_secs(3), reader.next())
            .await
            .map_err(|_| "Timeout waiting for OBS Hello".to_string())?
            .ok_or("OBS stream ended before Hello")?
            .map_err(|e| format!("OBS read error: {e}"))?;

        let hello: serde_json::Value = match hello_msg {
            Message::Text(t) => serde_json::from_str(&t)
                .map_err(|e| format!("Invalid OBS Hello JSON: {e}"))?,
            _ => return Err("Expected text message for OBS Hello".to_string()),
        };

        let op = hello.get("op").and_then(|v| v.as_u64()).unwrap_or(99);
        if op != 0 {
            return Err(format!("Expected OBS Hello (op=0), got op={op}"));
        }

        let rpc_version = hello
            .pointer("/d/rpcVersion")
            .and_then(|v| v.as_u64())
            .unwrap_or(1);

        // OBS servers with auth enabled include an /d/authentication object.
        let auth_block = hello.pointer("/d/authentication").cloned();

        let identify_data = if let Some(auth) = auth_block {
            let salt = auth
                .get("salt")
                .and_then(|v| v.as_str())
                .ok_or("OBS Hello missing authentication.salt")?;
            let challenge = auth
                .get("challenge")
                .and_then(|v| v.as_str())
                .ok_or("OBS Hello missing authentication.challenge")?;
            let password = Self::read_password().ok_or_else(|| {
                "OBS requires authentication but no password is stored. \
                 Configure the OBS plugin from Studio to save the password."
                    .to_string()
            })?;
            let auth_str = Self::compute_auth(&password, salt, challenge);
            json!({
                "rpcVersion": rpc_version,
                "authentication": auth_str
            })
        } else {
            json!({ "rpcVersion": rpc_version })
        };

        let identify = json!({
            "op": 1,
            "d": identify_data
        });

        let mut writer = writer;
        writer
            .send(Message::Text(identify.to_string().into()))
            .await
            .map_err(|e| format!("Failed to send OBS Identify: {e}"))?;

        // Expect OpCode 2 = Identified
        let id_msg = tokio::time::timeout(std::time::Duration::from_secs(3), reader.next())
            .await
            .map_err(|_| "Timeout waiting for OBS Identified".to_string())?
            .ok_or("OBS stream ended before Identified")?
            .map_err(|e| format!("OBS read error: {e}"))?;

        let identified: serde_json::Value = match id_msg {
            Message::Text(t) => serde_json::from_str(&t)
                .map_err(|e| format!("Invalid OBS Identified JSON: {e}"))?,
            _ => return Err("Expected text message for OBS Identified".to_string()),
        };

        let id_op = identified.get("op").and_then(|v| v.as_u64()).unwrap_or(99);
        if id_op != 2 {
            let reason = identified
                .pointer("/d/reason")
                .and_then(|v| v.as_str())
                .unwrap_or("unknown");
            return Err(format!(
                "OBS Identify rejected (op={id_op}): {reason}"
            ));
        }

        log::info!("OBS WebSocket v5 connected to {host}:{port} (rpcVersion={rpc_version})");

        // Drain incoming events in the background so the writer doesn't back-pressure.
        tokio::spawn(async move {
            while let Some(msg) = reader.next().await {
                match msg {
                    Ok(Message::Close(_)) => break,
                    Err(_) => break,
                    _ => { /* events discarded */ }
                }
            }
        });

        let mut guard = inner.lock().await;
        guard.writer = Some(writer);
        guard.available = true;
        guard.last_error = None;

        Ok(())
    }

    /// Send an OBS Request (OpCode 6) and don't wait for the response.
    async fn send_request(
        inner: &Arc<tokio::sync::Mutex<ObsInner>>,
        request_type: &str,
        request_data: Option<serde_json::Value>,
    ) -> Result<(), ActionError> {
        let mut guard = inner.lock().await;
        let writer = guard.writer.as_mut().ok_or_else(|| {
            ActionError::IntegrationUnavailable("OBS is not connected".to_string())
        })?;

        let request_id = uuid::Uuid::new_v4().to_string();

        let mut msg = json!({
            "op": 6,
            "d": {
                "requestType": request_type,
                "requestId": request_id,
            }
        });

        if let Some(data) = request_data {
            msg["d"]["requestData"] = data;
        }

        writer
            .send(Message::Text(msg.to_string().into()))
            .await
            .map_err(|e| {
                ActionError::IntegrationUnavailable(format!("OBS send failed: {e}"))
            })?;

        Ok(())
    }
}

#[async_trait]
impl Plugin for ObsPlugin {
    fn name(&self) -> &str {
        "obs"
    }

    fn capabilities(&self) -> Vec<String> {
        vec![
            "switch_scene".to_string(),
            "toggle_record".to_string(),
            "toggle_stream".to_string(),
            "toggle_source".to_string(),
        ]
    }

    async fn init(&mut self) -> Result<(), String> {
        match Self::try_connect(&self.inner, &self.config.host, self.config.port).await {
            Ok(()) => {
                log::info!("OBS plugin initialised at {}:{}", self.config.host, self.config.port);
                Ok(())
            }
            Err(e) => {
                log::warn!("OBS plugin unavailable: {e}");
                let mut guard = self.inner.lock().await;
                guard.last_error = Some(e);
                // Non-fatal — plugin is just marked unavailable.
                Ok(())
            }
        }
    }

    async fn execute(&self, command: &str, params: &serde_json::Value) -> Result<(), ActionError> {
        if !self.is_available() {
            return Err(ActionError::IntegrationUnavailable(
                "OBS Studio is not connected. Configure the OBS plugin and ensure OBS is running."
                    .to_string(),
            ));
        }

        match command {
            "switch_scene" => {
                let scene_name = params
                    .get("sceneName")
                    .and_then(|v| v.as_str())
                    .ok_or_else(|| {
                        ActionError::IntegrationUnavailable(
                            "switch_scene requires 'sceneName'".to_string(),
                        )
                    })?;

                Self::send_request(
                    &self.inner,
                    "SetCurrentProgramScene",
                    Some(json!({ "sceneName": scene_name })),
                )
                .await
            }
            "toggle_record" => Self::send_request(&self.inner, "ToggleRecord", None).await,
            "toggle_stream" => Self::send_request(&self.inner, "ToggleStream", None).await,
            "toggle_source" => {
                let scene = params
                    .get("sceneName")
                    .and_then(|v| v.as_str())
                    .ok_or_else(|| {
                        ActionError::IntegrationUnavailable(
                            "toggle_source requires 'sceneName'".to_string(),
                        )
                    })?;
                let source = params
                    .get("sourceName")
                    .and_then(|v| v.as_str())
                    .ok_or_else(|| {
                        ActionError::IntegrationUnavailable(
                            "toggle_source requires 'sourceName'".to_string(),
                        )
                    })?;
                Self::send_request(
                    &self.inner,
                    "GetSceneItemList",
                    Some(json!({ "sceneName": scene })),
                )
                .await?;
                log::info!(
                    "OBS toggle_source: scene={}, source={} (full toggle deferred)",
                    scene, source
                );
                Ok(())
            }
            other => Err(ActionError::IntegrationUnavailable(format!(
                "Unknown OBS command: {other}"
            ))),
        }
    }

    fn is_available(&self) -> bool {
        self.inner
            .try_lock()
            .map(|g| g.available)
            .unwrap_or(false)
    }

    fn config_schema(&self) -> serde_json::Value {
        json!({
            "type": "object",
            "title": "OBS Studio",
            "description": "Connect to OBS's built-in WebSocket server (Tools → WebSocket Server Settings).",
            "fields": [
                { "id": "host", "label": "Host", "type": "text", "placeholder": "localhost", "default": DEFAULT_HOST },
                { "id": "port", "label": "Port", "type": "number", "min": 1, "max": 65535, "default": DEFAULT_PORT },
                { "id": "password", "label": "Password (stored in OS keyring)", "type": "password", "help": "Leave empty if OBS has auth disabled." }
            ]
        })
    }

    fn current_config(&self) -> serde_json::Value {
        json!({
            "host": self.config.host,
            "port": self.config.port,
            "passwordSet": Self::read_password().is_some(),
        })
    }

    async fn configure(&mut self, cfg: serde_json::Value) -> Result<(), String> {
        let host = cfg
            .get("host")
            .and_then(|v| v.as_str())
            .unwrap_or(DEFAULT_HOST)
            .to_string();
        let port = cfg
            .get("port")
            .and_then(|v| v.as_u64())
            .unwrap_or(DEFAULT_PORT as u64) as u16;

        // Password is opt-in on each save: only rewrite the keyring entry
        // if the field is present AND non-null. Missing → leave unchanged;
        // null or "" → clear.
        if let Some(pw_val) = cfg.get("password") {
            if pw_val.is_null() {
                Self::write_password("")?;
            } else if let Some(pw) = pw_val.as_str() {
                Self::write_password(pw)?;
            }
        }

        self.config = ObsConfig { host: host.clone(), port };
        Self::save_config(&self.config)?;

        // Close any existing connection, then reconnect with new config.
        {
            let mut guard = self.inner.lock().await;
            guard.writer = None;
            guard.available = false;
        }
        if let Err(e) = Self::try_connect(&self.inner, &host, port).await {
            let mut guard = self.inner.lock().await;
            guard.last_error = Some(e.clone());
            return Err(e);
        }
        Ok(())
    }

    async fn test(&self) -> Result<(), String> {
        if self.is_available() {
            return Ok(());
        }
        let guard = self.inner.lock().await;
        Err(guard
            .last_error
            .clone()
            .unwrap_or_else(|| "Not connected".to_string()))
    }
}
