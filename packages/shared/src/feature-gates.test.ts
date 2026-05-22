import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  COMPANION_CAPABILITIES,
  COMPANION_CAPABILITY_FEATURES,
  FEATURE_GATES,
} from './feature-gates';
import { ACTION_FORM_SPECS } from './action-forms';
import type { CompanionCapability } from './protocol';
import { FREE_LIMITS, PRO_LIMITS, type ActionType } from './types';

const LIMIT_FLAG_TO_FEATURE = {
  textInput: 'text_input',
  trackpad: 'trackpad',
  customImages: 'custom_images',
  gifIcons: 'gif_icons',
  multiAction: 'multi_action',
  macros: 'macro',
  obsIntegration: 'obs',
  discordIntegration: 'discord',
  profileExport: 'profile_export',
  folderSupport: 'folder',
  autoProfileSwitch: 'auto_profile',
} as const;

const ACTION_TYPE_TO_FEATURE = {
  keybind: 'keybind',
  app_launch: 'app_launch',
  system_action: 'system_action',
  multi_action: 'multi_action',
  text_input: 'text_input',
  folder: 'folder',
  timer: 'timer',
  counter: 'counter',
  obs: 'obs',
  discord: 'discord',
  macro: 'macro',
  trackpad: 'trackpad',
} as const satisfies Record<ActionType, keyof typeof FEATURE_GATES>;

function repoRoot(): string {
  let dir = process.cwd();
  while (dirname(dir) !== dir) {
    if (existsSync(resolve(dir, 'package.json')) && existsSync(resolve(dir, 'apps'))) {
      return dir;
    }
    dir = dirname(dir);
  }
  throw new Error(`Could not find repo root from ${process.cwd()}`);
}

function rustAdvertisedCapabilities(): string[] {
  const serverPath = resolve(repoRoot(), 'apps/companion/src-tauri/src/server.rs');
  const source = readFileSync(serverPath, 'utf8');
  const match = source.match(/const ADVERTISED_CAPABILITIES:\s*&\[&str\]\s*=\s*&\[(?<body>[\s\S]*?)\];/);
  if (!match?.groups?.body) {
    throw new Error('Could not parse ADVERTISED_CAPABILITIES from server.rs');
  }
  return [...match.groups.body.matchAll(/"([^"]+)"/g)].map((m) => m[1]);
}

describe('FEATURE_GATES', () => {
  it('derives mobile FREE_LIMITS and PRO_LIMITS boolean flags', () => {
    const limitKeys = Object.keys(LIMIT_FLAG_TO_FEATURE) as Array<keyof typeof LIMIT_FLAG_TO_FEATURE>;
    for (const limitKey of limitKeys) {
      const feature = LIMIT_FLAG_TO_FEATURE[limitKey];
      expect(FREE_LIMITS[limitKey]).toBe(FEATURE_GATES[feature].free);
      expect(PRO_LIMITS[limitKey]).toBe(FEATURE_GATES[feature].pro);
    }
  });

  it('derives action form free/pro flags from the same map', () => {
    const actionTypes = Object.keys(ACTION_TYPE_TO_FEATURE) as ActionType[];
    for (const actionType of actionTypes) {
      const feature = ACTION_TYPE_TO_FEATURE[actionType];
      expect(ACTION_FORM_SPECS[actionType].free).toBe(FEATURE_GATES[feature].free);
    }
  });

  it('derives protocol companion capabilities from enabled feature gates', () => {
    const expected = COMPANION_CAPABILITY_FEATURES.filter(
      (feature) => FEATURE_GATES[feature].free || FEATURE_GATES[feature].pro,
    );

    expect(COMPANION_CAPABILITIES).toEqual(expected);
    expect(COMPANION_CAPABILITIES).toContain('text_input');
    expect(COMPANION_CAPABILITIES).toContain('trackpad');
    expect(COMPANION_CAPABILITIES).not.toContain('obs');

    const typedTextInput: CompanionCapability = 'text_input';
    const typedTrackpad: CompanionCapability = 'trackpad';
    expect([typedTextInput, typedTrackpad]).toEqual(['text_input', 'trackpad']);

    // OBS stays off until FEATURE_GATES.obs.free/pro flips true.
    // @ts-expect-error OBS is intentionally not an enabled CompanionCapability.
    const _obsCapability: CompanionCapability = 'obs';
    expect(_obsCapability).toBe('obs');
  });

  it('keeps Rust ADVERTISED_CAPABILITIES in sync with the TS map', () => {
    expect(rustAdvertisedCapabilities()).toEqual(COMPANION_CAPABILITIES);
  });
});
