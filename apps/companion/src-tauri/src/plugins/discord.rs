use async_trait::async_trait;
use crate::actions::ActionError;
use crate::plugins::Plugin;

/// Discord plugin — currently uses keyboard shortcuts as a fallback.
///
/// A future version will integrate with Discord's local RPC socket for
/// richer control (push-to-talk, activity status, etc.).
pub struct DiscordPlugin {
    available: bool,
}

impl DiscordPlugin {
    pub fn new() -> Self {
        Self { available: true }
    }
}

#[async_trait]
impl Plugin for DiscordPlugin {
    fn name(&self) -> &str {
        "discord"
    }

    fn capabilities(&self) -> Vec<String> {
        vec![
            "toggle_mute".to_string(),
            "toggle_deafen".to_string(),
        ]
    }

    async fn init(&mut self) -> Result<(), String> {
        // Discord hotkey-based control is always available on Windows.
        self.available = true;
        log::info!("Discord plugin initialised (hotkey fallback mode)");
        Ok(())
    }

    async fn execute(&self, command: &str, _params: &serde_json::Value) -> Result<(), ActionError> {
        // Delegate to the keybind module for hotkey-based control.
        match command {
            "toggle_mute" => {
                crate::actions::keybind::execute_keybind(&[
                    "ctrl".to_string(),
                    "shift".to_string(),
                    "m".to_string(),
                ])
            }
            "toggle_deafen" => {
                crate::actions::keybind::execute_keybind(&[
                    "ctrl".to_string(),
                    "shift".to_string(),
                    "d".to_string(),
                ])
            }
            other => Err(ActionError::IntegrationUnavailable(format!(
                "Unknown Discord command: {}. Discord RPC integration coming in a future update.",
                other,
            ))),
        }
    }

    fn is_available(&self) -> bool {
        self.available
    }
}
