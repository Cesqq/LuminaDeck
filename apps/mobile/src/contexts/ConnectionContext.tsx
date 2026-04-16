import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ConnectionStatus } from '@luminadeck/shared';
import { LuminaDeckClient } from '../lib/websocket';

const LAST_CONNECTION_KEY = '@luminadeck/last_connection';

interface LastConnection {
  ip: string;
  port: number;
}

interface ConnectionContextValue {
  status: ConnectionStatus;
  client: LuminaDeckClient;
  connectedIp: string | null;
  connect: (ip: string, port: number) => void;
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

  useEffect(() => {
    const unsubscribe = clientRef.current.onStatus((newStatus) => {
      setStatus(newStatus);
    });
    return unsubscribe;
  }, []);

  // Auto-reconnect to last known PC on app launch
  useEffect(() => {
    AsyncStorage.getItem(LAST_CONNECTION_KEY).then((raw) => {
      if (raw) {
        try {
          const last: LastConnection = JSON.parse(raw);
          if (last.ip && last.port) {
            setConnectedIp(last.ip);
            clientRef.current.connect(last.ip, last.port);
          }
        } catch {
          // Corrupted — ignore
        }
      }
    });
  }, []);

  const connect = useCallback((ip: string, port: number) => {
    setConnectedIp(ip);
    clientRef.current.connect(ip, port);

    // Persist for auto-reconnect
    const data: LastConnection = { ip, port };
    AsyncStorage.setItem(LAST_CONNECTION_KEY, JSON.stringify(data));
  }, []);

  const disconnect = useCallback(() => {
    setConnectedIp(null);
    clientRef.current.disconnect();
    AsyncStorage.removeItem(LAST_CONNECTION_KEY);
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
