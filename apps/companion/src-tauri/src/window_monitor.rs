use tauri::AppHandle;
use tauri::Emitter;
use serde::Serialize;
use std::sync::Arc;
use parking_lot::Mutex;

#[cfg(windows)]
use windows::Win32::UI::WindowsAndMessaging::GetForegroundWindow;
#[cfg(windows)]
use windows::Win32::Foundation::HWND;
#[cfg(windows)]
use windows::Win32::System::Threading::{
    OpenProcess, QueryFullProcessImageNameW, PROCESS_QUERY_LIMITED_INFORMATION,
};

const POLL_INTERVAL_MS: u64 = 2000;

/// Event emitted to the Tauri frontend and over WebSocket when the
/// foreground window changes.
#[derive(Clone, Debug, Serialize)]
pub struct ActiveWindowMessage {
    pub process_name: String,
    pub window_title: String,
}

/// Polls the foreground window every 2 seconds and emits events on change.
pub struct WindowMonitor {
    last_process: Arc<Mutex<String>>,
}

impl WindowMonitor {
    pub fn new() -> Self {
        Self {
            last_process: Arc::new(Mutex::new(String::new())),
        }
    }

    /// Spawn a background task that polls the foreground window.
    pub fn start(&self, app_handle: AppHandle) {
        let last = self.last_process.clone();

        tokio::spawn(async move {
            let mut interval =
                tokio::time::interval(std::time::Duration::from_millis(POLL_INTERVAL_MS));

            loop {
                interval.tick().await;

                let (process_name, window_title) = get_foreground_window_info();

                // Only emit when the foreground app actually changes.
                let mut prev = last.lock();
                if *prev == process_name {
                    continue;
                }
                *prev = process_name.clone();
                drop(prev);

                let msg = ActiveWindowMessage {
                    process_name: process_name.clone(),
                    window_title: window_title.clone(),
                };

                log::debug!("Active window changed: {} — {}", process_name, window_title);

                let _ = app_handle.emit("active-window-change", &msg);
            }
        });
    }
}

// ---------------------------------------------------------------------------
// Windows implementation
// ---------------------------------------------------------------------------

#[cfg(windows)]
fn get_foreground_window_info() -> (String, String) {
    unsafe {
        let hwnd: HWND = GetForegroundWindow();
        if hwnd.0 == std::ptr::null_mut() {
            return ("(none)".to_string(), String::new());
        }

        let window_title = get_window_title(hwnd);

        // HWND -> process ID
        let mut pid: u32 = 0;
        windows::Win32::UI::WindowsAndMessaging::GetWindowThreadProcessId(hwnd, Some(&mut pid));
        if pid == 0 {
            return ("(unknown)".to_string(), window_title);
        }

        let process_name = get_process_name(pid).unwrap_or_else(|| "(unknown)".to_string());

        (process_name, window_title)
    }
}

#[cfg(windows)]
fn get_window_title(hwnd: HWND) -> String {
    unsafe {
        let len =
            windows::Win32::UI::WindowsAndMessaging::GetWindowTextLengthW(hwnd) as usize;
        if len == 0 {
            return String::new();
        }

        let mut buf = vec![0u16; len + 1];
        let copied = windows::Win32::UI::WindowsAndMessaging::GetWindowTextW(hwnd, &mut buf);
        if copied == 0 {
            return String::new();
        }
        String::from_utf16_lossy(&buf[..copied as usize])
    }
}

#[cfg(windows)]
fn get_process_name(pid: u32) -> Option<String> {
    unsafe {
        let handle = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, false, pid).ok()?;

        let mut buf = [0u16; 260];
        let mut size = buf.len() as u32;

        let ok = QueryFullProcessImageNameW(
            handle,
            windows::Win32::System::Threading::PROCESS_NAME_FORMAT(0),
            windows::core::PWSTR(buf.as_mut_ptr()),
            &mut size,
        );

        let _ = windows::Win32::Foundation::CloseHandle(handle);

        if ok.is_err() {
            return None;
        }

        let full_path = String::from_utf16_lossy(&buf[..size as usize]);
        // Return just the exe filename.
        full_path
            .rsplit('\\')
            .next()
            .map(|s| s.to_string())
    }
}

// ---------------------------------------------------------------------------
// Non-Windows stub so the code compiles cross-platform.
// ---------------------------------------------------------------------------

#[cfg(not(windows))]
fn get_foreground_window_info() -> (String, String) {
    ("(unsupported)".to_string(), String::new())
}
