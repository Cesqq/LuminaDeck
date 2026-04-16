/**
 * RevenueCat IAP integration for LuminaDeck Pro.
 *
 * Uses react-native-purchases (RevenueCat SDK) for:
 * - Apple In-App Purchase flow
 * - Server-side receipt validation
 * - Restore purchases
 * - Entitlement tracking
 *
 * Free under $2.5K monthly tracked revenue.
 */

import Purchases, {
  type CustomerInfo,
  type PurchasesPackage,
  LOG_LEVEL,
} from 'react-native-purchases';
import { Platform } from 'react-native';
import { saveProStatus, clearProStatus } from './pro';

// RevenueCat API keys — will be replaced with real values from .env
const REVENUECAT_IOS_KEY = process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY ?? '';
const REVENUECAT_ANDROID_KEY = process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY ?? '';

// RevenueCat entitlement identifier (configured in RC dashboard)
const PRO_ENTITLEMENT = 'pro';

// RevenueCat offering identifier
const PRO_OFFERING = 'default';

let isConfigured = false;

/**
 * Initialize RevenueCat SDK. Must be called once at app startup.
 */
export async function configureIAP(): Promise<void> {
  if (isConfigured) return;

  const apiKey = Platform.OS === 'ios' ? REVENUECAT_IOS_KEY : REVENUECAT_ANDROID_KEY;

  if (!apiKey) {
    console.log('[IAP] No RevenueCat API key configured — IAP disabled');
    return;
  }

  try {
    if (__DEV__) {
      Purchases.setLogLevel(LOG_LEVEL.DEBUG);
    }

    Purchases.configure({ apiKey });
    isConfigured = true;
    console.log('[IAP] RevenueCat configured');
  } catch (e) {
    console.error('[IAP] Configuration failed:', e);
  }
}

/**
 * Check if IAP is available (RevenueCat configured with real key).
 */
export function isIAPAvailable(): boolean {
  return isConfigured;
}

/**
 * Get the Pro package from the default offering.
 * Returns null if not available or not configured.
 */
export async function getProPackage(): Promise<PurchasesPackage | null> {
  if (!isConfigured) return null;

  try {
    const offerings = await Purchases.getOfferings();
    const current = offerings.current;
    if (!current) return null;

    // Look for the lifetime or annual package
    return current.lifetime ?? current.annual ?? current.availablePackages[0] ?? null;
  } catch (e) {
    console.error('[IAP] Failed to get offerings:', e);
    return null;
  }
}

/**
 * Purchase the Pro upgrade.
 * Returns true if purchase succeeded, false if cancelled or failed.
 */
export async function purchasePro(): Promise<boolean> {
  if (!isConfigured) return false;

  try {
    const pkg = await getProPackage();
    if (!pkg) {
      console.error('[IAP] No Pro package available');
      return false;
    }

    const { customerInfo } = await Purchases.purchasePackage(pkg);
    return checkEntitlement(customerInfo);
  } catch (e: any) {
    if (e.userCancelled) {
      // User cancelled — not an error
      return false;
    }
    console.error('[IAP] Purchase failed:', e);
    throw e;
  }
}

/**
 * Restore previous purchases (required by App Store guidelines).
 * Returns true if Pro entitlement is found.
 */
export async function restorePurchases(): Promise<boolean> {
  if (!isConfigured) return false;

  try {
    const customerInfo = await Purchases.restorePurchases();
    return checkEntitlement(customerInfo);
  } catch (e) {
    console.error('[IAP] Restore failed:', e);
    throw e;
  }
}

/**
 * Check current entitlement status.
 * Call this on app launch to sync Pro status.
 */
export async function checkProEntitlement(): Promise<boolean> {
  if (!isConfigured) return false;

  try {
    const customerInfo = await Purchases.getCustomerInfo();
    return checkEntitlement(customerInfo);
  } catch (e) {
    console.error('[IAP] Entitlement check failed:', e);
    return false;
  }
}

/**
 * Get the formatted price string for the Pro package.
 * Returns "$9.99" or equivalent localized price.
 */
export async function getProPrice(): Promise<string> {
  const pkg = await getProPackage();
  if (!pkg) return '$9.99'; // Fallback display price
  return pkg.product.priceString;
}

// --- Internal ---

function checkEntitlement(customerInfo: CustomerInfo): boolean {
  const hasEntitlement = PRO_ENTITLEMENT in customerInfo.entitlements.active;

  if (hasEntitlement) {
    saveProStatus(true, 'apple_iap');
  } else {
    clearProStatus();
  }

  return hasEntitlement;
}
