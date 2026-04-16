import { describe, it, expect } from 'vitest';
import {
  validateAction,
  validateClientMessage,
  keybindSchema,
  appLaunchSchema,
  systemActionSchema,
  multiActionSchema,
} from './validation';
import { VALID_KEYS, resolveKey, isModifier, isExtendedKey } from './keys';

// --- Key Allowlist Tests ---

describe('Key Allowlist', () => {
  it('contains all 26 letters', () => {
    for (const ch of 'abcdefghijklmnopqrstuvwxyz') {
      expect(VALID_KEYS.has(ch)).toBe(true);
    }
  });

  it('contains digits 0-9', () => {
    for (let i = 0; i <= 9; i++) {
      expect(VALID_KEYS.has(String(i))).toBe(true);
    }
  });

  it('contains function keys f1-f24', () => {
    for (let i = 1; i <= 24; i++) {
      expect(VALID_KEYS.has(`f${i}`)).toBe(true);
    }
  });

  it('contains modifier keys', () => {
    for (const mod of ['ctrl', 'shift', 'alt', 'win', 'lctrl', 'rctrl']) {
      expect(VALID_KEYS.has(mod)).toBe(true);
    }
  });

  it('contains media keys', () => {
    for (const key of ['media_play_pause', 'media_next', 'media_prev', 'volume_up', 'volume_down', 'volume_mute']) {
      expect(VALID_KEYS.has(key)).toBe(true);
    }
  });

  it('has at least 120 keys', () => {
    expect(VALID_KEYS.size).toBeGreaterThanOrEqual(120);
  });

  it('resolveKey returns VK code for valid keys', () => {
    expect(resolveKey('a')).toBe(0x41);
    expect(resolveKey('ctrl')).toBe(0xa2);
    expect(resolveKey('f1')).toBe(0x70);
    expect(resolveKey('enter')).toBe(0x0d);
  });

  it('resolveKey returns undefined for invalid keys', () => {
    expect(resolveKey('invalid')).toBeUndefined();
    expect(resolveKey('exec')).toBeUndefined();
  });

  it('resolveKey is case-insensitive', () => {
    expect(resolveKey('A')).toBe(0x41);
    expect(resolveKey('CTRL')).toBe(0xa2);
  });

  it('isModifier identifies modifier keys', () => {
    expect(isModifier('ctrl')).toBe(true);
    expect(isModifier('shift')).toBe(true);
    expect(isModifier('alt')).toBe(true);
    expect(isModifier('win')).toBe(true);
    expect(isModifier('a')).toBe(false);
    expect(isModifier('f1')).toBe(false);
  });

  it('isExtendedKey identifies extended keys', () => {
    expect(isExtendedKey('up')).toBe(true);
    expect(isExtendedKey('volume_up')).toBe(true);
    expect(isExtendedKey('a')).toBe(false);
    expect(isExtendedKey('ctrl')).toBe(false);
  });
});

// --- Keybind Validation ---

describe('keybindSchema', () => {
  it('accepts valid keybind', () => {
    const result = keybindSchema.safeParse({ type: 'keybind', keys: ['ctrl', 'c'] });
    expect(result.success).toBe(true);
  });

  it('accepts single key', () => {
    const result = keybindSchema.safeParse({ type: 'keybind', keys: ['f5'] });
    expect(result.success).toBe(true);
  });

  it('rejects empty keys', () => {
    const result = keybindSchema.safeParse({ type: 'keybind', keys: [] });
    expect(result.success).toBe(false);
  });

  it('rejects more than 6 keys', () => {
    const result = keybindSchema.safeParse({
      type: 'keybind',
      keys: ['a', 'b', 'c', 'd', 'e', 'f', 'g'],
    });
    expect(result.success).toBe(false);
  });

  it('rejects keys not in allowlist', () => {
    const result = keybindSchema.safeParse({ type: 'keybind', keys: ['invalid_key'] });
    expect(result.success).toBe(false);
  });

  it('rejects shell-injection-like key names', () => {
    const result = keybindSchema.safeParse({ type: 'keybind', keys: ['cmd.exe'] });
    expect(result.success).toBe(false);
  });
});

// --- App Launch Validation ---

describe('appLaunchSchema', () => {
  it('accepts valid exe path', () => {
    const result = appLaunchSchema.safeParse({
      type: 'app_launch',
      path: 'C:\\Program Files\\App\\app.exe',
    });
    expect(result.success).toBe(true);
  });

  it('accepts path with args', () => {
    const result = appLaunchSchema.safeParse({
      type: 'app_launch',
      path: 'C:\\app.exe',
      args: ['--verbose', '--port=8080'],
    });
    expect(result.success).toBe(true);
  });

  it('rejects path with directory traversal', () => {
    const result = appLaunchSchema.safeParse({
      type: 'app_launch',
      path: 'C:\\..\\Windows\\System32\\cmd.exe',
    });
    expect(result.success).toBe(false);
  });

  it('rejects path with tilde', () => {
    const result = appLaunchSchema.safeParse({
      type: 'app_launch',
      path: '~\\malicious.exe',
    });
    expect(result.success).toBe(false);
  });

  it('rejects non-executable extensions', () => {
    const result = appLaunchSchema.safeParse({
      type: 'app_launch',
      path: 'C:\\file.txt',
    });
    expect(result.success).toBe(false);
  });

  it('rejects empty path', () => {
    const result = appLaunchSchema.safeParse({
      type: 'app_launch',
      path: '',
    });
    expect(result.success).toBe(false);
  });
});

// --- System Action Validation ---

describe('systemActionSchema', () => {
  it('accepts valid system actions', () => {
    for (const action of ['volume_up', 'volume_down', 'media_play_pause', 'screenshot', 'lock_screen']) {
      const result = systemActionSchema.safeParse({ type: 'system_action', action });
      expect(result.success).toBe(true);
    }
  });

  it('rejects invalid system action', () => {
    const result = systemActionSchema.safeParse({
      type: 'system_action',
      action: 'shutdown_computer',
    });
    expect(result.success).toBe(false);
  });
});

// --- Multi-Action Validation ---

describe('multiActionSchema', () => {
  it('accepts valid multi-action', () => {
    const result = multiActionSchema.safeParse({
      type: 'multi_action',
      actions: [
        { type: 'keybind', keys: ['ctrl', 'c'] },
        { type: 'system_action', action: 'volume_up' },
      ],
      delays: [500],
    });
    expect(result.success).toBe(true);
  });

  it('rejects empty actions array', () => {
    const result = multiActionSchema.safeParse({
      type: 'multi_action',
      actions: [],
    });
    expect(result.success).toBe(false);
  });

  it('rejects more than 20 actions', () => {
    const actions = Array.from({ length: 21 }, () => ({
      type: 'keybind' as const,
      keys: ['a'],
    }));
    const result = multiActionSchema.safeParse({
      type: 'multi_action',
      actions,
    });
    expect(result.success).toBe(false);
  });
});

// --- validateAction helper ---

describe('validateAction', () => {
  it('returns success for valid keybind', () => {
    const result = validateAction({ type: 'keybind', keys: ['ctrl', 'shift', 'm'] });
    expect(result.success).toBe(true);
  });

  it('returns error string for invalid payload', () => {
    const result = validateAction({ type: 'invalid' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(typeof result.error).toBe('string');
      expect(result.error.length).toBeGreaterThan(0);
    }
  });

  it('returns error for null input', () => {
    const result = validateAction(null);
    expect(result.success).toBe(false);
  });
});

// --- validateClientMessage ---

describe('validateClientMessage', () => {
  it('validates execute message', () => {
    const result = validateClientMessage({
      type: 'execute',
      id: 'msg-001',
      action: { type: 'keybind', keys: ['f5'] },
    });
    expect(result.success).toBe(true);
  });

  it('validates ping message', () => {
    const result = validateClientMessage({
      type: 'ping',
      timestamp: Date.now(),
    });
    expect(result.success).toBe(true);
  });

  it('validates pair_request message', () => {
    const result = validateClientMessage({
      type: 'pair_request',
      deviceName: 'iPhone 15',
      deviceId: 'abc-123',
    });
    expect(result.success).toBe(true);
  });

  it('rejects unknown message type', () => {
    const result = validateClientMessage({
      type: 'unknown',
      data: 'malicious',
    });
    expect(result.success).toBe(false);
  });

  it('rejects execute with invalid action', () => {
    const result = validateClientMessage({
      type: 'execute',
      id: 'msg-002',
      action: { type: 'keybind', keys: ['not_a_real_key'] },
    });
    expect(result.success).toBe(false);
  });
});
