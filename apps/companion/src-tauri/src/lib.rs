mod actions;
mod server;
mod security;
mod discovery;
mod plugins;
mod window_monitor;

use plugins::Plugin;

use tauri::Manager;
use tauri::menu::{MenuBuilder, MenuItemBuilder};
use tauri::tray::TrayIconBuilder;
use security::pairing::{PairedDevice, QrPairingPayload};
use serde::Serialize;
use std::sync::Arc;
use parking_lot::Mutex;

/// Shared app state accessible from Tauri commands.
pub struct AppState {
    pub paired_devices: Arc<Mutex<Vec<PairedDevice>>>,
    pub cert_fingerprint: Arc<Mutex<String>>,
    pub connected_count: Arc<Mutex<u32>>,
    pub server_started_at: Arc<Mutex<Option<u64>>>,
    pub discovery_manager: Arc<Mutex<Option<discovery::DiscoveryManager>>>,
}

impl Default for AppState {
    fn default() -> Self {
        Self {
            paired_devices: Arc::new(Mutex::new(Vec::new())),
            cert_fingerprint: Arc::new(Mutex::new(String::new())),
            connected_count: Arc::new(Mutex::new(0)),
            server_started_at: Arc::new(Mutex::new(None)),
            discovery_manager: Arc::new(Mutex::new(None)),
        }
    }
}

#[derive(Serialize)]
struct ServerInfo {
    status: String,
    port: u16,
    ip: String,
    cert_fingerprint: String,
    connected_devices: u32,
    paired_count: usize,
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
    // Use plain WS port for mobile (iOS rejects self-signed TLS certs)
    let payload = QrPairingPayload::new(ip, 9877, fingerprint);
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
    };

    devices.push(device.clone());
    save_paired_devices(&devices);
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
    save_paired_devices(&devices);
    Ok(())
}

#[tauri::command]
fn get_network_info() -> Vec<NetworkInterface> {
    get_network_interfaces()
}

#[tauri::command]
fn start_pairing_broadcast() -> Result<String, String> {
    // In production this would toggle the DiscoveryManager
    // For now, log and return success
    log::info!("Pairing broadcast started");
    Ok("broadcasting".to_string())
}

#[tauri::command]
fn stop_pairing_broadcast() -> Result<String, String> {
    log::info!("Pairing broadcast stopped");
    Ok("stopped".to_string())
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

fn devices_path() -> std::path::PathBuf {
    directories::ProjectDirs::from("com", "luminadeck", "companion")
        .map(|dirs| dirs.data_dir().join("paired_devices.json"))
        .unwrap_or_else(|| std::path::PathBuf::from("paired_devices.json"))
}

fn load_paired_devices() -> Vec<PairedDevice> {
    let path = devices_path();
    if let Ok(data) = std::fs::read_to_string(&path) {
        serde_json::from_str(&data).unwrap_or_default()
    } else {
        Vec::new()
    }
}

fn save_paired_devices(devices: &[PairedDevice]) {
    let path = devices_path();
    if let Some(parent) = path.parent() {
        let _ = std::fs::create_dir_all(parent);
    }
    if let Ok(json) = serde_json::to_string_pretty(devices) {
        let _ = std::fs::write(&path, json);
    }
}

// --- App Entry ---

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let _ = env_logger::try_init();

    let app_state = AppState::default();

    // Load persisted paired devices
    {
        let loaded = load_paired_devices();
        *app_state.paired_devices.lock() = loaded;
    }

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
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
        ])
        .setup(|app| {
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

            // Initialise plugin system
            {
                let mut pm = plugins::PluginManager::new();

                let mut obs = plugins::obs::ObsPlugin::new();
                let mut discord = plugins::discord::DiscordPlugin::new();

                // Init plugins asynchronously via Tauri's runtime
                tauri::async_runtime::block_on(async {
                    if let Err(e) = obs.init().await {
                        log::warn!("OBS plugin init error: {}", e);
                    }
                    if let Err(e) = discord.init().await {
                        log::warn!("Discord plugin init error: {}", e);
                    }
                });

                pm.register(Box::new(obs));
                pm.register(Box::new(discord));

                for (name, avail) in pm.status_summary() {
                    log::info!("Plugin '{}': available={}", name, avail);
                }

                log::info!(
                    "Plugin capabilities: {:?}",
                    pm.capabilities()
                );
            }

            // Start window monitor
            {
                let monitor = window_monitor::WindowMonitor::new();
                monitor.start(handle.clone());
                log::info!("Window monitor started (poll every 2 s)");
            }

            // Start mDNS discovery broadcast
            match discovery::DiscoveryManager::new(9877) {
                Ok(dm) => {
                    if let Err(e) = dm.start_broadcast() {
                        log::error!("mDNS broadcast failed: {}", e);
                    }
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

            let _ = TrayIconBuilder::new()
                .tooltip("LuminaDeck Companion")
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

            // Start WebSocket server in background
            tauri::async_runtime::spawn(async move {
                if let Err(e) = server::start_server(handle).await {
                    log::error!("WebSocket server error: {}", e);
                }
            });

            let local_ip = get_local_ip();
            log::info!("LuminaDeck Companion started");
            log::info!("Local IP: {} | Port: 9876 | Connect from iPhone: wss://{}:9876", local_ip, local_ip);
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
