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
        let hostname = hostname::get()
            .map(|h| h.to_string_lossy().to_string())
            .unwrap_or_else(|_| "luminadeck-pc".to_string());

        let mut props = std::collections::HashMap::new();
        props.insert("version".to_string(), "1.1.0".to_string());
        props.insert("port".to_string(), self.port.to_string());
        props.insert("name".to_string(), hostname.clone());

        let service = ServiceInfo::new(
            SERVICE_TYPE,
            SERVICE_NAME,
            &format!("{}.", hostname),
            "",
            self.port,
            props,
        )?;

        self.daemon.register(service)?;
        *self.is_broadcasting.lock() = true;
        log::info!("mDNS broadcast started for pairing");
        Ok(())
    }

    /// Stop mDNS broadcast. Called when pairing completes or slots are full.
    pub fn stop_broadcast(&self) -> Result<(), mdns_sd::Error> {
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
