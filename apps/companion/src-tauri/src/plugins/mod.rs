pub mod obs;
pub mod discord;

use async_trait::async_trait;
use crate::actions::ActionError;

/// Trait implemented by every companion plugin (OBS, Discord, etc.).
#[async_trait]
pub trait Plugin: Send + Sync {
    /// Human-readable plugin name.
    fn name(&self) -> &str;

    /// List of capabilities this plugin provides (e.g. "switch_scene", "toggle_mute").
    fn capabilities(&self) -> Vec<String>;

    /// Attempt to initialise the plugin (connect to external service, etc.).
    /// Returns `Err` with a human message on failure; plugin should still be
    /// queryable via `is_available()` afterwards.
    async fn init(&mut self) -> Result<(), String>;

    /// Execute a named command with arbitrary JSON parameters.
    async fn execute(&self, command: &str, params: &serde_json::Value) -> Result<(), ActionError>;

    /// Whether the backing service is reachable right now.
    fn is_available(&self) -> bool;
}

/// Registry that holds every loaded plugin.
pub struct PluginManager {
    plugins: Vec<Box<dyn Plugin>>,
}

impl PluginManager {
    pub fn new() -> Self {
        Self {
            plugins: Vec::new(),
        }
    }

    /// Register a plugin. Typically called during app setup.
    pub fn register(&mut self, plugin: Box<dyn Plugin>) {
        log::info!("Plugin registered: {}", plugin.name());
        self.plugins.push(plugin);
    }

    /// Aggregate capabilities across every registered plugin.
    pub fn capabilities(&self) -> Vec<String> {
        self.plugins
            .iter()
            .flat_map(|p| p.capabilities())
            .collect()
    }

    /// Find the first plugin that advertises `capability`.
    pub fn find_plugin(&self, capability: &str) -> Option<&dyn Plugin> {
        self.plugins
            .iter()
            .find(|p| p.capabilities().iter().any(|c| c == capability))
            .map(|p| p.as_ref())
    }

    /// Return a reference to a plugin by exact name.
    pub fn get_by_name(&self, name: &str) -> Option<&dyn Plugin> {
        self.plugins
            .iter()
            .find(|p| p.name() == name)
            .map(|p| p.as_ref())
    }

    /// Names of all registered plugins and their availability.
    pub fn status_summary(&self) -> Vec<(String, bool)> {
        self.plugins
            .iter()
            .map(|p| (p.name().to_string(), p.is_available()))
            .collect()
    }
}
