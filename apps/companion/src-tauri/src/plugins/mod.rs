pub mod obs;
pub mod discord;
pub mod sdk_runtime;

use async_trait::async_trait;
use serde::Serialize;
use std::collections::HashMap;
use crate::actions::ActionError;

/// Trait implemented by every companion plugin (OBS, Discord, etc.).
#[async_trait]
pub trait Plugin: Send + Sync {
    /// Human-readable plugin name (also used as the registry key).
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

    /// JSON Schema describing user-editable config fields. Drives both the
    /// Studio config form and the mobile config UI. Default: empty object —
    /// plugin has nothing to configure.
    fn config_schema(&self) -> serde_json::Value {
        serde_json::json!({ "type": "object", "properties": {} })
    }

    /// Apply a user-supplied config (from the Studio/mobile form) and
    /// persist any non-secret fields to disk. Implementations should write
    /// secrets to the OS keyring via the `keyring` crate. Default: no-op.
    async fn configure(&mut self, _cfg: serde_json::Value) -> Result<(), String> {
        Ok(())
    }

    /// Read back the currently-applied non-secret config (for prefilling
    /// the Studio form on load). Default: empty object.
    fn current_config(&self) -> serde_json::Value {
        serde_json::json!({})
    }

    /// Try a one-shot connectivity check. Returns Ok(()) if reachable,
    /// Err with a human-readable reason otherwise. Default: report current
    /// `is_available()` as a tri-state.
    async fn test(&self) -> Result<(), String> {
        if self.is_available() {
            Ok(())
        } else {
            Err("Not connected".to_string())
        }
    }
}

/// Snapshot of a plugin's runtime state, returned via Tauri commands.
#[derive(Clone, Debug, Serialize)]
pub struct PluginStatus {
    pub name: String,
    pub available: bool,
    pub capabilities: Vec<String>,
}

/// Registry that holds every loaded plugin, keyed by `Plugin::name`.
pub struct PluginManager {
    plugins: HashMap<String, Box<dyn Plugin>>,
}

impl PluginManager {
    pub fn new() -> Self {
        Self {
            plugins: HashMap::new(),
        }
    }

    /// Register a plugin. Typically called during app setup.
    /// Replaces any previous plugin registered under the same name.
    pub fn register(&mut self, plugin: Box<dyn Plugin>) {
        let name = plugin.name().to_string();
        log::info!("Plugin registered: {}", name);
        self.plugins.insert(name, plugin);
    }

    /// Aggregate capabilities across every registered plugin.
    pub fn capabilities(&self) -> Vec<String> {
        self.plugins
            .values()
            .flat_map(|p| p.capabilities())
            .collect()
    }

    /// Find the first plugin that advertises `capability`.
    pub fn find_plugin(&self, capability: &str) -> Option<&dyn Plugin> {
        self.plugins
            .values()
            .find(|p| p.capabilities().iter().any(|c| c == capability))
            .map(|p| p.as_ref())
    }

    /// Return a reference to a plugin by exact name.
    pub fn get_by_name(&self, name: &str) -> Option<&dyn Plugin> {
        self.plugins.get(name).map(|p| p.as_ref())
    }

    /// Mutable reference — used by `configure_plugin`. Callers must keep
    /// the write lock held only for the duration of the configure call.
    pub fn get_by_name_mut(&mut self, name: &str) -> Option<&mut (dyn Plugin + 'static)> {
        self.plugins.get_mut(name).map(|p| &mut **p)
    }

    /// Status snapshot of every registered plugin.
    /// Held only briefly under the registry read lock.
    pub fn status(&self) -> Vec<PluginStatus> {
        let mut out: Vec<PluginStatus> = self
            .plugins
            .values()
            .map(|p| PluginStatus {
                name: p.name().to_string(),
                available: p.is_available(),
                capabilities: p.capabilities(),
            })
            .collect();
        out.sort_by(|a, b| a.name.cmp(&b.name));
        out
    }

    /// Backwards-compat helper used by lib.rs init logging.
    pub fn status_summary(&self) -> Vec<(String, bool)> {
        self.status()
            .into_iter()
            .map(|s| (s.name, s.available))
            .collect()
    }
}
