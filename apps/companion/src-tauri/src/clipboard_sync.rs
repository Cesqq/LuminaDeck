//! Shared clipboard sync — companion side. v1.4+.
//!
//! Polls the Windows clipboard once per second. When the contents change
//! (detected by the OS clipboard sequence number, exposed by `arboard`'s
//! string equality + a stored "last seen" value), we broadcast a
//! `clipboard_set` message to all connected phones. On inbound
//! `clipboard_set` messages from a phone, we update the OS clipboard.
//!
//! Cycle-break: when we apply a phone-sourced value, we update the
//! `last_seen` cache to the new value so the next poll doesn't bounce it
//! back as if it were a fresh local change.
//!
//! Privacy: gated by a runtime toggle (`SHOULD_SYNC`) the user flips from
//! the Studio UI. Default off — turning it on requires an explicit click.

use crate::ws_bus::{BroadcastKind, BroadcastMessage};

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::Duration;

use parking_lot::Mutex;
use tokio::sync::broadcast;

const POLL_INTERVAL: Duration = Duration::from_millis(1000);

/// Runtime-toggleable enable flag. The Studio UI flips this via a Tauri
/// command; off by default for privacy.
static SHOULD_SYNC: AtomicBool = AtomicBool::new(false);

pub fn set_enabled(enabled: bool) {
    SHOULD_SYNC.store(enabled, Ordering::Relaxed);
}

pub fn is_enabled() -> bool {
    SHOULD_SYNC.load(Ordering::Relaxed)
}

/// Spawn the clipboard monitor. Owns its own arboard instance because
/// the OS clipboard handle isn't `Send` between threads — we keep the
/// instance pinned to a single tokio task.
///
/// `bus_tx` is the WS broadcast channel; we publish `clipboard_set`
/// messages tagged as `BroadcastKind::Clipboard` so the WS server
/// dispatches them to every connected phone (and not back into other
/// internal subsystems that don't care about clipboard).
pub fn spawn(bus_tx: broadcast::Sender<BroadcastMessage>) {
    let last_seen: Arc<Mutex<Option<String>>> = Arc::new(Mutex::new(None));

    // Inbound listener — convert `clipboard_set` from phone into a local
    // OS clipboard write. Subscribe BEFORE spawning the polling task so
    // we don't miss messages that arrive during startup.
    //
    // Uses `tauri::async_runtime::spawn` (not `tokio::spawn`) because this
    // is called from Tauri's setup hook, which runs on a thread that doesn't
    // have a Tokio runtime in TLS. The inner `tokio::spawn` further down the
    // task tree is fine because it runs inside this outer task's context.
    let mut bus_rx = bus_tx.subscribe();
    let inbound_last_seen = last_seen.clone();
    tauri::async_runtime::spawn(async move {
        loop {
            match bus_rx.recv().await {
                Ok(msg) => {
                    if msg.kind != BroadcastKind::Clipboard {
                        continue;
                    }
                    if !is_enabled() {
                        continue;
                    }
                    // Parse the JSON to discriminate between our own
                    // outbound messages (source="pc", we re-receive them
                    // because the broadcast channel is loopback) and
                    // phone-sourced messages we should apply.
                    let Ok(parsed): Result<serde_json::Value, _> =
                        serde_json::from_str(&msg.json)
                    else {
                        continue;
                    };
                    if parsed.get("source").and_then(|v| v.as_str()) == Some("pc") {
                        continue;
                    }
                    let text = parsed
                        .get("text")
                        .and_then(|v| v.as_str())
                        .unwrap_or("")
                        .to_string();
                    if text.is_empty() {
                        continue;
                    }
                    // Apply — but only if it differs from what we already
                    // have on the clipboard (cycle-break belt-and-suspenders).
                    let already = inbound_last_seen.lock().clone();
                    if already.as_deref() == Some(text.as_str()) {
                        continue;
                    }
                    if let Ok(mut cb) = arboard::Clipboard::new() {
                        if cb.set_text(text.clone()).is_ok() {
                            *inbound_last_seen.lock() = Some(text);
                        }
                    }
                }
                Err(broadcast::error::RecvError::Lagged(_)) => continue,
                Err(broadcast::error::RecvError::Closed) => break,
            }
        }
    });

    // Outbound poller — detect local clipboard changes and broadcast.
    tauri::async_runtime::spawn(async move {
        let mut interval = tokio::time::interval(POLL_INTERVAL);
        loop {
            interval.tick().await;
            if !is_enabled() {
                continue;
            }
            // Reopening arboard on each poll is cheap on Windows (it
            // just calls OpenClipboard inside a brief retry loop) and
            // avoids holding a process-wide lock between ticks.
            let Ok(mut cb) = arboard::Clipboard::new() else {
                continue;
            };
            let current = match cb.get_text() {
                Ok(t) => t,
                Err(_) => continue, // empty / non-text / momentary contention
            };
            if current.is_empty() {
                continue;
            }
            let mut guard = last_seen.lock();
            if guard.as_deref() == Some(current.as_str()) {
                continue;
            }
            *guard = Some(current.clone());
            drop(guard);

            let _ = bus_tx.send(BroadcastMessage::clipboard("pc", current));
        }
    });

    log::info!("Clipboard sync monitor spawned (default: disabled)");
}
