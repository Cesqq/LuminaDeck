import { describe, it, expect } from 'vitest';
import {
  KEY_MAP,
  VALID_KEYS,
  MODIFIER_KEYS,
  EXTENDED_KEYS,
  MAX_COMBO_KEYS,
  resolveKey,
  isModifier,
  isExtendedKey,
} from './keys';

describe('KEY_MAP', () => {
  it('maps all 26 letters to correct VK range (0x41-0x5A)', () => {
    for (let i = 0; i < 26; i++) {
      const letter = String.fromCharCode(97 + i); // a-z
      expect(KEY_MAP[letter]).toBe(0x41 + i);
    }
  });

  it('maps digits 0-9 to correct VK range (0x30-0x39)', () => {
    for (let i = 0; i <= 9; i++) {
      expect(KEY_MAP[String(i)]).toBe(0x30 + i);
    }
  });

  it('maps F1-F12 to correct VK range (0x70-0x7B)', () => {
    for (let i = 1; i <= 12; i++) {
      expect(KEY_MAP[`f${i}`]).toBe(0x70 + i - 1);
    }
  });

  it('maps F13-F24 to correct VK range (0x7C-0x87)', () => {
    for (let i = 13; i <= 24; i++) {
      expect(KEY_MAP[`f${i}`]).toBe(0x7C + i - 13);
    }
  });

  it('maps modifier keys to correct VK codes', () => {
    expect(KEY_MAP['ctrl']).toBe(0xA2);
    expect(KEY_MAP['shift']).toBe(0xA0);
    expect(KEY_MAP['alt']).toBe(0xA4);
    expect(KEY_MAP['win']).toBe(0x5B);
  });

  it('maps left/right modifier variants', () => {
    expect(KEY_MAP['lctrl']).toBe(0xA2);
    expect(KEY_MAP['rctrl']).toBe(0xA3);
    expect(KEY_MAP['lshift']).toBe(0xA0);
    expect(KEY_MAP['rshift']).toBe(0xA1);
    expect(KEY_MAP['lalt']).toBe(0xA4);
    expect(KEY_MAP['ralt']).toBe(0xA5);
  });

  it('maps navigation keys', () => {
    expect(KEY_MAP['up']).toBe(0x26);
    expect(KEY_MAP['down']).toBe(0x28);
    expect(KEY_MAP['left']).toBe(0x25);
    expect(KEY_MAP['right']).toBe(0x27);
    expect(KEY_MAP['home']).toBe(0x24);
    expect(KEY_MAP['end']).toBe(0x23);
    expect(KEY_MAP['pageup']).toBe(0x21);
    expect(KEY_MAP['pagedown']).toBe(0x22);
  });

  it('maps editing keys', () => {
    expect(KEY_MAP['enter']).toBe(0x0D);
    expect(KEY_MAP['tab']).toBe(0x09);
    expect(KEY_MAP['space']).toBe(0x20);
    expect(KEY_MAP['backspace']).toBe(0x08);
    expect(KEY_MAP['delete']).toBe(0x2E);
    expect(KEY_MAP['escape']).toBe(0x1B);
  });

  it('maps media keys', () => {
    expect(KEY_MAP['media_play_pause']).toBe(0xB3);
    expect(KEY_MAP['media_next']).toBe(0xB0);
    expect(KEY_MAP['media_prev']).toBe(0xB1);
    expect(KEY_MAP['volume_up']).toBe(0xAF);
    expect(KEY_MAP['volume_down']).toBe(0xAE);
    expect(KEY_MAP['volume_mute']).toBe(0xAD);
  });

  it('has alias keys that map to same VK', () => {
    expect(KEY_MAP['enter']).toBe(KEY_MAP['return']);
    expect(KEY_MAP['escape']).toBe(KEY_MAP['esc']);
    expect(KEY_MAP['ctrl']).toBe(KEY_MAP['lctrl']);
  });

  it('maps all numpad keys', () => {
    for (let i = 0; i <= 9; i++) {
      expect(KEY_MAP[`numpad${i}`]).toBe(0x60 + i);
    }
    expect(KEY_MAP['numpad_multiply']).toBe(0x6A);
    expect(KEY_MAP['numpad_add']).toBe(0x6B);
    expect(KEY_MAP['numpad_subtract']).toBe(0x6D);
    expect(KEY_MAP['numpad_decimal']).toBe(0x6E);
    expect(KEY_MAP['numpad_divide']).toBe(0x6F);
  });

  it('does not contain dangerous keys', () => {
    const dangerous = ['cmd.exe', 'powershell', 'bash', 'rm', 'del', 'format'];
    for (const key of dangerous) {
      expect(KEY_MAP[key]).toBeUndefined();
    }
  });
});

describe('VALID_KEYS set', () => {
  it('has at least 120 entries', () => {
    expect(VALID_KEYS.size).toBeGreaterThanOrEqual(120);
  });

  it('is consistent with KEY_MAP', () => {
    expect(VALID_KEYS.size).toBe(Object.keys(KEY_MAP).length);
    for (const key of Object.keys(KEY_MAP)) {
      expect(VALID_KEYS.has(key)).toBe(true);
    }
  });
});

describe('MODIFIER_KEYS set', () => {
  it('contains all modifier variants', () => {
    const expected = ['ctrl', 'lctrl', 'rctrl', 'shift', 'lshift', 'rshift', 'alt', 'lalt', 'ralt', 'win', 'lwin', 'rwin'];
    for (const mod of expected) {
      expect(MODIFIER_KEYS.has(mod)).toBe(true);
    }
  });

  it('does not contain non-modifier keys', () => {
    expect(MODIFIER_KEYS.has('a')).toBe(false);
    expect(MODIFIER_KEYS.has('enter')).toBe(false);
    expect(MODIFIER_KEYS.has('f1')).toBe(false);
  });

  it('has exactly 12 entries', () => {
    expect(MODIFIER_KEYS.size).toBe(12);
  });
});

describe('EXTENDED_KEYS set', () => {
  it('contains arrow keys', () => {
    for (const key of ['up', 'down', 'left', 'right']) {
      expect(EXTENDED_KEYS.has(key)).toBe(true);
    }
  });

  it('contains media keys', () => {
    for (const key of ['volume_up', 'volume_down', 'volume_mute', 'media_play_pause']) {
      expect(EXTENDED_KEYS.has(key)).toBe(true);
    }
  });

  it('does not contain letter keys', () => {
    expect(EXTENDED_KEYS.has('a')).toBe(false);
    expect(EXTENDED_KEYS.has('z')).toBe(false);
  });
});

describe('MAX_COMBO_KEYS', () => {
  it('is 6', () => {
    expect(MAX_COMBO_KEYS).toBe(6);
  });
});

describe('resolveKey()', () => {
  it('resolves valid keys to VK codes', () => {
    expect(resolveKey('a')).toBe(0x41);
    expect(resolveKey('z')).toBe(0x5A);
    expect(resolveKey('0')).toBe(0x30);
    expect(resolveKey('f1')).toBe(0x70);
    expect(resolveKey('ctrl')).toBe(0xA2);
  });

  it('is case-insensitive', () => {
    expect(resolveKey('A')).toBe(resolveKey('a'));
    expect(resolveKey('CTRL')).toBe(resolveKey('ctrl'));
    expect(resolveKey('F1')).toBe(resolveKey('f1'));
    expect(resolveKey('Volume_Up')).toBe(resolveKey('volume_up'));
  });

  it('returns undefined for invalid keys', () => {
    expect(resolveKey('')).toBeUndefined();
    expect(resolveKey('invalid')).toBeUndefined();
    expect(resolveKey('cmd.exe')).toBeUndefined();
    expect(resolveKey('powershell')).toBeUndefined();
  });
});

describe('isModifier()', () => {
  it('returns true for all modifier keys', () => {
    expect(isModifier('ctrl')).toBe(true);
    expect(isModifier('shift')).toBe(true);
    expect(isModifier('alt')).toBe(true);
    expect(isModifier('win')).toBe(true);
    expect(isModifier('lctrl')).toBe(true);
    expect(isModifier('ralt')).toBe(true);
  });

  it('is case-insensitive', () => {
    expect(isModifier('CTRL')).toBe(true);
    expect(isModifier('Shift')).toBe(true);
  });

  it('returns false for non-modifier keys', () => {
    expect(isModifier('a')).toBe(false);
    expect(isModifier('enter')).toBe(false);
    expect(isModifier('f1')).toBe(false);
    expect(isModifier('space')).toBe(false);
  });
});

describe('isExtendedKey()', () => {
  it('returns true for navigation keys', () => {
    expect(isExtendedKey('up')).toBe(true);
    expect(isExtendedKey('down')).toBe(true);
    expect(isExtendedKey('home')).toBe(true);
    expect(isExtendedKey('end')).toBe(true);
    expect(isExtendedKey('insert')).toBe(true);
    expect(isExtendedKey('delete')).toBe(true);
  });

  it('is case-insensitive', () => {
    expect(isExtendedKey('UP')).toBe(true);
    expect(isExtendedKey('Volume_Up')).toBe(true);
  });

  it('returns false for non-extended keys', () => {
    expect(isExtendedKey('a')).toBe(false);
    expect(isExtendedKey('ctrl')).toBe(false);
    expect(isExtendedKey('shift')).toBe(false);
    expect(isExtendedKey('enter')).toBe(false);
  });
});
