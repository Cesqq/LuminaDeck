use async_trait::async_trait;
use crate::actions::ActionError;
use crate::plugins::Plugin;

use std::sync::Arc;
use futures_util::{SinkExt, StreamExt};
use tokio_tungstenite::tungstenite::Message;
use serde_json::json;

const OBS_WS_URL: &str = "ws://localhost:4455";

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
}

/// OBS Studio plugin — connects to the OBS WebSocket v5 server.
pub struct ObsPlugin {
    inner: Arc<tokio::sync::Mutex<ObsInner>>,
}

impl ObsPlugin {
    pub fn new() -> Self {
        Self {
            inner: Arc::new(tokio::sync::Mutex::new(ObsInner {
                writer: None,
                available: false,
            })),
        }
    }

    /// Try to perform the OBS WebSocket v5 handshake (Hello -> Identify -> Identified).
    /// We do NOT supply a password — if the server requires auth this will fail
    /// gracefully and the plugin stays unavailable.
    async fn try_connect(inner: &Arc<tokio::sync::Mutex<ObsInner>>) -> Result<(), String> {
        let ws_result = tokio::time::timeout(
            std::time::Duration::from_secs(3),
            tokio_tungstenite::connect_async(OBS_WS_URL),
        )
        .await;

        let (ws_stream, _) = match ws_result {
            Ok(Ok(pair)) => pair,
            Ok(Err(e)) => return Err(format!("OBS WebSocket connection failed: {}", e)),
            Err(_) => return Err("OBS WebSocket connection timed out".to_string()),
        };

        let (writer, mut reader) = ws_stream.split();

        // Expect OpCode 0 = Hello
        let hello_msg = tokio::time::timeout(std::time::Duration::from_secs(3), reader.next())
            .await
            .map_err(|_| "Timeout waiting for OBS Hello".to_string())?
            .ok_or("OBS stream ended before Hello")?
            .map_err(|e| format!("OBS read error: {}", e))?;

        let hello: serde_json::Value = match hello_msg {
            Message::Text(t) => serde_json::from_str(&t)
                .map_err(|e| format!("Invalid OBS Hello JSON: {}", e))?,
            _ => return Err("Expected text message for OBS Hello".to_string()),
        };

        let op = hello.get("op").and_then(|v| v.as_u64()).unwrap_or(99);
        if op != 0 {
            return Err(format!("Expected OBS Hello (op=0), got op={}", op));
        }

        // Check if auth is required
        let auth_required = hello
            .pointer("/d/authentication")
            .is_some();

        if auth_required {
            // Phase F v1: we don't handle OBS auth yet.
            // The plugin will stay available = false.
            return Err(
                "OBS requires authentication. Configure OBS to disable WebSocket auth, \
                 or auth support will arrive in a future update."
                    .to_string(),
            );
        }

        // Send OpCode 1 = Identify (no auth)
        let rpc_version = hello
            .pointer("/d/rpcVersion")
            .and_then(|v| v.as_u64())
            .unwrap_or(1);

        let identify = json!({
            "op": 1,
            "d": {
                "rpcVersion": rpc_version
            }
        });

        let mut writer = writer;
        writer
            .send(Message::Text(identify.to_string().into()))
            .await
            .map_err(|e| format!("Failed to send OBS Identify: {}", e))?;

        // Expect OpCode 2 = Identified
        let id_msg = tokio::time::timeout(std::time::Duration::from_secs(3), reader.next())
            .await
            .map_err(|_| "Timeout waiting for OBS Identified".to_string())?
            .ok_or("OBS stream ended before Identified")?
            .map_err(|e| format!("OBS read error: {}", e))?;

        let identified: serde_json::Value = match id_msg {
            Message::Text(t) => serde_json::from_str(&t)
                .map_err(|e| format!("Invalid OBS Identified JSON: {}", e))?,
            _ => return Err("Expected text message for OBS Identified".to_string()),
        };

        let id_op = identified.get("op").and_then(|v| v.as_u64()).unwrap_or(99);
        if id_op != 2 {
            return Err(format!("Expected OBS Identified (op=2), got op={}", id_op));
        }

        log::info!("OBS WebSocket v5 connected (rpcVersion={})", rpc_version);

        // Spawn a reader task that drains incoming messages (events / responses)
        // so the writer doesn't back-pressure.
        tokio::spawn(async move {
            while let Some(msg) = reader.next().await {
                match msg {
                    Ok(Message::Close(_)) => break,
                    Err(_) => break,
                    _ => { /* discard events for now */ }
                }
            }
        });

        let mut guard = inner.lock().await;
        guard.writer = Some(writer);
        guard.available = true;

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
                ActionError::IntegrationUnavailable(format!("OBS send failed: {}", e))
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
        match Self::try_connect(&self.inner).await {
            Ok(()) => {
                log::info!("OBS plugin initialised — connected to {}", OBS_WS_URL);
                Ok(())
            }
            Err(e) => {
                log::warn!("OBS plugin unavailable: {}", e);
                // Not a fatal error — plugin is just marked unavailable.
                Ok(())
            }
        }
    }

    async fn execute(&self, command: &str, params: &serde_json::Value) -> Result<(), ActionError> {
        if !self.is_available() {
            return Err(ActionError::IntegrationUnavailable(
                "OBS Studio is not connected. Ensure OBS is running with WebSocket server enabled."
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
            "toggle_record" => {
                Self::send_request(&self.inner, "ToggleRecord", None).await
            }
            "toggle_stream" => {
                Self::send_request(&self.inner, "ToggleStream", None).await
            }
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

                // GetSceneItemId → then toggle. For v1 we send
                // SetSceneItemEnabled with a toggle by fetching current state
                // first. Simplified: just send SetSceneItemEnabled(true). A
                // real toggle needs the item id — deferred to v2.
                Self::send_request(
                    &self.inner,
                    "GetSceneItemList",
                    Some(json!({ "sceneName": scene })),
                )
                .await?;

                log::info!(
                    "OBS toggle_source: scene={}, source={} (full toggle deferred to v2)",
                    scene,
                    source
                );
                Ok(())
            }
            other => Err(ActionError::IntegrationUnavailable(format!(
                "Unknown OBS command: {}",
                other
            ))),
        }
    }

    fn is_available(&self) -> bool {
        // We can't `.await` here, so use try_lock.
        self.inner
            .try_lock()
            .map(|g| g.available)
            .unwrap_or(false)
    }
}
