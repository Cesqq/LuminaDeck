/**
 * Single source of truth for Lumina Deck feature availability.
 *
 * Each gate answers one question: "May this tier use this feature if the
 * companion/app code supports it?"  Runtime limits (button counts, page
 * counts, etc.) stay in `types.ts`; booleans are derived from this map.
 */

export interface FeatureGate {
  free: boolean;
  pro: boolean;
}

export const FEATURE_GATES = {
  // Companion-executed actions / wire capabilities.
  keybind: { free: true, pro: true },
  app_launch: { free: true, pro: true },
  system_action: { free: true, pro: true },
  multi_action: { free: false, pro: true },
  text_input: { free: true, pro: true },
  trackpad: { free: true, pro: true },
  obs: { free: false, pro: true },
  discord: { free: false, pro: true },
  macro: { free: false, pro: true },
  window_monitor: { free: true, pro: true },
  auto_profile: { free: false, pro: true },

  // App/editor-only gates.
  custom_images: { free: false, pro: true },
  gif_icons: { free: false, pro: true },
  profile_export: { free: false, pro: true },
  folder: { free: false, pro: true },
  timer: { free: false, pro: true },
  counter: { free: false, pro: true },
} as const satisfies Record<string, FeatureGate>;

export type FeatureGateKey = keyof typeof FEATURE_GATES;
export type FeatureTier = 'free' | 'pro';

export type EnabledFeatureGateKey = {
  [K in FeatureGateKey]:
    typeof FEATURE_GATES[K]['free'] extends true
      ? K
      : typeof FEATURE_GATES[K]['pro'] extends true
        ? K
        : never;
}[FeatureGateKey];

export function isFeatureEnabledForTier(feature: FeatureGateKey, tier: FeatureTier): boolean {
  return FEATURE_GATES[feature][tier];
}

export function isFeatureEnabledForAnyTier(feature: FeatureGateKey): boolean {
  return FEATURE_GATES[feature].free || FEATURE_GATES[feature].pro;
}

export const COMPANION_CAPABILITY_FEATURES = [
  'keybind',
  'app_launch',
  'system_action',
  'multi_action',
  'text_input',
  'obs',
  'discord',
  'macro',
  'window_monitor',
  'auto_profile',
  'trackpad',
] as const satisfies readonly FeatureGateKey[];

export type CompanionCapabilityFromFeatureGates = Extract<
  EnabledFeatureGateKey,
  (typeof COMPANION_CAPABILITY_FEATURES)[number]
>;

export const COMPANION_CAPABILITIES = COMPANION_CAPABILITY_FEATURES.filter(
  isFeatureEnabledForAnyTier,
) as CompanionCapabilityFromFeatureGates[];

