import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import type { ConnectionStatus } from '@luminadeck/shared';
import { LuminaDeckClient } from '../lib/websocket';

interface ConnectionContextValue {
  status: ConnectionStatus;
  client: LuminaDeckClient;
  connect: (ip: string, port: number) => void;
  disconnect: () => void;
}

const clientInstance = new LuminaDeckClient();

const ConnectionContext = createContext<ConnectionContextValue>({
  status: 'disconnected',
  client: clientInstance,
  connect: () => {},
  disconnect: () => {},
});

export function ConnectionProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const clientRef = useRef(clientInstance);

  useEffect(() => {
    const unsubscribe = clientRef.current.onStatus((newStatus) => {
      setStatus(newStatus);
    });
    return unsubscribe;
  }, []);

  const connect = (ip: string, port: number) => {
    clientRef.current.connect(ip, port);
  };

  const disconnect = () => {
    clientRef.current.disconnect();
  };

  return (
    <ConnectionContext.Provider
      value={{
        status,
        client: clientRef.current,
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
