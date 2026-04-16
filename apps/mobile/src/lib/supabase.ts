/**
 * Supabase client for LuminaDeck.
 * Used for: auth, Pro license validation, feature flags.
 * Core app works WITHOUT Supabase — this is optional backend.
 */

// NOTE: These will be replaced with actual values from .env
// For now, the app runs fully offline without Supabase
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

export interface SupabaseConfig {
  url: string;
  anonKey: string;
}

/**
 * Check if Supabase is configured (has real credentials).
 * When false, the app runs in fully offline mode.
 */
export function isSupabaseConfigured(): boolean {
  return SUPABASE_URL.length > 0 && SUPABASE_ANON_KEY.length > 0;
}

/**
 * Feature flags fetched from Supabase.
 * Falls back to all-enabled when Supabase is not configured.
 */
export interface FeatureFlags {
  proPurchasesEnabled: boolean;
  multiActionEnabled: boolean;
  customImagesEnabled: boolean;
  profileExportEnabled: boolean;
}

const DEFAULT_FLAGS: FeatureFlags = {
  proPurchasesEnabled: true,
  multiActionEnabled: true,
  customImagesEnabled: true,
  profileExportEnabled: true,
};

/**
 * Fetch feature flags from Supabase.
 * Returns defaults if Supabase is not configured or fetch fails.
 */
export async function fetchFeatureFlags(): Promise<FeatureFlags> {
  if (!isSupabaseConfigured()) {
    return DEFAULT_FLAGS;
  }

  try {
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/luminadeck_feature_flags?select=flag_key,enabled`,
      {
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
      },
    );

    if (!response.ok) return DEFAULT_FLAGS;

    const flags: Array<{ flag_key: string; enabled: boolean }> = await response.json();
    const flagMap = new Map(flags.map((f) => [f.flag_key, f.enabled]));

    return {
      proPurchasesEnabled: flagMap.get('pro_purchases_enabled') ?? true,
      multiActionEnabled: flagMap.get('multi_action_enabled') ?? true,
      customImagesEnabled: flagMap.get('custom_images_enabled') ?? true,
      profileExportEnabled: flagMap.get('profile_export_enabled') ?? true,
    };
  } catch {
    return DEFAULT_FLAGS;
  }
}

/**
 * Validate a Pro purchase receipt via Supabase edge function.
 * Returns { valid, isPro } or throws if network/auth fails.
 */
export async function validateReceipt(
  transactionId: string,
  authToken: string,
  environment: 'production' | 'sandbox' = 'production',
): Promise<{ valid: boolean; isPro: boolean }> {
  if (!isSupabaseConfigured()) {
    // Offline mode: trust local receipt cache
    return { valid: true, isPro: true };
  }

  const response = await fetch(
    `${SUPABASE_URL}/functions/v1/luminadeck-validate-receipt`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({ transactionId, environment }),
    },
  );

  if (!response.ok) {
    throw new Error(`Receipt validation failed: ${response.status}`);
  }

  return response.json();
}
