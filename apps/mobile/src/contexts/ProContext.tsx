import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Alert } from 'react-native';
import type { ProStatus } from '@luminadeck/shared';
import { FREE_LIMITS, PRO_LIMITS } from '@luminadeck/shared';
import { loadProStatus, saveProStatus, clearProStatus } from '../lib/pro';
import {
  configureIAP,
  isIAPAvailable,
  purchasePro,
  restorePurchases,
  checkProEntitlement,
  getProPrice,
} from '../lib/iap';

type Limits = typeof FREE_LIMITS | typeof PRO_LIMITS;

interface ProContextValue {
  isPro: boolean;
  proStatus: ProStatus;
  limits: Limits;
  priceString: string;
  isPurchasing: boolean;
  isRestoring: boolean;
  purchase: () => Promise<void>;
  restore: () => Promise<void>;
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
  priceString: '$9.99',
  isPurchasing: false,
  isRestoring: false,
  purchase: async () => {},
  restore: async () => {},
  setPro: () => {},
});

export function ProProvider({ children }: { children: React.ReactNode }) {
  const [proStatus, setProStatus] = useState<ProStatus>(defaultProStatus);
  const [priceString, setPriceString] = useState('$9.99');
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);

  useEffect(() => {
    // Load cached Pro status
    loadProStatus().then(setProStatus);

    // Initialize RevenueCat and sync entitlement
    configureIAP().then(async () => {
      if (isIAPAvailable()) {
        const price = await getProPrice();
        setPriceString(price);

        const hasEntitlement = await checkProEntitlement();
        if (hasEntitlement) {
          setProStatus({ isPro: true, source: 'apple_iap' });
        }
      }
    });
  }, []);

  const setPro = useCallback((status: ProStatus) => {
    setProStatus(status);
    if (status.isPro) {
      saveProStatus(true, status.source);
    } else {
      clearProStatus();
    }
  }, []);

  const purchase = useCallback(async () => {
    if (!isIAPAvailable()) {
      // Offline/dev mode: simulate purchase
      setPro({ isPro: true, source: 'apple_iap', purchaseDate: new Date().toISOString() });
      Alert.alert('Pro Activated', 'Pro features are now available (dev mode).');
      return;
    }

    setIsPurchasing(true);
    try {
      const success = await purchasePro();
      if (success) {
        setProStatus({ isPro: true, source: 'apple_iap', purchaseDate: new Date().toISOString() });
        Alert.alert('Pro Activated', 'Thank you! All Pro features are now unlocked.');
      }
    } catch (e: any) {
      Alert.alert('Purchase Failed', e?.message ?? 'Something went wrong. Please try again.');
    } finally {
      setIsPurchasing(false);
    }
  }, [setPro]);

  const restore = useCallback(async () => {
    if (!isIAPAvailable()) {
      Alert.alert('Not Available', 'In-App Purchases are not configured.');
      return;
    }

    setIsRestoring(true);
    try {
      const found = await restorePurchases();
      if (found) {
        setProStatus({ isPro: true, source: 'apple_iap', purchaseDate: new Date().toISOString() });
        Alert.alert('Restored', 'Your Pro purchase has been restored.');
      } else {
        Alert.alert('No Purchase Found', 'No previous Pro purchase was found for this Apple ID.');
      }
    } catch (e: any) {
      Alert.alert('Restore Failed', e?.message ?? 'Something went wrong. Please try again.');
    } finally {
      setIsRestoring(false);
    }
  }, []);

  const limits = proStatus.isPro ? PRO_LIMITS : FREE_LIMITS;

  return (
    <ProContext.Provider
      value={{
        isPro: proStatus.isPro,
        proStatus,
        limits,
        priceString,
        isPurchasing,
        isRestoring,
        purchase,
        restore,
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
