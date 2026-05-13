import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import type { ConnectionStatus, ProfileConfig } from '@luminadeck/shared';
import { TELEMETRY_EVENTS } from '@luminadeck/shared';
import { LuminaDeckClient } from '../lib/websocket';
import { track } from '../lib/telemetry';
import { useProfiles } from './ProfileContext';
import {
  subscribeWatchTaps,
  subscribeWatchMouseMove,
  subscribeWatchMouseClick,
  subscribeWatchScroll,
  subscribeWatchTextInput,
} from '../lib/watchBridge';
import { isClipboardSyncEnabled, startClipboardSync } from '../lib/clipboardSync';

const LAST_CONNECTION_KEY = '@luminadeck/last_connection';

interface LastConnection {
  ip: string;
  port: number;
  pairingSecret?: string;
}

interface ConnectionContextValue {
  status: ConnectionStatus;
  client: LuminaDeckClient;
  connectedIp: string | null;
  connect: (ip: string, port: number, pairingSecret?: string) => void;
  disconnect: () => void;
}

const clientInstance = new LuminaDeckClient();

const ConnectionContext = createContext<ConnectionContextValue>({
  status: 'disconnected',
  client: clientInstance,
  connectedIp: null,
  connect: () => {},
  disconnect: () => {},
});

export function ConnectionProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const [connectedIp, setConnectedIp] = useState<string | null>(null);
  const clientRef = useRef(clientInstance);
  const { upsertProfile } = useProfiles();

  useEffect(() => {
    const unsubscribe = clientRef.current.onStatus((newStatus) => {
      setStatus(newStatus);
    });
    return unsubscribe;
  }, []);

  // Apply Studio-pushed profile updates to local storage + activate the
  // profile so HomeScreen immediately reflects the new deck layout. Also
  // honour `profile_switch` from the auto-profile matcher.
  const { setActiveProfile, activeProfile } = useProfiles();
  const activeProfileRef = useRef<ProfileConfig | null>(activeProfile);
  useEffect(() => {
    activeProfileRef.current = activeProfile;
  }, [activeProfile]);

  // v1.4: relay Watch events to the WS. Each subscription is wired only
  // once for the lifetime of the provider — they read the active profile
  // through a ref so they pick up edits without resubscribing.
  useEffect(() => {
    const send = (msg: any) => {
      if (status === 'connected') clientRef.current.send(msg);
    };
    const unsubs = [
      subscribeWatchTaps((buttonId) => {
        const profile = activeProfileRef.current;
        if (!profile) return;
        for (const page of profile.pages) {
          const button = page.buttons.find((b) => b.id === buttonId);
          if (button?.action) {
            send({
              type: 'execute',
              id: `watch-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
              action: button.action,
            });
            return;
          }
        }
      }),
      subscribeWatchMouseMove(({ dx, dy }) => send({ type: 'mouse_move', dx, dy })),
      subscribeWatchMouseClick((button) => send({ type: 'mouse_click', button, state: 'click' })),
      subscribeWatchScroll((ticks) => send({ type: 'mouse_scroll', dy: ticks })),
      subscribeWatchTextInput((text) => {
        send({
          type: 'execute',
          id: `watch-text-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          action: { type: 'text_input', text },
        });
      }),
    ];
    return () => unsubs.forEach((u) => u());
  }, [status]);

  // v1.4: clipboard sync — only runs when (a) connected and (b) the user
  // has toggled it on in Settings. The handle is stopped on disconnect
  // so a stale poll doesn't keep firing into the void.
  useEffect(() => {
    if (status !== 'connected') return;
    let handle: { stop: () => void } | null = null;
    let cancelled = false;
    void isClipboardSyncEnabled().then((enabled) => {
      if (!enabled || cancelled) return;
      handle = startClipboardSync(clientRef.current);
    });
    return () => {
      cancelled = true;
      handle?.stop();
    };
  }, [status]);

  useEffect(() => {
    const unsubscribe = clientRef.current.onMessage((msg) => {
      if (msg.type === 'profile_update') {
        const received = msg.profile as ProfileConfig;
        if (!received || !received.id) return;
        upsertProfile(received, true);
      } else if (msg.type === 'profile_switch') {
        if (msg.profileId) {
          setActiveProfile(msg.profileId);
          // Companion matcher fired; emits `profile_switch_auto` (no
          // window-title or profile name in the payload per privacy rules).
          track(TELEMETRY_EVENTS.PROFILE_SWITCH_AUTO, {});
        }
      }
    });
    return unsubscribe;
  }, [upsertProfile, setActiveProfile]);

  // Track the current status in a ref so the AppState handler below can
  // read it without re-subscribing on every status change.
  const statusRef = useRef<ConnectionStatus>(status);
  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  // Auto-reconnect to last known PC. Triggers in two cases:
  //   1. Cold launch (initial useEffect run)
  //   2. App returns to foreground while not currently connected
  //
  // iOS suspends WebSockets when the app is backgrounded; the WS client's
  // 5-attempt internal reconnect exhausts itself within ~30s while the
  // JS thread is suspended, leaving `shouldReconnect=false` and status
  // 'error'. Without this AppState handler, the user sees the
  // "needs pairing" UI on every foreground transition. connect() resets
  // shouldReconnect + reconnectAttempt internally, so re-calling it
  // recovers cleanly from the give-up state.
  useEffect(() => {
    const reconnectFromSaved = () => {
      SecureStore.getItemAsync(LAST_CONNECTION_KEY).then((raw) => {
        if (!raw) return;
        try {
          const last: LastConnection = JSON.parse(raw);
          if (last.ip && last.port) {
            setConnectedIp(last.ip);
            clientRef.current.connect(last.ip, last.port, last.pairingSecret);
          }
        } catch {
          // Corrupted — ignore
        }
      });
    };

    reconnectFromSaved();

    const handleAppStateChange = (nextState: AppStateStatus) => {
      if (nextState === 'active' && statusRef.current !== 'connected') {
        reconnectFromSaved();
      }
    };
    const sub = AppState.addEventListener('change', handleAppStateChange);
    return () => sub.remove();
  }, []);

  const connect = useCallback((ip: string, port: number, pairingSecret?: string) => {
    setConnectedIp(ip);
    clientRef.current.connect(ip, port, pairingSecret);

    // Persist in SecureStore because the pairing secret authenticates PC control.
    const data: LastConnection = { ip, port, pairingSecret };
    SecureStore.setItemAsync(LAST_CONNECTION_KEY, JSON.stringify(data));
  }, []);

  const disconnect = useCallback(() => {
    setConnectedIp(null);
    clientRef.current.disconnect();
    SecureStore.deleteItemAsync(LAST_CONNECTION_KEY);
  }, []);

  return (
    <ConnectionContext.Provider
      value={{
        status,
        client: clientRef.current,
        connectedIp,
        connect,
        disconnect,
      }}
    >
      {children}
    </ConnectionContext.Provider>
  );
}

export function useConnection(): ConnectionContextValue {
  return useContext(ConnectionContext);
}
