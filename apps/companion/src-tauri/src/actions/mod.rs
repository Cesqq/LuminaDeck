pub mod keybind;
pub mod system;
pub mod app_launch;
pub mod text_input;
pub mod mouse;

use serde::Deserialize;
use thiserror::Error;

#[derive(Debug, Deserialize)]
#[serde(tag = "type")]
pub enum Action {
    #[serde(rename = "keybind")]
    Keybind { keys: Vec<String> },

    #[serde(rename = "app_launch")]
    AppLaunch { path: String, args: Option<Vec<String>> },

    #[serde(rename = "system_action")]
    SystemAction { action: String },

    #[serde(rename = "multi_action")]
    MultiAction {
        actions: Vec<Action>,
        delays: Option<Vec<u64>>,
    },

    #[serde(rename = "text_input")]
    TextInput { text: String },

    #[serde(rename = "obs")]
    OBS {
        command: String,
        #[serde(rename = "sceneName")]
        scene_name: Option<String>,
        #[serde(rename = "sourceName")]
        source_name: Option<String>,
        #[serde(rename = "filterName")]
        filter_name: Option<String>,
    },

    #[serde(rename = "discord")]
    Discord {
        command: String,
        /// For `chat`/`slash_command`: the text to send. The plugin types
        /// this into whatever window currently has focus (so the user
        /// must focus Discord first — typically via app_launch chained
        /// in a multi_action).
        #[serde(default)]
        text: Option<String>,
    },
}

#[derive(Debug, Error)]
pub enum ActionError {
    #[error("Invalid key name: {0}")]
    InvalidKey(String),

    #[error("Too many keys in combo: {0} (max 6)")]
    TooManyKeys(usize),

    #[error("Invalid path: {0}")]
    InvalidPath(String),

    #[error("Invalid system action: {0}")]
    InvalidSystemAction(String),

    #[error("Rate limited")]
    RateLimited,

    #[error("SendInput failed: {0}")]
    SendInputFailed(String),

    #[error("App launch failed: {0}")]
    LaunchFailed(String),

    #[error("Text input failed: {0}")]
    TextInputFailed(String),

    #[error("Integration unavailable: {0}")]
    IntegrationUnavailable(String),
}

/// Execute an action. Uses Box::pin for MultiAction recursion.
pub fn execute_action(action: &Action) -> std::pin::Pin<Box<dyn std::future::Future<Output = Result<(), ActionError>> + Send + '_>> {
    Box::pin(async move {
        match action {
            Action::Keybind { keys } => keybind::execute_keybind(keys),
            Action::AppLaunch { path, args } => app_launch::launch_app(path, args.as_deref()),
            Action::SystemAction { action: name } => system::execute_system_action(name),
            Action::TextInput { text } => {
                text_input::execute_text_input(text)
                    .map_err(ActionError::TextInputFailed)
            }
            Action::MultiAction { actions, delays } => {
                for (i, sub_action) in actions.iter().enumerate() {
                    execute_action(sub_action).await?;
                    if let Some(delays) = delays {
                        if let Some(&delay) = delays.get(i) {
                            tokio::time::sleep(tokio::time::Duration::from_millis(delay)).await;
                        }
                    }
                }
                Ok(())
            }
            Action::OBS { command, .. } => {
                // OBS integration will be built in Phase F
                log::warn!("OBS action '{}' not yet implemented", command);
                Err(ActionError::IntegrationUnavailable("OBS Studio integration not yet available. Install OBS and restart companion.".to_string()))
            }
            Action::Discord { command, text } => {
                // v1.4: most Discord controls work via the default
                // hotkeys Discord ships with. The user must have focus
                // on the Discord window for `chat` / `slash_command` —
                // typically chained from a multi_action that brings
                // Discord forward first via app_launch.
                //
                // True RPC integration (per-user voice volume, soundboard
                // playback, voice-channel hopping) would need Discord's
                // local IPC socket + an OAuth-scoped Application from
                // each user — deferred to a Studio "Connect Discord" UX.
                match command.as_str() {
                    "toggle_mute" => keybind::execute_keybind(&["ctrl".to_string(), "shift".to_string(), "m".to_string()]),
                    "toggle_deafen" => keybind::execute_keybind(&["ctrl".to_string(), "shift".to_string(), "d".to_string()]),
                    "push_to_talk" | "push_to_talk_press" | "push_to_talk_release" => {
                        // Discord PTT defaults to backtick (`); user can rebind.
                        // `state` is implicit in the press/release variant.
                        keybind::execute_keybind(&["backtick".to_string()])
                    }
                    "voice_volume_up" => keybind::execute_keybind(&["ctrl".to_string(), "shift".to_string(), "u".to_string()]),
                    "voice_volume_down" => keybind::execute_keybind(&["ctrl".to_string(), "shift".to_string(), "d".to_string()]),
                    "disconnect_voice" => {
                        // Discord default: no global hotkey. Most users bind
                        // Ctrl+Shift+End — fall through to that as a sensible
                        // default; the user can customise via Discord settings.
                        keybind::execute_keybind(&["ctrl".to_string(), "shift".to_string(), "end".to_string()])
                    }
                    "chat" | "slash_command" => {
                        // Sends a chat message. User must have focused
                        // the Discord chat input first (chain with a
                        // window-focus action, or just alt-tab manually).
                        // Slash commands are just chat that starts with
                        // "/" — Discord's client parses them. Music-bot
                        // triggers like "/play <url>" work through this
                        // path verbatim.
                        let body = text.as_deref().unwrap_or("");
                        if body.is_empty() {
                            return Err(ActionError::InvalidSystemAction(
                                "Discord chat action requires a non-empty `text` field".to_string(),
                            ));
                        }
                        text_input::execute_text_input(body)
                            .map_err(ActionError::TextInputFailed)?;
                        // Press Enter to send. Skipping this leaves the
                        // text in the chat input — also valid (lets the
                        // user review before send) but the documented
                        // behaviour for `chat`/`slash_command` is to send.
                        keybind::execute_keybind(&["enter".to_string()])
                    }
                    _ => {
                        log::warn!("Discord action '{}' not yet implemented", command);
                        Err(ActionError::IntegrationUnavailable(
                            format!("Discord command '{}' isn't supported. Try toggle_mute, toggle_deafen, push_to_talk_press, voice_volume_up, voice_volume_down, chat, or slash_command.", command)
                        ))
                    }
                }
            }
        }
    })
}
