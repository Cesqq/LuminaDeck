import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import {
  HEARTBEAT_INTERVAL_MS,
  HEARTBEAT_MISS_THRESHOLD,
  RECONNECT_DELAYS_MS,
  RECONNECT_MAX_DELAY_MS,
  PROTOCOL_VERSION,
  MIN_FEATURE_PROFILE_UPDATE,
  TELEMETRY_EVENTS,
  isClientCompatible,
} from '@luminadeck/shared';
import { track } from './telemetry';
import type {
  ClientMessage,
  CompanionMessage,
  ConnectionStatus,
  ProStatus,
} from '@luminadeck/shared';

type StatusListener = (status: ConnectionStatus) => void;
type MessageListener = (msg: CompanionMessage) => void;
const DEVICE_ID_KEY = '@luminadeck/device_id';

function generateDeviceId(): string {
  return 'ld-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export class LuminaDeckClient {
  private ws: WebSocket | null = null;
  private url: string = '';
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private missedHeartbeats = 0;
  private reconnectAttempt = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private statusListeners: StatusListener[] = [];
  private messageListeners: MessageListener[] = [];
  private _status: ConnectionStatus = 'disconnected';
  private shouldReconnect = false;
  private deviceName: string = `${Platform.OS === 'ios' ? 'iPhone' : 'Android'}`;
  private deviceId: string = generateDeviceId();
  private pairingSecret: string | null = null;
  /**
   * Last-known Pro status snapshot. Sent inside the hello handshake so
   * Studio can gate its editor UI (PRO pills, locked tiles) without a
   * separate round trip. ProContext calls `setProStatus` whenever the
   * entitlement flips; we reconnect on change so the fresh value lands
   * on Studio immediately (otherwise Studio keeps the stale Free snapshot
   * until the next natural reconnect).
   */
  private proStatus: ProStatus | null = null;

  setProStatus(next: ProStatus | null): void {
    // Just store it. The hello handshake on the next (re)connect will carry
    // the fresh value to Studio. Previous behaviour force-closed the WS on
    // every isPro flip — but that races with the initial Pro status load
    // from SecureStore, which fires AFTER onopen but BEFORE hello has been
    // sent. Closing mid-handshake produced "WebSocket upgrade ... Client
    // disconnected (Normal close)" with no hello and no error path that
    // would clear shouldReconnect, leading to indefinite reconnect storms
    // visible on the companion side. Studio sees a stale snapshot until
    // the next natural reconnect — acceptable trade-off vs the deadlock.
    this.proStatus = next;
  }

  get status(): ConnectionStatus {
    return this._status;
  }

  onStatus(listener: StatusListener): () => void {
    this.statusListeners.push(listener);
    return () => {
      this.statusListeners = this.statusListeners.filter((l) => l !== listener);
    };
  }

  onMessage(listener: MessageListener): () => void {
    this.messageListeners.push(listener);
    return () => {
      this.messageListeners = this.messageListeners.filter((l) => l !== listener);
    };
  }

  connect(ip: string, port: number, pairingSecret?: string, useTLS: boolean = false): void {
    const protocol = useTLS ? 'wss' : 'ws';
    this.url = `${protocol}://${ip}:${port}`;
    this.pairingSecret = pairingSecret ?? null;
    this.shouldReconnect = true;
    this.reconnectAttempt = 0;
    this.doConnect();
  }

  disconnect(): void {
    this.shouldReconnect = false;
    this.cleanup();
    this.setStatus('disconnected');
  }

  send(msg: ClientMessage): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
      // Every tile press funnels through `send` as an `execute` message;
      // hooking telemetry here means we automatically catch presses from
      // HomeScreen, folders, macros, and any future entry point — without
      // leaking tile labels (action type only, per privacy contract).
      if (msg.type === 'execute') {
        track(TELEMETRY_EVENTS.TILE_PRESS, { actionType: msg.action.type });
      }
    }
  }

  sendAction(action: ClientMessage extends { type: 'execute' } ? ClientMessage : never): void {
    this.send(action);
  }

  private connectTimeout: ReturnType<typeof setTimeout> | null = null;

  private doConnect(): void {
    this.cleanup();
    this.setStatus('connecting');

    try {
      this.ws = new WebSocket(this.url);

      // Timeout: if not connected within 8 seconds, give up this attempt
      this.connectTimeout = setTimeout(() => {
        if (this._status === 'connecting') {
          console.warn('[LuminaDeckClient] ws?.close() at', new Error().stack?.split('\n').slice(1, 4).join(' | '));
      this.ws?.close();
          this.setStatus('error');
          if (this.shouldReconnect) {
            this.scheduleReconnect();
          }
        }
      }, 8000);

      this.ws.onopen = () => {
        if (this.connectTimeout) {
          clearTimeout(this.connectTimeout);
          this.connectTimeout = null;
        }
        this.reconnectAttempt = 0;
        this.missedHeartbeats = 0;
        void this.ensureDeviceId().then((deviceId) => {
          if (this.ws?.readyState !== WebSocket.OPEN) return;

          // Send authenticated hello. Pairing secret comes from the QR code
          // and is persisted with the saved PC; companions reject control
          // messages until this succeeds.
          this.ws.send(JSON.stringify({
            type: 'hello',
            protocolVersion: PROTOCOL_VERSION,
            clientVersion: '1.3.2',
            deviceName: this.deviceName,
            deviceId,
            pairingSecret: this.pairingSecret ?? undefined,
            proStatus: this.proStatus ?? undefined,
          }));

          this.startHeartbeat();
        }).catch(() => {
          this.shouldReconnect = false;
          this.setStatus('error');
          console.warn('[LuminaDeckClient] ws?.close() at', new Error().stack?.split('\n').slice(1, 4).join(' | '));
      this.ws?.close();
        });
      };

      this.ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data as string) as CompanionMessage;
          if (msg.type === 'pong') {
            this.missedHeartbeats = 0;
          }
          // Opt into Studio-pushed profile updates when the companion
          // speaks a compatible protocol. Older companions reject the
          // request; no harm done there.
          if (msg.type === 'hello_ack') {
            this.setStatus('connected');
            if (isClientCompatible(msg.protocolVersion, MIN_FEATURE_PROFILE_UPDATE)) {
              this.send({ type: 'subscribe_profile' });
            }
            // v1.4: persist the companion-issued pair-key + port into
            // iOS Keychain so the WidgetKit extension and Apple Watch
            // can sign HMAC `/intent-execute` requests. Host comes from
            // the WS URL we connected to. Fire-and-forget — failures
            // here only degrade widget surfaces, not the WS path.
            if (msg.intentEndpoint && msg.intentEndpoint.pairKey) {
              const host = this.url.replace(/^wss?:\/\//, '').split(':')[0] ?? '';
              if (host) {
                void import('./intentEndpointStore').then(({ saveIntentEndpoint }) =>
                  saveIntentEndpoint({
                    pairKey: msg.intentEndpoint!.pairKey,
                    host,
                    port: msg.intentEndpoint!.port,
                    deviceId: this.deviceId,
                  }),
                );
              }
            }
          } else if (msg.type === 'error' && msg.code === 'UNAUTHORIZED') {
            this.shouldReconnect = false;
            this.setStatus('error');
            console.warn('[LuminaDeckClient] ws?.close() at', new Error().stack?.split('\n').slice(1, 4).join(' | '));
      this.ws?.close();
          }
          this.messageListeners.forEach((l) => l(msg));
        } catch {
          // Ignore malformed messages
        }
      };

      this.ws.onclose = () => {
        if (this.connectTimeout) {
          clearTimeout(this.connectTimeout);
          this.connectTimeout = null;
        }
        this.stopHeartbeat();
        if (this.shouldReconnect) {
          this.setStatus('connecting');
          this.scheduleReconnect();
        } else if (this._status !== 'error') {
          this.setStatus('disconnected');
        }
      };

      this.ws.onerror = () => {
        if (this.connectTimeout) {
          clearTimeout(this.connectTimeout);
          this.connectTimeout = null;
        }
        this.setStatus('error');
      };
    } catch {
      this.setStatus('error');
      if (this.shouldReconnect) {
        this.scheduleReconnect();
      }
    }
  }

  private startHeartbeat(): void {
    this.heartbeatTimer = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.missedHeartbeats++;
        if (this.missedHeartbeats >= HEARTBEAT_MISS_THRESHOLD) {
          console.warn('[LuminaDeckClient] ws.close() at', new Error().stack?.split('\n').slice(1, 4).join(' | '));
      this.ws.close();
          return;
        }
        this.send({ type: 'ping', timestamp: Date.now() });
      }
    }, HEARTBEAT_INTERVAL_MS);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private async ensureDeviceId(): Promise<string> {
    // Never let a SecureStore failure abort the connection. Previous code
    // let getItemAsync/setItemAsync rejections bubble up to the onopen
    // .catch, which closed the WS and nuked pairing entirely. The deviceId
    // is just a stable identifier — losing persistence across launches is
    // a minor UX regression vs not connecting at all.
    try {
      const existing = await SecureStore.getItemAsync(DEVICE_ID_KEY);
      if (existing) {
        this.deviceId = existing;
        return existing;
      }
    } catch (e) {
      console.warn('[LuminaDeckClient] SecureStore.getItemAsync failed, falling back to in-memory deviceId:', e);
    }

    const generated = this.deviceId || generateDeviceId();
    this.deviceId = generated;
    try {
      await SecureStore.setItemAsync(DEVICE_ID_KEY, generated);
    } catch (e) {
      console.warn('[LuminaDeckClient] SecureStore.setItemAsync failed, deviceId will not persist:', e);
    }
    return generated;
  }

  private static readonly MAX_RECONNECT_ATTEMPTS = 5;

  private scheduleReconnect(): void {
    if (this.reconnectAttempt >= LuminaDeckClient.MAX_RECONNECT_ATTEMPTS) {
      this.shouldReconnect = false;
      this.setStatus('error');
      return;
    }

    const delayIndex = Math.min(this.reconnectAttempt, RECONNECT_DELAYS_MS.length - 1);
    const delay = Math.min(RECONNECT_DELAYS_MS[delayIndex], RECONNECT_MAX_DELAY_MS);

    this.reconnectTimer = setTimeout(() => {
      this.reconnectAttempt++;
      this.doConnect();
    }, delay);
  }

  private cleanup(): void {
    this.stopHeartbeat();
    if (this.connectTimeout) {
      clearTimeout(this.connectTimeout);
      this.connectTimeout = null;
    }
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.onopen = null;
      this.ws.onmessage = null;
      this.ws.onclose = null;
      this.ws.onerror = null;
      if (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING) {
        console.warn('[LuminaDeckClient] ws.close() at', new Error().stack?.split('\n').slice(1, 4).join(' | '));
      this.ws.close();
      }
      this.ws = null;
    }
  }

  private setStatus(status: ConnectionStatus): void {
    this._status = status;
    this.statusListeners.forEach((l) => l(status));
  }
}

/** Singleton client instance */
export const client = new LuminaDeckClient();
