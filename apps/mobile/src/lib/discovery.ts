/**
 * mDNS service discovery for finding LuminaDeck Companion on local network.
 * Uses react-native-zeroconf to discover _luminadeck._tcp services.
 *
 * Flow:
 * 1. Start scanning for companions on local network
 * 2. When found, display in connection list
 * 3. User selects companion or enters IP manually
 * 4. Stop scanning once connected (save battery)
 */

// NOTE: react-native-zeroconf requires native modules — won't work in Expo Go
// Must use development build (npx expo prebuild + EAS Build)

export const LUMINADECK_SERVICE_TYPE = '_luminadeck._tcp.';
export const LUMINADECK_DOMAIN = 'local.';

export interface DiscoveredCompanion {
  name: string;
  ip: string;
  port: number;
  fullName: string;
}

type DiscoveryListener = (companions: DiscoveredCompanion[]) => void;

/**
 * Discovery manager for finding LuminaDeck Companions on the network.
 * Wraps react-native-zeroconf with a simpler API.
 */
export class DiscoveryManager {
  private companions: Map<string, DiscoveredCompanion> = new Map();
  private listeners: DiscoveryListener[] = [];
  private isScanning = false;
  private zeroconf: any = null; // Lazy-loaded to avoid import errors in Expo Go

  async startScan(): Promise<void> {
    if (this.isScanning) return;

    try {
      // Dynamic import to avoid crash in Expo Go
      const Zeroconf = (await import('react-native-zeroconf')).default;
      this.zeroconf = new Zeroconf();

      this.zeroconf.on('resolved', (service: any) => {
        if (!service.host || !service.port) return;

        const companion: DiscoveredCompanion = {
          name: service.name ?? 'LuminaDeck PC',
          ip: service.host,
          port: service.port,
          fullName: service.fullName ?? service.name,
        };

        this.companions.set(companion.ip, companion);
        this.notifyListeners();
      });

      this.zeroconf.on('remove', (name: string) => {
        // Find and remove by name
        for (const [ip, companion] of this.companions) {
          if (companion.name === name || companion.fullName === name) {
            this.companions.delete(ip);
            break;
          }
        }
        this.notifyListeners();
      });

      this.zeroconf.on('error', (err: any) => {
        console.warn('mDNS discovery error:', err);
      });

      this.zeroconf.scan(LUMINADECK_SERVICE_TYPE.replace(/\.$/, ''), 'tcp', LUMINADECK_DOMAIN.replace(/\.$/, ''));
      this.isScanning = true;
    } catch (err) {
      console.warn('mDNS not available (Expo Go?). Use manual IP entry.', err);
    }
  }

  stopScan(): void {
    if (!this.isScanning || !this.zeroconf) return;

    try {
      this.zeroconf.stop();
      this.zeroconf.removeAllListeners();
    } catch {
      // Ignore cleanup errors
    }
    this.isScanning = false;
    this.zeroconf = null;
  }

  onUpdate(listener: DiscoveryListener): () => void {
    this.listeners.push(listener);
    // Immediately notify with current state
    listener(Array.from(this.companions.values()));
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  getCompanions(): DiscoveredCompanion[] {
    return Array.from(this.companions.values());
  }

  private notifyListeners(): void {
    const list = Array.from(this.companions.values());
    this.listeners.forEach((l) => l(list));
  }
}

/** Singleton discovery instance */
export const discovery = new DiscoveryManager();
