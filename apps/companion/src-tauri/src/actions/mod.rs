pub mod keybind;
pub mod system;
pub mod app_launch;
pub mod text_input;

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
    Discord { command: String },
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
            Action::Discord { command } => {
                // Discord integration will be built in Phase F
                // For now, use hotkey fallback
                match command.as_str() {
                    "toggle_mute" => keybind::execute_keybind(&["ctrl".to_string(), "shift".to_string(), "m".to_string()]),
                    "toggle_deafen" => keybind::execute_keybind(&["ctrl".to_string(), "shift".to_string(), "d".to_string()]),
                    _ => {
                        log::warn!("Discord action '{}' not yet implemented", command);
                        Err(ActionError::IntegrationUnavailable("Discord push-to-talk requires Discord RPC integration.".to_string()))
                    }
                }
            }
        }
    })
}
