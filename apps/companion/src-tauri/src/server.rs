use crate::actions;
use crate::security::tls;
use std::net::SocketAddr;
use std::sync::Arc;
use tokio::net::TcpListener;
use tokio_tungstenite::tungstenite::Message;
use futures_util::{SinkExt, StreamExt};

const DEFAULT_PORT: u16 = 9876;

/// Start the WebSocket server with TLS.
pub async fn start_server(
    _app_handle: tauri::AppHandle,
) -> Result<(), Box<dyn std::error::Error>> {
    // Ensure TLS certificate exists
    let cert_der = tls::ensure_tls_cert()?;
    let fingerprint = crate::security::cert_fingerprint(&cert_der);
    log::info!("TLS cert fingerprint: {}", fingerprint);

    // Load TLS config
    let paths = tls::tls_paths();
    let cert_pem = std::fs::read(&paths.cert_path)?;
    let key_pem = std::fs::read(&paths.key_path)?;

    let certs = rustls_pemfile::certs(&mut &cert_pem[..])
        .collect::<Result<Vec<_>, _>>()?;

    let key = rustls_pemfile::private_key(&mut &key_pem[..])?
        .ok_or("No private key found")?;

    let config = rustls::ServerConfig::builder()
        .with_no_client_auth()
        .with_single_cert(certs, key)
        .map_err(|e| format!("TLS config error: {}", e))?;

    let tls_acceptor = tokio_rustls::TlsAcceptor::from(Arc::new(config));

    // Bind listener
    let addr = SocketAddr::from(([0, 0, 0, 0], DEFAULT_PORT));
    let listener = TcpListener::bind(&addr).await?;
    log::info!("WebSocket server listening on wss://0.0.0.0:{}", DEFAULT_PORT);

    loop {
        let (stream, peer_addr) = listener.accept().await?;
        let tls_acceptor = tls_acceptor.clone();

        tokio::spawn(async move {
            match tls_acceptor.accept(stream).await {
                Ok(tls_stream) => {
                    log::info!("TLS connection from {}", peer_addr);
                    if let Err(e) = handle_connection(tls_stream, peer_addr).await {
                        log::error!("Connection error from {}: {}", peer_addr, e);
                    }
                }
                Err(e) => {
                    log::warn!("TLS handshake failed from {}: {}", peer_addr, e);
                }
            }
        });
    }
}

async fn handle_connection(
    tls_stream: tokio_rustls::server::TlsStream<tokio::net::TcpStream>,
    peer_addr: SocketAddr,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let ws_stream = tokio_tungstenite::accept_async(tls_stream).await?;
    log::info!("WebSocket upgrade from {}", peer_addr);

    let (mut write, mut read) = ws_stream.split();

    while let Some(msg) = read.next().await {
        let msg = msg?;

        match msg {
            Message::Text(text) => {
                let response = handle_message(&text).await;
                write.send(Message::Text(response.into())).await?;
            }
            Message::Ping(data) => {
                write.send(Message::Pong(data)).await?;
            }
            Message::Close(_) => {
                log::info!("Client {} disconnected", peer_addr);
                break;
            }
            _ => {}
        }
    }

    Ok(())
}

/// Handle an incoming JSON message from the phone.
async fn handle_message(text: &str) -> String {
    let msg: serde_json::Value = match serde_json::from_str(text) {
        Ok(v) => v,
        Err(e) => {
            return serde_json::json!({
                "type": "error",
                "code": "INVALID_ACTION",
                "message": format!("Invalid JSON: {}", e)
            }).to_string();
        }
    };

    let msg_type = msg.get("type").and_then(|v| v.as_str()).unwrap_or("");

    match msg_type {
        "ping" => {
            let timestamp = msg.get("timestamp").and_then(|v| v.as_f64()).unwrap_or(0.0);
            serde_json::json!({
                "type": "pong",
                "timestamp": timestamp,
                "serverTime": chrono_now_ms()
            }).to_string()
        }

        "execute" => {
            let id = msg.get("id").and_then(|v| v.as_str()).unwrap_or("unknown");
            let action_value = msg.get("action");

            match action_value {
                Some(action_json) => {
                    match serde_json::from_value::<actions::Action>(action_json.clone()) {
                        Ok(action) => {
                            match actions::execute_action(&action).await {
                                Ok(()) => serde_json::json!({
                                    "type": "execute_result",
                                    "id": id,
                                    "success": true
                                }).to_string(),
                                Err(e) => serde_json::json!({
                                    "type": "execute_result",
                                    "id": id,
                                    "success": false,
                                    "error": e.to_string()
                                }).to_string(),
                            }
                        }
                        Err(e) => serde_json::json!({
                            "type": "error",
                            "code": "INVALID_ACTION",
                            "message": format!("Invalid action: {}", e)
                        }).to_string(),
                    }
                }
                None => serde_json::json!({
                    "type": "error",
                    "code": "INVALID_ACTION",
                    "message": "Missing 'action' field"
                }).to_string(),
            }
        }

        _ => {
            serde_json::json!({
                "type": "error",
                "code": "INVALID_ACTION",
                "message": format!("Unknown message type: {}", msg_type)
            }).to_string()
        }
    }
}

fn chrono_now_ms() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64
}
