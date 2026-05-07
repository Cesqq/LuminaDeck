use crate::actions;
use crate::security::pairing::{self, PairedDevice};
use crate::security::tls;
use crate::ws_bus::{BroadcastKind, BroadcastMessage};
use tauri::Emitter;
use serde::Serialize;
use std::collections::HashMap;
use std::net::SocketAddr;
use std::sync::Arc;
use std::sync::atomic::{AtomicU32, AtomicU64, Ordering};
use std::time::Instant;
use parking_lot::Mutex;
use tokio::net::TcpListener;
use tokio_tungstenite::tungstenite::Message;
use futures_util::{SinkExt, StreamExt};

const DEFAULT_PORT: u16 = 9876;
const PLAIN_WS_PORT: u16 = 9877;
const RATE_LIMIT_WINDOW_MS: u128 = 1000;
const RATE_LIMIT_MAX_ACTIONS: u32 = 50;

/// Wire protocol version this companion speaks. Mirror of
/// `PROTOCOL_VERSION` in `packages/shared/src/protocol.ts` — bump both
/// together on any wire-incompatible change.
const PROTOCOL_VERSION: &str = "1.5.0";

/// Per-peer mouse rate limit (separate from the standard 50/sec action
/// limit because trackpad runs at ~60Hz and would saturate it instantly).
/// At 240/sec we have headroom for short bursts above 60Hz before drop.
const MOUSE_RATE_LIMIT_PER_SEC: u32 = 240;

/// Range of client `protocolVersion` values this companion accepts in the
/// hello handshake. Mirror of `MIN_CLIENT_PROTOCOL` in protocol.ts (Rust
/// `semver` uses comma-separated; JS `semver` uses space-separated — same
/// range either way).
const MIN_CLIENT_PROTOCOL: &str = ">=1.1.0, <2.0.0";

/// Minimum client protocol for `profile_update` pushes. Mirror of
/// `MIN_FEATURE_PROFILE_UPDATE` in protocol.ts.
const MIN_FEATURE_PROFILE_UPDATE: &str = ">=1.2.0, <2.0.0";

/// Capabilities advertised by this companion. Sent in `hello_ack` and
/// in response to `request_capabilities`. Keep in sync with
/// `CompanionCapability` in packages/shared/src/protocol.ts.
const ADVERTISED_CAPABILITIES: &[&str] = &[
    "keybind",
    "app_launch",
    "system_action",
    "multi_action",
    "text_input",
    "discord",
    "macro",
    "window_monitor",
    "auto_profile",
    "trackpad",
];

/// Per-connection session state mutated by the message loop.
#[derive(Default)]
struct ConnectionState {
    negotiated_version: Option<semver::Version>,
    subscribed_to_profile: bool,
    authenticated: bool,
    device_id: Option<String>,
    device_name: Option<String>,
}

#[derive(Clone)]
struct PairingAuth {
    paired_devices: Arc<Mutex<Vec<PairedDevice>>>,
    active_pairing_secret_hash: Arc<Mutex<Option<String>>>,
}

impl PairingAuth {
    fn authenticate_or_pair(
        &self,
        device_id: &str,
        device_name: &str,
        pairing_secret: &str,
    ) -> Result<bool, String> {
        if device_id.trim().is_empty() {
            return Err("Missing device id".to_string());
        }
        if pairing_secret.len() < 16 || pairing_secret.len() > 128 {
            return Err("Missing or invalid pairing secret. Scan the Companion QR code again.".to_string());
        }

        let provided_hash = pairing::hash_pairing_secret(pairing_secret);
        let now = pairing::now_iso();
        let mut devices = self.paired_devices.lock();

        if let Some(device) = devices.iter_mut().find(|d| d.id == device_id) {
            let Some(stored_hash) = device.pairing_secret_hash.as_deref() else {
                return Err("This saved PC was paired before secure launch auth. Remove it and scan the QR code again.".to_string());
            };

            if !pairing::pairing_hash_matches(stored_hash, &provided_hash) {
                return Err("Pairing secret mismatch. Remove this PC and scan the QR code again.".to_string());
            }

            device.name = device_name.to_string();
            device.last_seen = Some(now);
            pairing::save_paired_devices(&devices);
            return Ok(false);
        }

        let active_hash = self.active_pairing_secret_hash.lock().clone();
        let active_matches = active_hash
            .as_deref()
            .map(|hash| pairing::pairing_hash_matches(hash, &provided_hash))
            .unwrap_or(false);

        if !active_matches {
            return Err("Device is not paired. Start pairing in Companion and scan the QR code.".to_string());
        }

        if devices.len() >= pairing::MAX_PAIRED_DEVICES {
            return Err(format!(
                "Maximum {} paired devices reached",
                pairing::MAX_PAIRED_DEVICES
            ));
        }

        let device = PairedDevice {
            id: device_id.to_string(),
            name: device_name.to_string(),
            paired_at: now.clone(),
            last_seen: Some(now),
            pairing_secret_hash: Some(provided_hash),
        };
        devices.push(device);
        pairing::save_paired_devices(&devices);

        // One QR pairing secret should onboard at most one previously unknown
        // device. Existing paired devices continue to authenticate against
        // their stored device hash.
        *self.active_pairing_secret_hash.lock() = None;

        Ok(true)
    }
}

/// Connection statistics tracked globally.
pub struct ConnectionStats {
    pub active_connections: AtomicU32,
    pub total_connections: AtomicU64,
    pub total_actions_executed: AtomicU64,
    pub total_actions_rejected: AtomicU64,
}

impl ConnectionStats {
    pub fn new() -> Self {
        Self {
            active_connections: AtomicU32::new(0),
            total_connections: AtomicU64::new(0),
            total_actions_executed: AtomicU64::new(0),
            total_actions_rejected: AtomicU64::new(0),
        }
    }
}

/// Event payload emitted to Tauri frontend.
#[derive(Clone, Serialize)]
struct ConnectionEvent {
    event_type: String, // "connected" | "disconnected"
    peer: String,
    active_count: u32,
}

#[derive(Clone, Serialize)]
pub struct StatsSnapshot {
    pub active_connections: u32,
    pub total_connections: u64,
    pub total_actions_executed: u64,
    pub total_actions_rejected: u64,
}

/// Emitted when a device identifies via hello or pair_request.
#[derive(Clone, Serialize)]
struct DeviceIdentifiedEvent {
    device_name: String,
    device_id: String,
    peer: String,
    protocol_version: String,
}

/// Global app handle for emitting events from handle_message.
static APP_HANDLE: std::sync::OnceLock<tauri::AppHandle> = std::sync::OnceLock::new();

/// Process-wide handle to the WS broadcast channel so message handlers
/// outside of `handle_websocket`'s closure (like the clipboard_set
/// arm in `handle_message`) can publish into the bus without taking
/// `broadcast_tx` as a parameter through every function. Set during
/// `start_websocket_server`.
static BROADCAST_TX: std::sync::OnceLock<tokio::sync::broadcast::Sender<BroadcastMessage>> =
    std::sync::OnceLock::new();

/// Per-peer rate limiter.
struct RateLimiter {
    peers: Mutex<HashMap<SocketAddr, PeerRate>>,
}

struct PeerRate {
    window_start: Instant,
    count: u32,
    /// Separate bucket for mouse_* events (v1.4.0+). Capped at
    /// MOUSE_RATE_LIMIT_PER_SEC so 60Hz trackpad doesn't blow the standard
    /// 50/sec action limit. Using its own window also means mouse spam
    /// doesn't starve real action presses.
    mouse_window_start: Instant,
    mouse_count: u32,
}

impl RateLimiter {
    fn new() -> Self {
        Self {
            peers: Mutex::new(HashMap::new()),
        }
    }

    /// Returns true if the action is allowed, false if rate-limited.
    fn check(&self, peer: SocketAddr) -> bool {
        let mut peers = self.peers.lock();
        let now = Instant::now();

        let entry = peers.entry(peer).or_insert_with(|| PeerRate {
            window_start: now,
            count: 0,
            mouse_window_start: now,
            mouse_count: 0,
        });

        let elapsed = now.duration_since(entry.window_start).as_millis();
        if elapsed >= RATE_LIMIT_WINDOW_MS {
            // Reset window
            entry.window_start = now;
            entry.count = 1;
            true
        } else if entry.count < RATE_LIMIT_MAX_ACTIONS {
            entry.count += 1;
            true
        } else {
            false
        }
    }

    /// Mouse-event variant of `check` with the higher MOUSE_RATE_LIMIT cap.
    fn check_mouse(&self, peer: SocketAddr) -> bool {
        let mut peers = self.peers.lock();
        let now = Instant::now();

        let entry = peers.entry(peer).or_insert_with(|| PeerRate {
            window_start: now,
            count: 0,
            mouse_window_start: now,
            mouse_count: 0,
        });

        let elapsed = now.duration_since(entry.mouse_window_start).as_millis();
        if elapsed >= RATE_LIMIT_WINDOW_MS {
            entry.mouse_window_start = now;
            entry.mouse_count = 1;
            true
        } else if entry.mouse_count < MOUSE_RATE_LIMIT_PER_SEC {
            entry.mouse_count += 1;
            true
        } else {
            false
        }
    }

    fn remove_peer(&self, peer: &SocketAddr) {
        self.peers.lock().remove(peer);
    }
}

/// Start the WebSocket server with TLS. Messages sent on `broadcast_tx` are
/// fanned out to every connected client (used by window_monitor and the
/// auto-profile engine).
pub async fn start_server(
    app_handle: tauri::AppHandle,
    broadcast_tx: tokio::sync::broadcast::Sender<BroadcastMessage>,
    paired_devices: Arc<Mutex<Vec<PairedDevice>>>,
    active_pairing_secret_hash: Arc<Mutex<Option<String>>>,
) -> Result<(), Box<dyn std::error::Error>> {
    // Stash the broadcast channel so message handlers outside the
    // per-connection closure (e.g. the clipboard_set arm) can publish
    // without taking broadcast_tx through every signature.
    let _ = BROADCAST_TX.set(broadcast_tx.clone());

    // Install the default rustls crypto provider
    let _ = rustls::crypto::ring::default_provider().install_default();

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
    let rate_limiter = Arc::new(RateLimiter::new());
    let stats = Arc::new(ConnectionStats::new());
    let pairing_auth = Arc::new(PairingAuth {
        paired_devices,
        active_pairing_secret_hash,
    });

    // Store app handle for device events
    let _ = APP_HANDLE.set(app_handle.clone());

    // Bind TLS listener
    let addr = SocketAddr::from(([0, 0, 0, 0], DEFAULT_PORT));
    let listener = TcpListener::bind(&addr).await?;
    log::info!("WebSocket server listening on wss://0.0.0.0:{}", DEFAULT_PORT);

    // Also bind a plain WS listener for local network (iOS doesn't trust self-signed certs)
    let plain_addr = SocketAddr::from(([0, 0, 0, 0], PLAIN_WS_PORT));
    let plain_listener = TcpListener::bind(&plain_addr).await?;
    log::info!("Plain WebSocket server listening on ws://0.0.0.0:{}", PLAIN_WS_PORT);

    // Spawn plain WS acceptor
    {
        let limiter = rate_limiter.clone();
        let conn_stats = stats.clone();
        let handle = app_handle.clone();
        let broadcast = broadcast_tx.clone();
        let auth = pairing_auth.clone();
        tokio::spawn(async move {
            loop {
                match plain_listener.accept().await {
                    Ok((stream, peer_addr)) => {
                        let limiter = limiter.clone();
                        let conn_stats = conn_stats.clone();
                        let handle = handle.clone();
                        let broadcast_rx = broadcast.subscribe();
                        let auth = auth.clone();
                        tokio::spawn(async move {
                            let active = conn_stats.active_connections.fetch_add(1, Ordering::Relaxed) + 1;
                            conn_stats.total_connections.fetch_add(1, Ordering::Relaxed);
                            log::info!("Plain WS connection from {} (active: {})", peer_addr, active);

                            let _ = handle.emit("connection-change", ConnectionEvent {
                                event_type: "connected".to_string(),
                                peer: peer_addr.to_string(),
                                active_count: active,
                            });

                            if let Err(e) = handle_websocket(stream, peer_addr, &limiter, &conn_stats, broadcast_rx, auth).await {
                                log::warn!("Plain WS connection {} ended: {}", peer_addr, e);
                            }

                            limiter.remove_peer(&peer_addr);
                            let active = conn_stats.active_connections.fetch_sub(1, Ordering::Relaxed) - 1;
                            log::info!("Disconnected {} (active: {})", peer_addr, active);

                            let _ = handle.emit("connection-change", ConnectionEvent {
                                event_type: "disconnected".to_string(),
                                peer: peer_addr.to_string(),
                                active_count: active,
                            });
                        });
                    }
                    Err(e) => {
                        log::error!("Plain WS accept error: {}", e);
                    }
                }
            }
        });
    }

    loop {
        let (stream, peer_addr) = listener.accept().await?;
        let tls_acceptor = tls_acceptor.clone();
        let limiter = rate_limiter.clone();
        let conn_stats = stats.clone();
        let handle = app_handle.clone();
        let broadcast_rx = broadcast_tx.subscribe();
        let auth = pairing_auth.clone();

        tokio::spawn(async move {
            match tls_acceptor.accept(stream).await {
                Ok(tls_stream) => {
                    // Track connection
                    let active = conn_stats.active_connections.fetch_add(1, Ordering::Relaxed) + 1;
                    conn_stats.total_connections.fetch_add(1, Ordering::Relaxed);
                    log::info!("TLS connection from {} (active: {})", peer_addr, active);

                    // Emit event to frontend
                    let _ = handle.emit("connection-change", ConnectionEvent {
                        event_type: "connected".to_string(),
                        peer: peer_addr.to_string(),
                        active_count: active,
                    });

                    if let Err(e) = handle_websocket(tls_stream, peer_addr, &limiter, &conn_stats, broadcast_rx, auth).await {
                        log::error!("Connection error from {}: {}", peer_addr, e);
                    }

                    // Track disconnection
                    limiter.remove_peer(&peer_addr);
                    let active = conn_stats.active_connections.fetch_sub(1, Ordering::Relaxed) - 1;
                    log::info!("Disconnected {} (active: {})", peer_addr, active);

                    let _ = handle.emit("connection-change", ConnectionEvent {
                        event_type: "disconnected".to_string(),
                        peer: peer_addr.to_string(),
                        active_count: active,
                    });
                }
                Err(e) => {
                    log::warn!("TLS handshake failed from {}: {}", peer_addr, e);
                }
            }
        });
    }
}

/// Drive a single WebSocket connection, multiplexing inbound client messages
/// and outbound broadcast pushes. `ProfileUpdate` broadcasts are filtered by
/// the peer's own `subscribed_to_profile` flag — peers that didn't opt in
/// via `subscribe_profile` never see them, even though every connection
/// receives the same broadcast channel.
async fn handle_websocket<S>(
    stream: S,
    peer_addr: SocketAddr,
    rate_limiter: &RateLimiter,
    stats: &ConnectionStats,
    mut broadcast_rx: tokio::sync::broadcast::Receiver<BroadcastMessage>,
    pairing_auth: Arc<PairingAuth>,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>>
where
    S: tokio::io::AsyncRead + tokio::io::AsyncWrite + Unpin,
{
    let ws_stream = tokio_tungstenite::accept_async(stream).await?;
    log::info!("WebSocket upgrade from {}", peer_addr);

    let (mut write, mut read) = ws_stream.split();
    let mut conn = ConnectionState::default();

    loop {
        tokio::select! {
            ws_msg = read.next() => {
                let Some(msg) = ws_msg else { break; };
                let msg = msg?;
                match msg {
                    Message::Text(text) => {
                        let response = handle_message(&text, peer_addr, rate_limiter, stats, &mut conn, &pairing_auth).await;
                        write.send(Message::Text(response.into())).await?;
                    }
                    Message::Ping(data) => {
                        write.send(Message::Pong(data)).await?;
                    }
                    Message::Close(frame) => {
                        log::info!(
                            "Client {} disconnected — close frame: {:?}",
                            peer_addr,
                            frame
                        );
                        break;
                    }
                    _ => {}
                }
            }
            broadcast = broadcast_rx.recv() => {
                match broadcast {
                    Ok(bcast) => {
                        let should_send = conn.authenticated && match bcast.kind {
                            BroadcastKind::ActiveWindow => true,
                            BroadcastKind::ProfileUpdate => conn.subscribed_to_profile,
                            BroadcastKind::ProfileSwitch => true,
                            // Clipboard: only forward PC-sourced messages
                            // to phones (phone-sourced ones are local
                            // re-broadcasts that the clipboard_sync task
                            // already applied to the OS clipboard).
                            BroadcastKind::Clipboard => bcast.json.contains("\"source\":\"pc\""),
                        };
                        if should_send
                            && write.send(Message::Text(bcast.json.into())).await.is_err()
                        {
                            break;
                        }
                    }
                    Err(tokio::sync::broadcast::error::RecvError::Lagged(_)) => continue,
                    Err(tokio::sync::broadcast::error::RecvError::Closed) => break,
                }
            }
        }
    }

    Ok(())
}

/// Handle an incoming JSON message from the phone. `conn` carries
/// per-connection session state so hello / subscribe_profile can mutate
/// negotiated version and subscription flags.
async fn handle_message(
    text: &str,
    peer: SocketAddr,
    rate_limiter: &RateLimiter,
    stats: &ConnectionStats,
    conn: &mut ConnectionState,
    pairing_auth: &PairingAuth,
) -> String {
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

    let requires_auth = matches!(
        msg_type,
        "request_capabilities"
            | "profile_sync"
            | "subscribe_profile"
            | "text_input"
            | "mouse_move"
            | "mouse_click"
            | "mouse_scroll"
            | "mouse_drag"
            | "execute"
            | "clipboard_set"
            | "macro_execute"
    );

    if requires_auth && !conn.authenticated {
        stats.total_actions_rejected.fetch_add(1, Ordering::Relaxed);
        return unauthorized("Send authenticated hello before control messages");
    }

    match msg_type {
        "ping" => {
            let timestamp = msg.get("timestamp").and_then(|v| v.as_f64()).unwrap_or(0.0);
            serde_json::json!({
                "type": "pong",
                "timestamp": timestamp,
                "serverTime": chrono_now_ms()
            }).to_string()
        }

        "pair_request" => {
            let device_name = msg.get("deviceName")
                .and_then(|v| v.as_str())
                .unwrap_or("Unknown Phone");
            let device_id = msg.get("deviceId")
                .and_then(|v| v.as_str())
                .unwrap_or("");
            let pairing_secret = msg.get("pairingSecret")
                .and_then(|v| v.as_str())
                .unwrap_or("");

            log::info!("Pair request from {} ({})", device_name, device_id);

            let newly_paired = match pairing_auth.authenticate_or_pair(device_id, device_name, pairing_secret) {
                Ok(newly_paired) => newly_paired,
                Err(reason) => {
                    log::warn!("Pair request rejected from {} (id={}): {}", device_name, device_id, reason);
                    return serde_json::json!({
                        "type": "pair_response",
                        "accepted": false,
                        "companionName": hostname::get()
                            .map(|h| h.to_string_lossy().to_string())
                            .unwrap_or_else(|_| "LuminaDeck PC".to_string()),
                        "reason": reason
                    }).to_string();
                }
            };

            conn.authenticated = true;
            conn.device_id = Some(device_id.to_string());
            conn.device_name = Some(device_name.to_string());

            if newly_paired {
                if let Some(handle) = APP_HANDLE.get() {
                    match handle.emit("pairing-complete", ()) {
                        Ok(_) => log::info!("Emitted pairing-complete event for device {}", device_id),
                        Err(e) => log::error!("Failed to emit pairing-complete: {}", e),
                    }
                } else {
                    log::warn!("APP_HANDLE not initialised — can't emit pairing-complete");
                }
            }

            // Emit device identified event
            if let Some(handle) = APP_HANDLE.get() {
                let _ = handle.emit("device-identified", DeviceIdentifiedEvent {
                    device_name: device_name.to_string(),
                    device_id: device_id.to_string(),
                    peer: peer.to_string(),
                    protocol_version: "1.0.0".to_string(),
                });
            }

            let companion_name = hostname::get()
                .map(|h| h.to_string_lossy().to_string())
                .unwrap_or_else(|_| "LuminaDeck PC".to_string());

            serde_json::json!({
                "type": "pair_response",
                "accepted": true,
                "companionName": companion_name
            }).to_string()
        }

        "hello" => {
            let client_protocol_version = msg.get("protocolVersion")
                .and_then(|v| v.as_str())
                .unwrap_or("1.0.0");
            let client_app_version = msg.get("clientVersion")
                .and_then(|v| v.as_str())
                .unwrap_or("unknown");
            let device_name = msg.get("deviceName")
                .and_then(|v| v.as_str())
                .unwrap_or("Unknown");
            let device_id = msg.get("deviceId")
                .and_then(|v| v.as_str())
                .unwrap_or("");
            let pairing_secret = msg.get("pairingSecret")
                .and_then(|v| v.as_str())
                .unwrap_or("");

            // Negotiate protocol via semver. A client outside the supported
            // range gets an explicit error so it can prompt the user to
            // update rather than silently misbehave.
            let parsed_version = semver::Version::parse(client_protocol_version).ok();
            let req = semver::VersionReq::parse(MIN_CLIENT_PROTOCOL)
                .expect("MIN_CLIENT_PROTOCOL is a static valid range");
            let compatible = parsed_version
                .as_ref()
                .map(|v| req.matches(v))
                .unwrap_or(false);

            if !compatible {
                log::warn!(
                    "Hello rejected from {} (id={}): protocolVersion={} outside {}",
                    device_name, device_id, client_protocol_version, MIN_CLIENT_PROTOCOL
                );
                return serde_json::json!({
                    "type": "error",
                    "code": "UNAUTHORIZED",
                    "message": format!(
                        "Client protocol version {} not supported. Companion accepts {}.",
                        client_protocol_version, MIN_CLIENT_PROTOCOL
                    )
                }).to_string();
            }

            // Remember the negotiated version so later messages (e.g.
            // subscribe_profile) can gate on feature-specific ranges.
            conn.negotiated_version = parsed_version.clone();

            let newly_paired = match pairing_auth.authenticate_or_pair(device_id, device_name, pairing_secret) {
                Ok(newly_paired) => newly_paired,
                Err(reason) => {
                    log::warn!("Hello rejected from {} (id={}): {}", device_name, device_id, reason);
                    return unauthorized(&reason);
                }
            };

            conn.authenticated = true;
            conn.device_id = Some(device_id.to_string());
            conn.device_name = Some(device_name.to_string());

            if newly_paired {
                if let Some(handle) = APP_HANDLE.get() {
                    match handle.emit("pairing-complete", ()) {
                        Ok(_) => log::info!("Emitted pairing-complete event for device {}", device_id),
                        Err(e) => log::error!("Failed to emit pairing-complete: {}", e),
                    }
                } else {
                    log::warn!("APP_HANDLE not initialised — can't emit pairing-complete");
                }
            }

            // Emit device identified event
            if let Some(handle) = APP_HANDLE.get() {
                let _ = handle.emit("device-identified", DeviceIdentifiedEvent {
                    device_name: device_name.to_string(),
                    device_id: device_id.to_string(),
                    peer: peer.to_string(),
                    protocol_version: client_protocol_version.to_string(),
                });
            }

            log::info!(
                "Hello from {} (app v{}, protocol v{}, id={})",
                device_name, client_app_version, client_protocol_version, device_id
            );

            let companion_name = hostname::get()
                .map(|h| h.to_string_lossy().to_string())
                .unwrap_or_else(|_| "LuminaDeck PC".to_string());

            // v1.4: provision the per-device pair_key the iOS Widget /
            // Apple Watch Intent will use to sign /intent-execute calls.
            // Returned as hex so the phone can pass it to expo-secure-store.
            // Failures here degrade gracefully — Widget surface stays off
            // for this device but the WS path is unaffected.
            let intent_endpoint_value = if device_id.is_empty() {
                serde_json::Value::Null
            } else {
                match crate::intent_endpoint::get_or_create_pair_key(device_id) {
                    Ok(key) => serde_json::json!({
                        "port": 9878,
                        "pairKey": hex::encode(key),
                    }),
                    Err(e) => {
                        log::warn!("intent_endpoint key provisioning failed for {}: {}", device_id, e);
                        serde_json::Value::Null
                    }
                }
            };

            serde_json::json!({
                "type": "hello_ack",
                "protocolVersion": PROTOCOL_VERSION,
                "companionVersion": env!("CARGO_PKG_VERSION"),
                "companionName": companion_name,
                "capabilities": ADVERTISED_CAPABILITIES,
                "intentEndpoint": intent_endpoint_value,
            }).to_string()
        }

        "request_capabilities" => {
            // Phone's Plugins screen polls this when it mounts after the
            // initial hello/hello_ack round-trip — it can't see the
            // capabilities array sent on connect, so it asks again here.
            serde_json::json!({
                "type": "capabilities",
                "capabilities": ADVERTISED_CAPABILITIES,
            }).to_string()
        }

        "profile_sync" => {
            // Mobile sends its full rule list — server replaces the
            // global ruleset (last writer wins). The matcher task picks
            // up the new rules on the next active-window event.
            let rules = msg.get("rules").cloned().unwrap_or(serde_json::json!([]));
            log::info!(
                "profile_sync from {}: {} rule(s)",
                peer,
                rules.as_array().map(|a| a.len()).unwrap_or(0)
            );
            // Persist via the global helper exposed in lib.rs. We can't
            // directly grab AppState from here, so we emit a Tauri event
            // and let lib.rs do the storage. Keeps the server module
            // free of Tauri::State plumbing.
            if let Some(handle) = APP_HANDLE.get() {
                let _ = handle.emit("profile_sync_request", &rules);
            }
            serde_json::json!({
                "type": "subscribe_ack",
                "kind": "profile_rules"
            }).to_string()
        }

        "subscribe_profile" => {
            let Some(ver) = conn.negotiated_version.as_ref() else {
                return serde_json::json!({
                    "type": "error",
                    "code": "UNAUTHORIZED",
                    "message": "Send hello before subscribe_profile"
                }).to_string();
            };
            let feat_req = semver::VersionReq::parse(MIN_FEATURE_PROFILE_UPDATE)
                .expect("MIN_FEATURE_PROFILE_UPDATE is a static valid range");
            if !feat_req.matches(ver) {
                return serde_json::json!({
                    "type": "error",
                    "code": "UNSUPPORTED_ACTION",
                    "message": format!(
                        "profile_update requires client protocol {}",
                        MIN_FEATURE_PROFILE_UPDATE
                    )
                }).to_string();
            }
            conn.subscribed_to_profile = true;
            log::info!("Peer {} subscribed to profile_update", peer);
            serde_json::json!({
                "type": "subscribe_ack",
                "kind": "profile"
            }).to_string()
        }

        "text_input" => {
            let text = msg.get("text")
                .and_then(|v| v.as_str())
                .unwrap_or("");
            let id = msg.get("id")
                .and_then(|v| v.as_str())
                .unwrap_or("unknown");

            log::info!("text_input received from {}: {} chars", peer, text.len());

            // Phase B will implement actual text injection via SendInput.
            // For now, acknowledge success.
            serde_json::json!({
                "type": "execute_result",
                "id": id,
                "success": true,
                "info": "text_input acknowledged (injection pending Phase B)"
            }).to_string()
        }

        // ── Trackpad / mouse messages (v1.4.0+) ─────────────────────
        // Fire-and-forget. We acknowledge with an empty `{}` so the client's
        // onmessage handler ignores it (no `type` field) without us having to
        // change the handler signature to return Option<String>. Mouse
        // messages share the standard rate limiter at 4x normal capacity by
        // counting each event but tolerating bursts up to MOUSE_RATE_LIMIT.
        "mouse_move" => {
            if !rate_limiter.check_mouse(peer) {
                stats.total_actions_rejected.fetch_add(1, Ordering::Relaxed);
                return "{}".to_string();
            }
            let dx = msg.get("dx").and_then(|v| v.as_f64()).unwrap_or(0.0) as i32;
            let dy = msg.get("dy").and_then(|v| v.as_f64()).unwrap_or(0.0) as i32;
            let lock = msg.get("lock").and_then(|v| v.as_bool()).unwrap_or(false);
            // Defensive clamp — shared validation already rejects |delta|>200,
            // but parse-without-validate paths shouldn't open a hole.
            let dx = dx.clamp(-200, 200);
            let dy = dy.clamp(-200, 200);
            let _ = actions::mouse::move_relative(dx, dy, lock);
            "{}".to_string()
        }

        "mouse_click" => {
            if !rate_limiter.check_mouse(peer) {
                stats.total_actions_rejected.fetch_add(1, Ordering::Relaxed);
                return "{}".to_string();
            }
            let button = msg.get("button").and_then(|v| v.as_str()).unwrap_or("left");
            let state = msg.get("state").and_then(|v| v.as_str()).unwrap_or("click");
            if let Err(e) = actions::mouse::click(button, state) {
                log::warn!("mouse_click failed: {}", e);
            }
            "{}".to_string()
        }

        "mouse_scroll" => {
            if !rate_limiter.check_mouse(peer) {
                stats.total_actions_rejected.fetch_add(1, Ordering::Relaxed);
                return "{}".to_string();
            }
            let dx = msg.get("dx").and_then(|v| v.as_f64()).unwrap_or(0.0) as i32;
            let dy = msg.get("dy").and_then(|v| v.as_f64()).unwrap_or(0.0) as i32;
            let dx = dx.clamp(-200, 200);
            let dy = dy.clamp(-200, 200);
            let _ = actions::mouse::scroll(dx, dy);
            "{}".to_string()
        }

        "mouse_drag" => {
            if !rate_limiter.check_mouse(peer) {
                stats.total_actions_rejected.fetch_add(1, Ordering::Relaxed);
                return "{}".to_string();
            }
            let phase = msg.get("phase").and_then(|v| v.as_str()).unwrap_or("end");
            if let Err(e) = actions::mouse::drag(phase) {
                log::warn!("mouse_drag failed: {}", e);
            }
            "{}".to_string()
        }

        "execute" => {
            // Rate limit check
            if !rate_limiter.check(peer) {
                stats.total_actions_rejected.fetch_add(1, Ordering::Relaxed);
                return serde_json::json!({
                    "type": "error",
                    "code": "RATE_LIMITED",
                    "message": "Too many actions per second (max 50/sec)"
                }).to_string();
            }

            let id = msg.get("id").and_then(|v| v.as_str()).unwrap_or("unknown");
            let action_value = msg.get("action");

            match action_value {
                Some(action_json) => {
                    match serde_json::from_value::<actions::Action>(action_json.clone()) {
                        Ok(action) => {
                            match actions::execute_action(&action).await {
                                Ok(()) => {
                                    stats.total_actions_executed.fetch_add(1, Ordering::Relaxed);
                                    serde_json::json!({
                                        "type": "execute_result",
                                        "id": id,
                                        "success": true
                                    }).to_string()
                                }
                                Err(e) => {
                                    stats.total_actions_rejected.fetch_add(1, Ordering::Relaxed);
                                    serde_json::json!({
                                        "type": "execute_result",
                                        "id": id,
                                        "success": false,
                                        "error": e.to_string()
                                    }).to_string()
                                }
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

        "clipboard_set" => {
            // v1.4 — phone published a fresh clipboard value. Forward
            // into the broadcast bus where `clipboard_sync::spawn`
            // listens, applies it to the OS clipboard, and (if more than
            // one phone is paired) re-broadcasts to the others. Source
            // tag stays as the inbound value so we don't bounce back.
            let text = msg.get("text").and_then(|v| v.as_str()).unwrap_or("");
            if text.is_empty() {
                return serde_json::json!({}).to_string();
            }
            let source = msg.get("source").and_then(|v| v.as_str()).unwrap_or("phone");
            if let Some(tx) = BROADCAST_TX.get() {
                let _ = tx.send(BroadcastMessage::clipboard(source, text.to_string()));
            }
            // Empty body — phones already updated their local clipboard
            // before sending; we don't need to ack.
            serde_json::json!({}).to_string()
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

fn unauthorized(message: &str) -> String {
    serde_json::json!({
        "type": "error",
        "code": "UNAUTHORIZED",
        "message": message,
    })
    .to_string()
}
