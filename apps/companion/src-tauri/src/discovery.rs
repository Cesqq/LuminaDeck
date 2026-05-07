use mdns_sd::{ServiceDaemon, ServiceInfo};
use std::sync::Arc;
use parking_lot::Mutex;

const SERVICE_TYPE: &str = "_luminadeck._tcp.local.";
const SERVICE_NAME: &str = "LuminaDeck Studio";

/// mDNS discovery manager. Broadcasts only during active pairing mode.
pub struct DiscoveryManager {
    daemon: ServiceDaemon,
    is_broadcasting: Arc<Mutex<bool>>,
    port: u16,
}

impl DiscoveryManager {
    pub fn new(port: u16) -> Result<Self, mdns_sd::Error> {
        let daemon = ServiceDaemon::new()?;
        Ok(Self {
            daemon,
            is_broadcasting: Arc::new(Mutex::new(false)),
            port,
        })
    }

    /// Start broadcasting mDNS service for pairing discovery.
    /// Must be stopped when pairing is complete.
    pub fn start_broadcast(&self) -> Result<(), mdns_sd::Error> {
        if self.is_broadcasting() {
            return Ok(());
        }

        let raw_hostname = hostname::get()
            .map(|h| h.to_string_lossy().to_string())
            .unwrap_or_else(|_| "luminadeck-pc".to_string());

        let mdns_host = sanitize_mdns_hostname(&raw_hostname);

        let mut props = std::collections::HashMap::new();
        props.insert("version".to_string(), env!("CARGO_PKG_VERSION").to_string());
        props.insert("port".to_string(), self.port.to_string());
        props.insert("name".to_string(), raw_hostname.clone());

        let service = ServiceInfo::new(
            SERVICE_TYPE,
            SERVICE_NAME,
            &mdns_host,
            "",
            self.port,
            props,
        )?;

        self.daemon.register(service)?;
        *self.is_broadcasting.lock() = true;
        log::info!("mDNS broadcast started for pairing as {}", mdns_host);
        Ok(())
    }

    /// Stop mDNS broadcast. Called when pairing completes or slots are full.
    pub fn stop_broadcast(&self) -> Result<(), mdns_sd::Error> {
        if !self.is_broadcasting() {
            return Ok(());
        }

        let fullname = format!("{}.{}", SERVICE_NAME, SERVICE_TYPE);
        self.daemon.unregister(&fullname)?;
        *self.is_broadcasting.lock() = false;
        log::info!("mDNS broadcast stopped");
        Ok(())
    }

    pub fn is_broadcasting(&self) -> bool {
        *self.is_broadcasting.lock()
    }
}

impl Drop for DiscoveryManager {
    fn drop(&mut self) {
        if self.is_broadcasting() {
            let _ = self.stop_broadcast();
        }
        let _ = self.daemon.shutdown();
    }
}

/// mDNS-sd requires the host string to be a valid mDNS hostname ending with `.local.`.
/// Each label must contain only ASCII alphanumerics and hyphens (RFC 6762).
fn sanitize_mdns_hostname(raw: &str) -> String {
    let trimmed = raw.trim().trim_end_matches('.');
    let label_source = trimmed.split('.').next().unwrap_or("luminadeck-pc");
    let mut label: String = label_source
        .chars()
        .map(|c| if c.is_ascii_alphanumeric() || c == '-' { c } else { '-' })
        .collect();
    if label.is_empty() {
        label = "luminadeck-pc".to_string();
    }
    if label.len() > 63 {
        label.truncate(63);
    }
    format!("{}.local.", label)
}

#[cfg(test)]
mod tests {
    use super::sanitize_mdns_hostname;

    #[test]
    fn appends_local_suffix() {
        assert_eq!(sanitize_mdns_hostname("DESKTOP-ABC"), "DESKTOP-ABC.local.");
    }

    #[test]
    fn strips_trailing_dot_before_appending() {
        assert_eq!(sanitize_mdns_hostname("DESKTOP-ABC."), "DESKTOP-ABC.local.");
    }

    #[test]
    fn keeps_only_first_label() {
        assert_eq!(sanitize_mdns_hostname("host.subdomain.com"), "host.local.");
    }

    #[test]
    fn replaces_invalid_chars() {
        assert_eq!(sanitize_mdns_hostname("My PC!"), "My-PC-.local.");
    }

    #[test]
    fn fallback_on_empty() {
        assert_eq!(sanitize_mdns_hostname(""), "luminadeck-pc.local.");
        assert_eq!(sanitize_mdns_hostname("..."), "luminadeck-pc.local.");
    }
}
