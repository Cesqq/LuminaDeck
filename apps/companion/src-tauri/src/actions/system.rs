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
        "minimize_window" => super::keybind::execute_keybind(&["win".to_string(), "down".to_string()]),
        "snap_left" => super::keybind::execute_keybind(&["win".to_string(), "left".to_string()]),
        "snap_right" => super::keybind::execute_keybind(&["win".to_string(), "right".to_string()]),
        "switch_window" => super::keybind::execute_keybind(&["alt".to_string(), "tab".to_string()]),
        "close_window" => super::keybind::execute_keybind(&["alt".to_string(), "f4".to_string()]),
        "mic_mute" => {
            Err(ActionError::IntegrationUnavailable(
                "Mic mute is not supported by this companion build".to_string(),
            ))
        }
        "brightness_up" | "brightness_down" | "sleep" => {
            Err(ActionError::IntegrationUnavailable(format!(
                "{} is not supported by this companion build",
                action
            )))
        }
        _ => Err(ActionError::InvalidSystemAction(action.to_string())),
    }
}
