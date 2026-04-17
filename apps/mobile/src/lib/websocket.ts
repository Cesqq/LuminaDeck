import {
  HEARTBEAT_INTERVAL_MS,
  HEARTBEAT_MISS_THRESHOLD,
  RECONNECT_DELAYS_MS,
  RECONNECT_MAX_DELAY_MS,
} from '@luminadeck/shared';
import type {
  ClientMessage,
  CompanionMessage,
  ConnectionStatus,
} from '@luminadeck/shared';

type StatusListener = (status: ConnectionStatus) => void;
type MessageListener = (msg: CompanionMessage) => void;

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

  connect(ip: string, port: number, useTLS: boolean = false): void {
    const protocol = useTLS ? 'wss' : 'ws';
    this.url = `${protocol}://${ip}:${port}`;
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
    }
  }

  sendAction(action: ClientMessage extends { type: 'execute' } ? ClientMessage : never): void {
    this.send(action);
  }

  private doConnect(): void {
    this.cleanup();
    this.setStatus('connecting');

    try {
      this.ws = new WebSocket(this.url);

      this.ws.onopen = () => {
        this.reconnectAttempt = 0;
        this.missedHeartbeats = 0;
        this.setStatus('connected');
        this.startHeartbeat();
      };

      this.ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data as string) as CompanionMessage;
          if (msg.type === 'pong') {
            this.missedHeartbeats = 0;
          }
          this.messageListeners.forEach((l) => l(msg));
        } catch {
          // Ignore malformed messages
        }
      };

      this.ws.onclose = () => {
        this.stopHeartbeat();
        if (this.shouldReconnect) {
          this.setStatus('connecting');
          this.scheduleReconnect();
        } else {
          this.setStatus('disconnected');
        }
      };

      this.ws.onerror = () => {
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

  private scheduleReconnect(): void {
    const delayIndex = Math.min(this.reconnectAttempt, RECONNECT_DELAYS_MS.length - 1);
    const delay = Math.min(RECONNECT_DELAYS_MS[delayIndex], RECONNECT_MAX_DELAY_MS);

    this.reconnectTimer = setTimeout(() => {
      this.reconnectAttempt++;
      this.doConnect();
    }, delay);
  }

  private cleanup(): void {
    this.stopHeartbeat();
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
