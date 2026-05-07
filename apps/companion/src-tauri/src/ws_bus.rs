//! Typed fan-out for server-initiated messages (active window changes,
//! profile updates). Each connection subscribes to a broadcast channel of
//! `BroadcastMessage` values and decides per-kind whether to forward to
//! its client — so peers that did not opt in to profile updates (via
//! `subscribe_profile`) never receive them.

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum BroadcastKind {
    ActiveWindow,
    ProfileUpdate,
    ProfileSwitch,
    /// Shared-clipboard sync — `clipboard_set` payload going either way.
    /// The receiver inspects the JSON's `source` field to decide whether
    /// the message originated locally (and should be ignored to avoid
    /// loops) or from a peer (apply it).
    Clipboard,
}

#[derive(Clone, Debug)]
pub struct BroadcastMessage {
    pub kind: BroadcastKind,
    /// Pre-serialised JSON ready to write to a WebSocket text frame.
    pub json: String,
}

impl BroadcastMessage {
    pub fn active_window(json: String) -> Self {
        Self { kind: BroadcastKind::ActiveWindow, json }
    }

    pub fn profile_update(json: String) -> Self {
        Self { kind: BroadcastKind::ProfileUpdate, json }
    }

    pub fn profile_switch(json: String) -> Self {
        Self { kind: BroadcastKind::ProfileSwitch, json }
    }

    /// Build a `clipboard_set` broadcast. `source` is "pc" when the
    /// companion's clipboard changed and we're publishing to phones, or
    /// "phone" when a phone published and we're (rarely) re-broadcasting
    /// to other paired phones.
    pub fn clipboard(source: &str, text: String) -> Self {
        let json = serde_json::json!({
            "type": "clipboard_set",
            "source": source,
            "text": text,
        })
        .to_string();
        Self { kind: BroadcastKind::Clipboard, json }
    }
}
