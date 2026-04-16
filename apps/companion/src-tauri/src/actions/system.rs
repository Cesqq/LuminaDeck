use super::ActionError;

/// Execute a system action (volume, media, screenshot, etc.)
/// These map to specific key combos or Win32 API calls.
pub fn execute_system_action(action: &str) -> Result<(), ActionError> {
    match action {
        "volume_up" => super::keybind::execute_keybind(&["volume_up".to_string()]),
        "volume_down" => super::keybind::execute_keybind(&["volume_down".to_string()]),
        "volume_mute" => super::keybind::execute_keybind(&["volume_mute".to_string()]),
        "media_play_pause" => super::keybind::execute_keybind(&["media_play_pause".to_string()]),
        "media_next" => super::keybind::execute_keybind(&["media_next".to_string()]),
        "media_prev" => super::keybind::execute_keybind(&["media_prev".to_string()]),
        "media_stop" => super::keybind::execute_keybind(&["media_stop".to_string()]),
        "screenshot" => super::keybind::execute_keybind(&["printscreen".to_string()]),
        "lock_screen" => super::keybind::execute_keybind(&["win".to_string(), "l".to_string()]),
        "mic_mute" => {
            // Windows doesn't have a universal mic mute VK; use the system mic mute shortcut
            // Win+Alt+K is Microsoft Teams mute, but not universal
            // For now, log and return OK — this needs a system-level implementation
            log::warn!("mic_mute: no universal implementation yet");
            Ok(())
        }
        "brightness_up" | "brightness_down" | "sleep" => {
            // These require specific Win32 API calls beyond SendInput
            log::warn!("{}: not yet implemented", action);
            Ok(())
        }
        _ => Err(ActionError::InvalidSystemAction(action.to_string())),
    }
}
