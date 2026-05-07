//! Privacy-first telemetry for the LuminaDeck Studio companion.
//!
//! Mirrors the contract in `packages/shared/src/telemetry-events.ts`:
//!   - Off by default. `track()` is a no-op until `set_opt_in(true)` fires.
//!   - Per-install random salt lives in the app data dir (next to
//!     `paired_devices.json`). Rotates every 90 days so there is never a
//!     stable cross-install identifier.
//!   - No user-generated strings in payloads — enum/count/duration only.
//!   - Network failure must silently no-op. Telemetry can never break a
//!     user-facing flow.
//!
//! The module also keeps a 20-event ring buffer in memory so future Studio
//! tooling (or a CLI inspector) can preview what we *would* send.
//!
//! ### Network emit
//!
//! Until the PostHog EU DPA is signed (tracked in the Phase A.5 handoff) we
//! deliberately do NOT add an HTTP client dependency. The `emit()` helper
//! currently logs the payload via `log::debug!` and leaves a TODO pointer
//! for the follow-up PR that wires `ureq`/`reqwest`.

use std::collections::VecDeque;
use std::path::PathBuf;
use std::sync::LazyLock;
use std::time::{SystemTime, UNIX_EPOCH};

use parking_lot::Mutex;
use serde::Serialize;
use serde_json::Value;

const SALT_ROTATION_MS: u128 = 90 * 24 * 60 * 60 * 1000;
const RING_BUFFER_SIZE: usize = 20;
const LIB_NAME: &str = "luminadeck-companion";
const LIB_VERSION: &str = env!("CARGO_PKG_VERSION");

#[derive(Clone, Debug, Serialize)]
pub struct TelemetryEventRecord {
    pub event: String,
    pub properties: Value,
    pub timestamp_ms: u128,
    pub sent: bool,
}

struct State {
    opt_in: bool,
    distinct_id: Option<String>,
    ring: VecDeque<TelemetryEventRecord>,
}

static STATE: LazyLock<Mutex<State>> = LazyLock::new(|| {
    Mutex::new(State {
        opt_in: false,
        distinct_id: None,
        ring: VecDeque::with_capacity(RING_BUFFER_SIZE),
    })
});

#[derive(Serialize, serde::Deserialize)]
struct SaltFile {
    salt: String,
    created_at_ms: u128,
}

fn salt_path() -> PathBuf {
    directories::ProjectDirs::from("com", "luminadeck", "companion")
        .map(|dirs| dirs.data_dir().join("telemetry_salt.json"))
        .unwrap_or_else(|| PathBuf::from("telemetry_salt.json"))
}

fn now_ms() -> u128 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or(0)
}

/// Non-cryptographic 256-bit random hex string — fine as an opaque distinct
/// ID; we do not use it for any security boundary.
fn random_hex_256() -> String {
    // `uuid::Uuid::new_v4()` uses a CSPRNG, and we already depend on the
    // `uuid` crate for paired-device IDs. Two v4 UUIDs concatenated yield
    // 256 bits of entropy.
    let a = uuid::Uuid::new_v4().as_u128();
    let b = uuid::Uuid::new_v4().as_u128();
    format!("{:032x}{:032x}", a, b)
}

fn get_or_rotate_salt() -> String {
    let path = salt_path();
    let now = now_ms();
    if let Ok(raw) = std::fs::read_to_string(&path) {
        if let Ok(existing) = serde_json::from_str::<SaltFile>(&raw) {
            if now.saturating_sub(existing.created_at_ms) < SALT_ROTATION_MS {
                return existing.salt;
            }
        }
    }
    let fresh = SaltFile {
        salt: random_hex_256(),
        created_at_ms: now,
    };
    if let Some(parent) = path.parent() {
        let _ = std::fs::create_dir_all(parent);
    }
    if let Ok(json) = serde_json::to_string_pretty(&fresh) {
        let _ = std::fs::write(&path, json);
    }
    fresh.salt
}

/// Call once at app start (e.g. from `run()` inside lib.rs). Rotates the
/// salt if it's older than 90 days and seeds the opt-in state from the
/// caller-supplied value (persisted in Studio settings in a later pass).
pub fn init(opt_in: bool) {
    let salt = get_or_rotate_salt();
    let mut state = STATE.lock();
    state.opt_in = opt_in;
    state.distinct_id = Some(salt);
}

#[allow(dead_code)]
pub fn set_opt_in(value: bool) {
    STATE.lock().opt_in = value;
}

#[allow(dead_code)]
pub fn is_opt_in() -> bool {
    STATE.lock().opt_in
}

/// Append a telemetry event. `properties` MUST NOT include any
/// user-generated strings — see the privacy contract in
/// `packages/shared/src/telemetry-events.ts`.
pub fn track(event: &str, properties: Value) {
    let record = TelemetryEventRecord {
        event: event.to_string(),
        properties,
        timestamp_ms: now_ms(),
        sent: false,
    };

    let opt_in;
    let distinct_id;
    {
        let mut state = STATE.lock();
        if state.ring.len() == RING_BUFFER_SIZE {
            state.ring.pop_front();
        }
        state.ring.push_back(record.clone());
        opt_in = state.opt_in;
        distinct_id = state.distinct_id.clone();
    }

    if !opt_in {
        return;
    }

    if let Some(id) = distinct_id {
        emit(record, id);
    }
}

/// Stubbed network emit. See module-level docs: until the PostHog EU DPA is
/// signed we do not add an HTTP client dependency. The follow-up PR should
/// replace this body with a `tokio::spawn` + `reqwest`/`ureq` POST to
/// `https://eu.i.posthog.com/capture/` with `{ api_key, event, distinct_id,
/// properties: { ..., $lib, $lib_version, $ip: null }, timestamp }`.
fn emit(record: TelemetryEventRecord, distinct_id: String) {
    log::debug!(
        "[telemetry stub] event={} distinct_id={} props={} (no HTTP client wired yet)",
        record.event,
        &distinct_id[..8],
        record.properties
    );
    // Mark the record as 'sent' in the ring once the real emit is wired;
    // the stub path leaves `sent = false` so the debug overlay shows the
    // event has not left the device.
    let _ = LIB_NAME;
    let _ = LIB_VERSION;
}

#[allow(dead_code)]
pub fn recent_events() -> Vec<TelemetryEventRecord> {
    STATE.lock().ring.iter().cloned().collect()
}
