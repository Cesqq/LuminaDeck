mod actions;
mod server;
mod security;
mod discovery;
mod plugins;
mod window_monitor;
mod ws_bus;
mod stream_deck_import;
mod telemetry;
mod intent_endpoint;
mod intent_http;
mod clipboard_sync;

/// Toggle the shared-clipboard sync monitor. Called from Studio UI;
/// off by default for privacy. When `false` neither side publishes nor
/// applies clipboard updates — the monitor task stays alive but no-ops.
#[tauri::command]
fn set_clipboard_sync_enabled(enabled: bool) {
    clipboard_sync::set_enabled(enabled);
    log::info!("Clipboard sync: {}", if enabled { "enabled" } else { "disabled" });
}

/// Read the current toggle state — used by Studio UI to keep the
/// switch in sync after page reload.
#[tauri::command]
fn get_clipboard_sync_enabled() -> bool {
    clipboard_sync::is_enabled()
}

use plugins::Plugin;
use ws_bus::BroadcastMessage;

use tauri::{Listener, Manager};
use tauri::menu::{MenuBuilder, MenuItemBuilder};
use tauri::tray::TrayIconBuilder;
use security::pairing::{PairedDevice, QrPairingPayload};
use serde::Serialize;
use std::sync::Arc;
use parking_lot::Mutex;
use tokio::sync::{broadcast, RwLock};

/// Profile-switch rule sent by mobile clients (or set in Studio) — when
/// the foreground process matches `process_name`, the matcher emits a
/// `profile_switch` message with the bound `profile_id`.
#[derive(Clone, Debug, serde::Serialize, serde::Deserialize)]
pub struct ProfileSwitchRule {
    #[serde(rename = "processName")]
    pub process_name: String,
    #[serde(rename = "profileId")]
    pub profile_id: String,
}

/// Shared app state accessible from Tauri commands.
pub struct AppState {
    pub paired_devices: Arc<Mutex<Vec<PairedDevice>>>,
    pub active_pairing_secret_hash: Arc<Mutex<Option<String>>>,
    pub cert_fingerprint: Arc<Mutex<String>>,
    pub connected_count: Arc<Mutex<u32>>,
    pub server_started_at: Arc<Mutex<Option<u64>>>,
    pub discovery_manager: Arc<Mutex<Option<discovery::DiscoveryManager>>>,
    pub plugin_manager: Arc<RwLock<plugins::PluginManager>>,
    pub broadcast_tx: broadcast::Sender<BroadcastMessage>,
    pub profile_rules: Arc<Mutex<Vec<ProfileSwitchRule>>>,
}

impl Default for AppState {
    fn default() -> Self {
        let (broadcast_tx, _) = broadcast::channel(64);
        Self {
            paired_devices: Arc::new(Mutex::new(Vec::new())),
            active_pairing_secret_hash: Arc::new(Mutex::new(None)),
            cert_fingerprint: Arc::new(Mutex::new(String::new())),
            connected_count: Arc::new(Mutex::new(0)),
            server_started_at: Arc::new(Mutex::new(None)),
            discovery_manager: Arc::new(Mutex::new(None)),
            plugin_manager: Arc::new(RwLock::new(plugins::PluginManager::new())),
            broadcast_tx,
            profile_rules: Arc::new(Mutex::new(Vec::new())),
        }
    }
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ServerInfo {
    status: String,
    port: u16,
    ip: String,
    cert_fingerprint: String,
    connected_devices: u32,
    paired_count: usize,
    companion_version: String,
}

#[derive(Serialize)]
struct QrData {
    json: String,
    payload: QrPairingPayload,
}

// --- Tauri Commands ---

#[tauri::command]
fn get_server_info(state: tauri::State<'_, AppState>) -> ServerInfo {
    let fingerprint = state.cert_fingerprint.lock().clone();
    let connected = *state.connected_count.lock();
    let paired = state.paired_devices.lock().len();
    let ip = get_local_ip();

    ServerInfo {
        status: "running".to_string(),
        port: 9876,
        ip,
        cert_fingerprint: fingerprint,
        connected_devices: connected,
        paired_count: paired,
        companion_version: env!("CARGO_PKG_VERSION").to_string(),
    }
}

#[tauri::command]
fn get_server_status() -> String {
    "running".to_string()
}

#[tauri::command]
fn get_qr_pairing_data(state: tauri::State<'_, AppState>) -> Result<QrData, String> {
    let fingerprint = state.cert_fingerprint.lock().clone();
    if fingerprint.is_empty() {
        return Err("TLS certificate not yet generated".to_string());
    }

    let ip = get_local_ip();
    let pairing_secret = security::pairing::generate_pairing_secret();
    *state.active_pairing_secret_hash.lock() =
        Some(security::pairing::hash_pairing_secret(&pairing_secret));

    if let Some(dm) = state.discovery_manager.lock().as_ref() {
        if !dm.is_broadcasting() {
            if let Err(e) = dm.start_broadcast() {
                log::warn!("mDNS pairing broadcast failed while showing QR: {}", e);
            }
        }
    }

    // Use plain WS port for mobile compatibility, but require the QR
    // pairing secret in the hello handshake before any control messages run.
    let payload = QrPairingPayload::new(ip, 9877, fingerprint, pairing_secret);
    let json = payload.to_qr_string();

    Ok(QrData { json, payload })
}

#[tauri::command]
fn get_paired_devices(state: tauri::State<'_, AppState>) -> Vec<PairedDevice> {
    state.paired_devices.lock().clone()
}

#[tauri::command]
fn add_paired_device(
    state: tauri::State<'_, AppState>,
    name: String,
) -> Result<PairedDevice, String> {
    let mut devices = state.paired_devices.lock();
    if devices.len() >= security::pairing::MAX_PAIRED_DEVICES {
        return Err(format!(
            "Maximum {} paired devices reached",
            security::pairing::MAX_PAIRED_DEVICES
        ));
    }

    let device = PairedDevice {
        id: uuid::Uuid::new_v4().to_string(),
        name,
        paired_at: chrono_now_iso(),
        last_seen: Some(chrono_now_iso()),
        pairing_secret_hash: None,
    };

    devices.push(device.clone());
    security::pairing::save_paired_devices(&devices);
    Ok(device)
}

#[tauri::command]
fn remove_paired_device(
    state: tauri::State<'_, AppState>,
    device_id: String,
) -> Result<(), String> {
    let mut devices = state.paired_devices.lock();
    let before = devices.len();
    devices.retain(|d| d.id != device_id);
    if devices.len() == before {
        return Err("Device not found".to_string());
    }
    security::pairing::save_paired_devices(&devices);
    Ok(())
}

#[tauri::command]
fn get_network_info() -> Vec<NetworkInterface> {
    get_network_interfaces()
}

#[tauri::command]
fn start_pairing_broadcast(state: tauri::State<'_, AppState>) -> Result<String, String> {
    let mut guard = state.discovery_manager.lock();
    if guard.is_none() {
        *guard = Some(
            discovery::DiscoveryManager::new(9877)
                .map_err(|e| format!("mDNS init failed: {}", e))?,
        );
    }

    let Some(dm) = guard.as_ref() else {
        return Err("Discovery manager unavailable".to_string());
    };

    if !dm.is_broadcasting() {
        dm.start_broadcast()
            .map_err(|e| format!("mDNS broadcast failed: {}", e))?;
    }
    log::info!("Pairing broadcast started");
    Ok("broadcasting".to_string())
}

#[tauri::command]
fn stop_pairing_broadcast(state: tauri::State<'_, AppState>) -> Result<String, String> {
    if let Some(dm) = state.discovery_manager.lock().as_ref() {
        if dm.is_broadcasting() {
            dm.stop_broadcast()
                .map_err(|e| format!("mDNS stop failed: {}", e))?;
        }
    }
    log::info!("Pairing broadcast stopped");
    Ok("stopped".to_string())
}

#[tauri::command]
async fn get_plugin_status(
    state: tauri::State<'_, AppState>,
) -> Result<Vec<plugins::PluginStatus>, String> {
    Ok(state.plugin_manager.read().await.status())
}

#[tauri::command]
async fn test_plugin(
    state: tauri::State<'_, AppState>,
    name: String,
) -> Result<bool, String> {
    // tokio::sync::RwLock guards are Send so we can safely hold a read
    // lock across the plugin's async `test()` call. Test calls are bounded
    // (few-second timeouts inside the plugin) so this is an acceptable
    // amount of contention.
    let pm = state.plugin_manager.read().await;
    let plugin = pm.get_by_name(&name).ok_or_else(|| format!("Plugin not found: {name}"))?;
    Ok(plugin.test().await.is_ok())
}

#[tauri::command]
async fn get_plugin_config(
    state: tauri::State<'_, AppState>,
    name: String,
) -> Result<serde_json::Value, String> {
    let pm = state.plugin_manager.read().await;
    let plugin = pm.get_by_name(&name).ok_or_else(|| format!("Plugin not found: {name}"))?;
    Ok(serde_json::json!({
        "schema": plugin.config_schema(),
        "config": plugin.current_config(),
    }))
}

#[tauri::command]
async fn configure_plugin(
    state: tauri::State<'_, AppState>,
    name: String,
    config: serde_json::Value,
) -> Result<(), String> {
    let mut pm = state.plugin_manager.write().await;
    let plugin = pm.get_by_name_mut(&name).ok_or_else(|| format!("Plugin not found: {name}"))?;
    let result = plugin.configure(config).await;
    if result.is_ok() {
        telemetry::track(
            "plugin_configured",
            serde_json::json!({ "plugin": name }),
        );
    }
    result
}

// ── Auto-profile rules ─────────────────────────────────────

#[tauri::command]
fn get_profile_rules(state: tauri::State<'_, AppState>) -> Vec<ProfileSwitchRule> {
    state.profile_rules.lock().clone()
}

#[tauri::command]
fn set_profile_rules(
    state: tauri::State<'_, AppState>,
    rules: Vec<ProfileSwitchRule>,
) -> Result<(), String> {
    *state.profile_rules.lock() = rules.clone();
    save_profile_rules(&rules);
    Ok(())
}

/// Read the most recently observed foreground window. Studio uses this
/// to populate the "Use this app's current window" capture button.
#[tauri::command]
fn get_current_active_window() -> Option<String> {
    LAST_ACTIVE_WINDOW.lock().clone()
}

// ── Profile import/export + Stream Deck importer ───────────

#[tauri::command]
async fn export_profile_to_file(app: tauri::AppHandle) -> Result<Option<String>, String> {
    use tauri_plugin_dialog::DialogExt;
    let path = app
        .dialog()
        .file()
        .set_file_name("luminadeck-profile.json")
        .add_filter("LuminaDeck profile", &["json"])
        .blocking_save_file();
    let Some(file_path) = path else { return Ok(None) };
    let profile = load_active_profile();
    let json = serde_json::to_string_pretty(&profile).map_err(|e| e.to_string())?;
    let str_path = file_path.to_string();
    std::fs::write(&str_path, json).map_err(|e| e.to_string())?;
    Ok(Some(str_path))
}

#[tauri::command]
async fn import_profile_from_file(
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
) -> Result<Option<serde_json::Value>, String> {
    use tauri_plugin_dialog::DialogExt;
    let path = app
        .dialog()
        .file()
        .add_filter("LuminaDeck profile", &["json"])
        .blocking_pick_file();
    let Some(file_path) = path else { return Ok(None) };
    let str_path = file_path.to_string();
    let data = std::fs::read_to_string(&str_path).map_err(|e| e.to_string())?;
    let profile: serde_json::Value = serde_json::from_str(&data).map_err(|e| e.to_string())?;

    // Minimal validation + persist
    for required in ["id", "name", "pages", "theme", "createdAt", "updatedAt"] {
        if profile.get(required).is_none() {
            return Err(format!("invalid profile: missing {required}"));
        }
    }
    let write_path = active_profile_path();
    if let Some(parent) = write_path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let pretty = serde_json::to_string_pretty(&profile).map_err(|e| e.to_string())?;
    std::fs::write(&write_path, pretty).map_err(|e| e.to_string())?;

    // Broadcast so connected mobile clients pick it up.
    broadcast_profile_update(&state.broadcast_tx, &profile, "studio");
    Ok(Some(profile))
}

#[tauri::command]
async fn import_stream_deck_profile(
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
) -> Result<Option<serde_json::Value>, String> {
    use tauri_plugin_dialog::DialogExt;
    let path = app
        .dialog()
        .file()
        .add_filter("Hardware deck profile", &["streamDeckProfile", "zip"])
        .blocking_pick_file();
    let Some(file_path) = path else { return Ok(None) };
    let str_path = file_path.to_string();
    let bytes = std::fs::read(&str_path).map_err(|e| e.to_string())?;
    let result = match stream_deck_import::import_from_bytes(&bytes) {
        Ok(r) => r,
        Err(e) => {
            telemetry::track(
                "import_streamdeck_profile",
                serde_json::json!({ "success": false }),
            );
            return Err(e);
        }
    };

    // Broadcast the imported profile so phones pick it up.
    broadcast_profile_update(&state.broadcast_tx, &result.profile, "studio");

    telemetry::track(
        "import_streamdeck_profile",
        serde_json::json!({
            "success": true,
            "importedCount": result.imported_count,
            "unsupportedCount": result.unsupported.len(),
        }),
    );

    Ok(Some(serde_json::json!({
        "profile": result.profile,
        "importedCount": result.imported_count,
        "unsupported": result.unsupported,
        "warnings": result.warnings,
    })))
}

// ── Profile editor (Studio drag/drop) ──────────────────────────

#[tauri::command]
fn get_active_profile() -> serde_json::Value {
    load_active_profile()
}

#[tauri::command]
fn save_active_profile(
    state: tauri::State<'_, AppState>,
    profile: serde_json::Value,
) -> Result<(), String> {
    // Minimal shape check — full schema validation lives on the client
    // (Zod) and on message ingress when we accept a mobile-side profile.
    for required in ["id", "name", "pages", "theme", "createdAt", "updatedAt"] {
        if profile.get(required).is_none() {
            return Err(format!("profile missing required field: {required}"));
        }
    }
    if !profile["pages"].is_array() {
        return Err("profile.pages must be an array".to_string());
    }

    let path = active_profile_path();
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let json = serde_json::to_string_pretty(&profile).map_err(|e| e.to_string())?;
    std::fs::write(&path, json).map_err(|e| e.to_string())?;

    broadcast_profile_update(&state.broadcast_tx, &profile, "studio");
    Ok(())
}

#[derive(Serialize)]
struct NetworkInterface {
    name: String,
    ip: String,
}

// --- Helpers ---

fn get_local_ip() -> String {
    // Try to find a non-loopback IPv4 address
    if let Ok(socket) = std::net::UdpSocket::bind("0.0.0.0:0") {
        if socket.connect("8.8.8.8:80").is_ok() {
            if let Ok(addr) = socket.local_addr() {
                return addr.ip().to_string();
            }
        }
    }
    "127.0.0.1".to_string()
}

fn get_network_interfaces() -> Vec<NetworkInterface> {
    // Simplified: return the primary interface
    let ip = get_local_ip();
    vec![NetworkInterface {
        name: "Primary".to_string(),
        ip,
    }]
}

fn chrono_now_iso() -> String {
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();
    // Simple ISO format without chrono dependency
    format!("{}Z", now)
}

fn active_profile_path() -> std::path::PathBuf {
    directories::ProjectDirs::from("com", "luminadeck", "companion")
        .map(|dirs| dirs.data_dir().join("active_profile.json"))
        .unwrap_or_else(|| std::path::PathBuf::from("active_profile.json"))
}

fn profile_rules_path() -> std::path::PathBuf {
    directories::ProjectDirs::from("com", "luminadeck", "companion")
        .map(|dirs| dirs.data_dir().join("profile_rules.json"))
        .unwrap_or_else(|| std::path::PathBuf::from("profile_rules.json"))
}

fn load_profile_rules() -> Vec<ProfileSwitchRule> {
    std::fs::read_to_string(profile_rules_path())
        .ok()
        .and_then(|s| serde_json::from_str::<Vec<ProfileSwitchRule>>(&s).ok())
        .unwrap_or_default()
}

fn save_profile_rules(rules: &[ProfileSwitchRule]) {
    let path = profile_rules_path();
    if let Some(parent) = path.parent() {
        let _ = std::fs::create_dir_all(parent);
    }
    if let Ok(json) = serde_json::to_string_pretty(rules) {
        let _ = std::fs::write(&path, json);
    }
}

/// Cached most-recent foreground window process name. Updated by the
/// auto-profile matcher task; read by `get_current_active_window`.
static LAST_ACTIVE_WINDOW: std::sync::LazyLock<Mutex<Option<String>>> =
    std::sync::LazyLock::new(|| Mutex::new(None));

/// Last profile_id we emitted a switch to — used to dedupe successive
/// matches on the same window.
static LAST_SWITCHED_PROFILE: std::sync::LazyLock<Mutex<Option<String>>> =
    std::sync::LazyLock::new(|| Mutex::new(None));

/// Load the active profile from disk. On first run or if the file is
/// unreadable, return a sensible empty default so the editor has something
/// to render against.
fn load_active_profile() -> serde_json::Value {
    if let Ok(data) = std::fs::read_to_string(active_profile_path()) {
        if let Ok(v) = serde_json::from_str::<serde_json::Value>(&data) {
            return v;
        }
    }
    default_profile()
}

fn default_profile() -> serde_json::Value {
    let now = chrono_now_iso();
    serde_json::json!({
        "id": "default",
        "name": "Default Profile",
        "pages": [{
            "id": "page-1",
            "name": "Page 1",
            "buttons": [],
            "layout": "3x4"
        }],
        "theme": "obsidian",
        "createdAt": now,
        "updatedAt": now
    })
}

/// Serialise a ProfileConfig as a `profile_update` WS message and fan it
/// out on the broadcast bus. Per-connection filters deliver it only to
/// v1.2.0+ clients that explicitly sent `subscribe_profile`.
fn broadcast_profile_update(
    tx: &broadcast::Sender<BroadcastMessage>,
    profile: &serde_json::Value,
    source: &str,
) {
    let msg = serde_json::json!({
        "type": "profile_update",
        "profile": profile,
        "source": source,
    });
    let _ = tx.send(BroadcastMessage::profile_update(msg.to_string()));
}

// --- App Entry ---

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let _ = env_logger::try_init();

    // Initialise telemetry with opt-in off. A future Studio settings pass
    // will wire a persisted toggle; for now `track()` is a no-op in release
    // builds, and the ring buffer still fills so we can preview payloads.
    telemetry::init(false);
    telemetry::track(
        "app_open",
        serde_json::json!({ "surface": "studio" }),
    );

    let app_state = AppState::default();

    // Load persisted paired devices
    {
        let loaded = security::pairing::load_paired_devices();
        *app_state.paired_devices.lock() = loaded;
    }

    // Load persisted auto-profile rules
    {
        let loaded = load_profile_rules();
        *app_state.profile_rules.lock() = loaded;
    }

    // Clone Arc'd handles BEFORE moving app_state into .manage() so the
    // setup closure (which spawns matcher tasks) can hold its own
    // references without needing the State<AppState> dance.
    let rules_for_matcher = app_state.profile_rules.clone();
    let tx_for_matcher = app_state.broadcast_tx.clone();
    let rules_for_sync = app_state.profile_rules.clone();

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(app_state)
        .invoke_handler(tauri::generate_handler![
            get_server_status,
            get_server_info,
            get_qr_pairing_data,
            get_paired_devices,
            add_paired_device,
            remove_paired_device,
            get_network_info,
            start_pairing_broadcast,
            stop_pairing_broadcast,
            get_plugin_status,
            test_plugin,
            get_plugin_config,
            configure_plugin,
            get_active_profile,
            save_active_profile,
            get_profile_rules,
            set_profile_rules,
            get_current_active_window,
            export_profile_to_file,
            import_profile_from_file,
            import_stream_deck_profile,
            set_clipboard_sync_enabled,
            get_clipboard_sync_enabled,
        ])
        .setup(move |app| {
            let handle = app.handle().clone();
            let state: tauri::State<'_, AppState> = app.state();

            // Generate TLS cert and store fingerprint
            match security::tls::ensure_tls_cert() {
                Ok(cert_der) => {
                    let fp = security::cert_fingerprint(&cert_der);
                    log::info!("TLS cert fingerprint: {}", fp);
                    *state.cert_fingerprint.lock() = fp;
                }
                Err(e) => {
                    log::error!("Failed to generate TLS cert: {}", e);
                }
            }

            // Initialise plugin system. Plugins are stored in shared state so
            // Tauri commands (`get_plugin_status`, `test_plugin`) can inspect
            // them at runtime.
            {
                let mut obs = plugins::obs::ObsPlugin::new();
                let mut discord = plugins::discord::DiscordPlugin::new();

                tauri::async_runtime::block_on(async {
                    if let Err(e) = obs.init().await {
                        log::warn!("OBS plugin init error: {}", e);
                    }
                    if let Err(e) = discord.init().await {
                        log::warn!("Discord plugin init error: {}", e);
                    }
                });

                tauri::async_runtime::block_on(async {
                    let mut pm = state.plugin_manager.write().await;
                    pm.register(Box::new(obs));
                    pm.register(Box::new(discord));

                    for (name, avail) in pm.status_summary() {
                        log::info!("Plugin '{}': available={}", name, avail);
                    }
                    log::info!("Plugin capabilities: {:?}", pm.capabilities());
                });
            }

            // Start window monitor — pass the broadcast sender so window
            // changes are relayed to every connected mobile client for
            // auto-profile rule matching.
            {
                let monitor = window_monitor::WindowMonitor::new();
                monitor.start(handle.clone(), Some(state.broadcast_tx.clone()));
                log::info!("Window monitor started (poll every 2 s)");
            }

            // Spawn the auto-profile matcher: subscribes to active-window
            // events, looks up the global rule list, and emits a
            // `profile_switch` broadcast when a rule matches. Dedupes by
            // last-emitted profile so the same switch isn't repeated on
            // every poll.
            {
                let rules = rules_for_matcher.clone();
                let tx = tx_for_matcher.clone();
                handle.listen("active-window-change", move |event: tauri::Event| {
                    let payload: serde_json::Value =
                        serde_json::from_str(event.payload()).unwrap_or(serde_json::json!({}));
                    let process = payload
                        .get("process_name")
                        .and_then(|v| v.as_str())
                        .map(|s| s.to_string());
                    if let Some(p) = process.as_ref() {
                        *LAST_ACTIVE_WINDOW.lock() = Some(p.clone());
                    }
                    let rules_snapshot = rules.lock().clone();
                    let Some(process) = process else { return };
                    let proc_lc = process.to_lowercase();
                    let matched = rules_snapshot.iter().find(|r| {
                        r.process_name.to_lowercase() == proc_lc
                    });
                    if let Some(rule) = matched {
                        // Dedupe: don't re-emit the same profile back-to-back.
                        let mut last = LAST_SWITCHED_PROFILE.lock();
                        if last.as_deref() == Some(rule.profile_id.as_str()) {
                            return;
                        }
                        *last = Some(rule.profile_id.clone());
                        let json = serde_json::json!({
                            "type": "profile_switch",
                            "profileId": rule.profile_id,
                            "reason": format!("auto: {}", process),
                        }).to_string();
                        let _ = tx.send(BroadcastMessage::profile_switch(json));
                    }
                });
            }

            // Apply mobile-pushed profile_sync requests to the global
            // rule list. server.rs emits a Tauri event when it receives
            // the message; this listener persists + replaces.
            {
                let rules_state = rules_for_sync.clone();
                handle.listen("profile_sync_request", move |event: tauri::Event| {
                    let new_rules: Vec<ProfileSwitchRule> =
                        serde_json::from_str(event.payload()).unwrap_or_default();
                    *rules_state.lock() = new_rules.clone();
                    save_profile_rules(&new_rules);
                    log::info!("Auto-profile rules updated from mobile: {} rule(s)", new_rules.len());
                });
            }

            // Stop pairing discovery after a new device has authenticated
            // with the one-time QR secret.
            {
                let discovery_state = state.discovery_manager.clone();
                handle.listen("pairing-complete", move |_event: tauri::Event| {
                    if let Some(dm) = discovery_state.lock().as_ref() {
                        if dm.is_broadcasting() {
                            if let Err(e) = dm.stop_broadcast() {
                                log::warn!("mDNS stop after pairing failed: {}", e);
                            }
                        }
                    }
                });
            }

            // Start HTTP listener for iOS Widget + Watch /intent-execute
            // (port 9878). Hand-rolled HTTP/1.1 — auth + dispatch contract
            // lives in intent_endpoint.rs.
            intent_http::spawn();

            // Start shared-clipboard sync monitor. Default disabled until
            // the user toggles `set_clipboard_sync_enabled` from Studio.
            clipboard_sync::spawn(state.broadcast_tx.clone());

            // Initialise mDNS discovery, but do not broadcast until the
            // user explicitly starts pairing mode in Studio. This avoids
            // advertising a controllable LAN service all the time.
            match discovery::DiscoveryManager::new(9877) {
                Ok(dm) => {
                    *state.discovery_manager.lock() = Some(dm);
                }
                Err(e) => log::error!("mDNS init failed: {}", e),
            }

            // Setup system tray with context menu
            let show_item = MenuItemBuilder::with_id("show", "Show Window").build(app)?;
            let hide_item = MenuItemBuilder::with_id("hide", "Hide Window").build(app)?;
            let quit_item = MenuItemBuilder::with_id("quit", "Quit").build(app)?;

            let tray_menu = MenuBuilder::new(app)
                .item(&show_item)
                .item(&hide_item)
                .separator()
                .item(&quit_item)
                .build()?;

            // Explicitly set the tray icon from the app bundle's default
            // window icon (declared in `tauri.conf.json -> bundle.icon`).
            // Without this, Tauri v2's TrayIconBuilder ships a blank icon
            // since we removed the now-deprecated `app.trayIcon` config
            // stanza (which was creating a duplicate tray entry).
            let tray_icon = app
                .default_window_icon()
                .cloned()
                .ok_or("missing bundle icon for tray")?;
            let _ = TrayIconBuilder::new()
                .tooltip("Lumina Deck Studio")
                .icon(tray_icon)
                .menu(&tray_menu)
                .on_menu_event(|app, event| {
                    match event.id().as_ref() {
                        "show" => {
                            if let Some(window) = app.get_webview_window("main") {
                                let _ = window.show();
                                let _ = window.set_focus();
                            }
                        }
                        "hide" => {
                            if let Some(window) = app.get_webview_window("main") {
                                let _ = window.hide();
                            }
                        }
                        "quit" => {
                            app.exit(0);
                        }
                        _ => {}
                    }
                })
                .on_tray_icon_event(|tray, event| {
                    if let tauri::tray::TrayIconEvent::Click {
                        button: tauri::tray::MouseButton::Left,
                        button_state: tauri::tray::MouseButtonState::Up,
                        ..
                    } = event
                    {
                        let app = tray.app_handle();
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                })
                .build(app)?;

            // Show the main window
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
            }

            // Start WebSocket server in background. Pass the broadcast
            // sender so per-connection tasks can fan out events from
            // window_monitor / auto-profile.
            let broadcast_tx_for_server = state.broadcast_tx.clone();
            let paired_devices_for_server = state.paired_devices.clone();
            let active_pairing_secret_for_server = state.active_pairing_secret_hash.clone();
            tauri::async_runtime::spawn(async move {
                if let Err(e) = server::start_server(
                    handle,
                    broadcast_tx_for_server,
                    paired_devices_for_server,
                    active_pairing_secret_for_server,
                ).await {
                    log::error!("WebSocket server error: {}", e);
                }
            });

            let local_ip = get_local_ip();
            log::info!("LuminaDeck Studio started");
            log::info!("Local IP: {} | Port: 9876 | Connect from phone: wss://{}:9876", local_ip, local_ip);
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
