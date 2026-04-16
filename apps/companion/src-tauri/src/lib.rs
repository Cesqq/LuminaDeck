mod actions;
mod server;
mod security;
mod discovery;

#[tauri::command]
fn get_server_status() -> String {
    "running".to_string()
}

#[tauri::command]
fn get_paired_devices() -> Vec<String> {
    // TODO: Return actual paired device list
    vec![]
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            get_server_status,
            get_paired_devices,
        ])
        .setup(|app| {
            let handle = app.handle().clone();

            // Start WebSocket server in background
            tauri::async_runtime::spawn(async move {
                if let Err(e) = server::start_server(handle).await {
                    log::error!("WebSocket server error: {}", e);
                }
            });

            log::info!("LuminaDeck Companion started");
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
