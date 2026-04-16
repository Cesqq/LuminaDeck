import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { ProStatus } from '@luminadeck/shared';
import { FREE_LIMITS, PRO_LIMITS } from '@luminadeck/shared';
import { loadSettings, saveSettings } from '../lib/storage';

type Limits = typeof FREE_LIMITS | typeof PRO_LIMITS;

interface ProContextValue {
  isPro: boolean;
  proStatus: ProStatus;
  limits: Limits;
  setPro: (status: ProStatus) => void;
}

const defaultProStatus: ProStatus = {
  isPro: false,
  source: 'none',
};

const ProContext = createContext<ProContextValue>({
  isPro: false,
  proStatus: defaultProStatus,
  limits: FREE_LIMITS,
  setPro: () => {},
});

export function ProProvider({ children }: { children: React.ReactNode }) {
  const [proStatus, setProStatus] = useState<ProStatus>(defaultProStatus);

  useEffect(() => {
    loadSettings().then((settings) => {
      if (settings?.proStatus) {
        setProStatus(settings.proStatus);
      }
    });
  }, []);

  const setPro = useCallback((status: ProStatus) => {
    setProStatus(status);
    loadSettings().then((prev) => {
      saveSettings({ ...prev, proStatus: status });
    });
  }, []);

  const limits = proStatus.isPro ? PRO_LIMITS : FREE_LIMITS;

  return (
    <ProContext.Provider
      value={{
        isPro: proStatus.isPro,
        proStatus,
        limits,
        setPro,
      }}
    >
      {children}
    </ProContext.Provider>
  );
}

export function usePro(): ProContextValue {
  return useContext(ProContext);
}
