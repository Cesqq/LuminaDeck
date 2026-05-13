import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Alert, Platform } from 'react-native';
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
import { redeemCompCode, describeRedeemFailure, proStatusFromRedeem } from '../lib/compCodes';

type Limits = typeof FREE_LIMITS | typeof PRO_LIMITS;

type RedeemOutcome =
  | { ok: true; tier: 'lifetime' | 'pro_1y' | 'pro_30d'; idempotent: boolean }
  | { ok: false; message: string };

interface ProContextValue {
  isPro: boolean;
  proStatus: ProStatus;
  limits: Limits;
  priceString: string;
  isPurchasing: boolean;
  isRestoring: boolean;
  isRedeeming: boolean;
  purchase: () => Promise<void>;
  restore: () => Promise<void>;
  redeem: (code: string) => Promise<RedeemOutcome>;
  setPro: (status: ProStatus) => void;
}

const defaultProStatus: ProStatus = {
  isPro: false,
  plan: 'free',
  source: 'none',
};

const storeSource = (): ProStatus['source'] =>
  Platform.OS === 'android' ? 'google_play' : 'apple_iap';

const ProContext = createContext<ProContextValue>({
  isPro: false,
  proStatus: defaultProStatus,
  limits: FREE_LIMITS,
  priceString: '$9.99',
  isPurchasing: false,
  isRestoring: false,
  isRedeeming: false,
  purchase: async () => {},
  restore: async () => {},
  redeem: async () => ({ ok: false, message: 'Not initialized' }),
  setPro: () => {},
});

export function ProProvider({ children }: { children: React.ReactNode }) {
  const [proStatus, setProStatus] = useState<ProStatus>(defaultProStatus);
  const [priceString, setPriceString] = useState('$9.99');
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [isRedeeming, setIsRedeeming] = useState(false);

  useEffect(() => {
    // Load cached Pro status
    loadProStatus().then(setProStatus);

    // Initialize RevenueCat and sync entitlement
    configureIAP().then(async () => {
      if (!isIAPAvailable()) {
        // Production safety: a missing RevenueCat key must never unlock Pro.
        clearProStatus();
        setProStatus(defaultProStatus);
        return;
      }

      const price = await getProPrice();
      setPriceString(price);

      const hasEntitlement = await checkProEntitlement();
      if (hasEntitlement) {
        setProStatus({ isPro: true, plan: 'lifetime', source: storeSource() });
      } else {
        setProStatus(defaultProStatus);
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
      Alert.alert('Purchase Unavailable', 'In-App Purchases are not configured for this build.');
      return;
    }

    setIsPurchasing(true);
    try {
      const success = await purchasePro();
      if (success) {
        setPro({ isPro: true, plan: 'lifetime', source: storeSource(), purchaseDate: new Date().toISOString() });
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
        setPro({ isPro: true, plan: 'lifetime', source: storeSource(), purchaseDate: new Date().toISOString() });
        Alert.alert('Restored', 'Your Pro purchase has been restored.');
      } else {
        Alert.alert('No Purchase Found', 'No previous Pro purchase was found for this Apple ID.');
      }
    } catch (e: any) {
      Alert.alert('Restore Failed', e?.message ?? 'Something went wrong. Please try again.');
    } finally {
      setIsRestoring(false);
    }
  }, [setPro]);

  const redeem = useCallback(async (code: string): Promise<RedeemOutcome> => {
    setIsRedeeming(true);
    try {
      const result = await redeemCompCode({ code });
      if (result.ok) {
        // Flip ProContext state — saveProStatus already ran inside redeemCompCode
        setProStatus(proStatusFromRedeem(result));
        return { ok: true, tier: result.tier, idempotent: result.idempotent === true };
      }
      return { ok: false, message: describeRedeemFailure(result.reason) };
    } finally {
      setIsRedeeming(false);
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
        isRedeeming,
        purchase,
        restore,
        redeem,
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
