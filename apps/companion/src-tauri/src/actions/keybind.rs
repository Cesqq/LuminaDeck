use super::ActionError;
use std::collections::HashMap;
use std::sync::OnceLock;

#[cfg(windows)]
use windows::Win32::UI::Input::KeyboardAndMouse::*;

fn vk_map() -> &'static HashMap<&'static str, u16> {
    static MAP: OnceLock<HashMap<&'static str, u16>> = OnceLock::new();
    MAP.get_or_init(|| {
        let mut m = HashMap::new();
        let entries: &[(&str, u16)] = &[
        // Letters (a-z → 0x41-0x5A)
        ("a", 0x41), ("b", 0x42), ("c", 0x43), ("d", 0x44), ("e", 0x45), ("f", 0x46),
        ("g", 0x47), ("h", 0x48), ("i", 0x49), ("j", 0x4A), ("k", 0x4B), ("l", 0x4C),
        ("m", 0x4D), ("n", 0x4E), ("o", 0x4F), ("p", 0x50), ("q", 0x51), ("r", 0x52),
        ("s", 0x53), ("t", 0x54), ("u", 0x55), ("v", 0x56), ("w", 0x57), ("x", 0x58),
        ("y", 0x59), ("z", 0x5A),
        // Numbers (0-9 → 0x30-0x39)
        ("0", 0x30), ("1", 0x31), ("2", 0x32), ("3", 0x33), ("4", 0x34),
        ("5", 0x35), ("6", 0x36), ("7", 0x37), ("8", 0x38), ("9", 0x39),
        // Function keys
        ("f1", 0x70), ("f2", 0x71), ("f3", 0x72), ("f4", 0x73), ("f5", 0x74), ("f6", 0x75),
        ("f7", 0x76), ("f8", 0x77), ("f9", 0x78), ("f10", 0x79), ("f11", 0x7A), ("f12", 0x7B),
        ("f13", 0x7C), ("f14", 0x7D), ("f15", 0x7E), ("f16", 0x7F), ("f17", 0x80), ("f18", 0x81),
        ("f19", 0x82), ("f20", 0x83), ("f21", 0x84), ("f22", 0x85), ("f23", 0x86), ("f24", 0x87),
        // Modifiers
        ("ctrl", 0xA2), ("lctrl", 0xA2), ("rctrl", 0xA3),
        ("shift", 0xA0), ("lshift", 0xA0), ("rshift", 0xA1),
        ("alt", 0xA4), ("lalt", 0xA4), ("ralt", 0xA5),
        ("win", 0x5B), ("lwin", 0x5B), ("rwin", 0x5C),
        // Navigation
        ("up", 0x26), ("down", 0x28), ("left", 0x25), ("right", 0x27),
        ("home", 0x24), ("end", 0x23), ("pageup", 0x21), ("pagedown", 0x22),
        // Editing
        ("enter", 0x0D), ("return", 0x0D), ("tab", 0x09), ("space", 0x20),
        ("backspace", 0x08), ("delete", 0x2E), ("insert", 0x2D),
        ("escape", 0x1B), ("esc", 0x1B),
        // Punctuation
        ("minus", 0xBD), ("equals", 0xBB), ("leftbracket", 0xDB), ("rightbracket", 0xDD),
        ("backslash", 0xDC), ("semicolon", 0xBA), ("quote", 0xDE),
        ("comma", 0xBC), ("period", 0xBE), ("slash", 0xBF), ("backtick", 0xC0),
        // Media
        ("media_play_pause", 0xB3), ("media_next", 0xB0), ("media_prev", 0xB1),
        ("media_stop", 0xB2), ("volume_up", 0xAF), ("volume_down", 0xAE), ("volume_mute", 0xAD),
        // System
        ("printscreen", 0x2C), ("scrolllock", 0x91), ("pause", 0x13),
        ("capslock", 0x14), ("numlock", 0x90),
        // Numpad
        ("numpad0", 0x60), ("numpad1", 0x61), ("numpad2", 0x62), ("numpad3", 0x63),
        ("numpad4", 0x64), ("numpad5", 0x65), ("numpad6", 0x66), ("numpad7", 0x67),
        ("numpad8", 0x68), ("numpad9", 0x69),
        ("numpad_multiply", 0x6A), ("numpad_add", 0x6B), ("numpad_subtract", 0x6D),
        ("numpad_decimal", 0x6E), ("numpad_divide", 0x6F),
    ];

        for &(name, vk) in entries {
            m.insert(name, vk);
        }
        m
    })
}

/// Keys that require KEYEVENTF_EXTENDEDKEY flag
const EXTENDED_KEYS: &[&str] = &[
    "up", "down", "left", "right", "home", "end", "pageup", "pagedown",
    "insert", "delete", "printscreen", "rctrl", "ralt", "rwin",
    "numpad_divide", "media_play_pause", "media_next", "media_prev",
    "media_stop", "volume_up", "volume_down", "volume_mute",
];

/// Modifier key names for ordering (pressed first, released last)
const MODIFIERS: &[&str] = &[
    "ctrl", "lctrl", "rctrl", "shift", "lshift", "rshift",
    "alt", "lalt", "ralt", "win", "lwin", "rwin",
];

fn is_modifier(key: &str) -> bool {
    MODIFIERS.contains(&key)
}

fn is_extended(key: &str) -> bool {
    EXTENDED_KEYS.contains(&key)
}

fn resolve_vk(key: &str) -> Result<u16, ActionError> {
    vk_map()
        .get(key.to_lowercase().as_str())
        .copied()
        .ok_or_else(|| ActionError::InvalidKey(key.to_string()))
}

/// Execute a keybind combo via Win32 SendInput.
/// Keys are pressed in order (modifiers first), then released in reverse.
#[cfg(windows)]
pub fn execute_keybind(keys: &[String]) -> Result<(), ActionError> {
    if keys.len() > 6 {
        return Err(ActionError::TooManyKeys(keys.len()));
    }

    // Separate modifiers and regular keys, validate all
    let mut modifier_vks = Vec::new();
    let mut regular_vks = Vec::new();
    let mut modifier_flags = Vec::new();
    let mut regular_flags = Vec::new();

    for key in keys {
        let lower = key.to_lowercase();
        let vk = resolve_vk(&lower)?;
        let extended = is_extended(&lower);

        if is_modifier(&lower) {
            modifier_vks.push(vk);
            modifier_flags.push(extended);
        } else {
            regular_vks.push(vk);
            regular_flags.push(extended);
        }
    }

    // Build INPUT array: press modifiers → press keys → release keys → release modifiers
    let mut inputs: Vec<INPUT> = Vec::new();

    // Press modifiers
    for (i, &vk) in modifier_vks.iter().enumerate() {
        inputs.push(make_key_input(vk, true, modifier_flags[i]));
    }

    // Press regular keys
    for (i, &vk) in regular_vks.iter().enumerate() {
        inputs.push(make_key_input(vk, true, regular_flags[i]));
    }

    // Release regular keys (reverse order)
    for (i, &vk) in regular_vks.iter().enumerate().rev() {
        inputs.push(make_key_input(vk, false, regular_flags[i]));
    }

    // Release modifiers (reverse order)
    for (i, &vk) in modifier_vks.iter().enumerate().rev() {
        inputs.push(make_key_input(vk, false, modifier_flags[i]));
    }

    // Send all inputs atomically
    let sent = unsafe {
        SendInput(
            &inputs,
            std::mem::size_of::<INPUT>() as i32,
        )
    };

    if sent != inputs.len() as u32 {
        return Err(ActionError::SendInputFailed(format!(
            "SendInput sent {}/{} events",
            sent,
            inputs.len()
        )));
    }

    Ok(())
}

#[cfg(windows)]
fn make_key_input(vk: u16, down: bool, extended: bool) -> INPUT {
    let mut flags = KEYBD_EVENT_FLAGS(0);
    if !down {
        flags |= KEYEVENTF_KEYUP;
    }
    if extended {
        flags |= KEYEVENTF_EXTENDEDKEY;
    }

    let mut input = INPUT::default();
    input.r#type = INPUT_KEYBOARD;
    input.Anonymous.ki = KEYBDINPUT {
        wVk: VIRTUAL_KEY(vk),
        wScan: 0,
        dwFlags: flags,
        time: 0,
        dwExtraInfo: 0,
    };
    input
}

/// Stub for non-Windows builds (for testing / CI)
#[cfg(not(windows))]
pub fn execute_keybind(keys: &[String]) -> Result<(), ActionError> {
    log::info!("SendInput stub (non-Windows): {:?}", keys);
    Ok(())
}
