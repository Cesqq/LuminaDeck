/**
 * Key-name allowlist for LuminaDeck action payloads.
 * Only these key names are accepted by the companion's SendInput executor.
 * Maps string key names to Windows Virtual Key codes (VK_*).
 */

export const KEY_MAP: Record<string, number> = {
  // Letters (a-z → VK 0x41-0x5A)
  a: 0x41, b: 0x42, c: 0x43, d: 0x44, e: 0x45, f: 0x46,
  g: 0x47, h: 0x48, i: 0x49, j: 0x4a, k: 0x4b, l: 0x4c,
  m: 0x4d, n: 0x4e, o: 0x4f, p: 0x50, q: 0x51, r: 0x52,
  s: 0x53, t: 0x54, u: 0x55, v: 0x56, w: 0x57, x: 0x58,
  y: 0x59, z: 0x5a,

  // Numbers (0-9 → VK 0x30-0x39)
  '0': 0x30, '1': 0x31, '2': 0x32, '3': 0x33, '4': 0x34,
  '5': 0x35, '6': 0x36, '7': 0x37, '8': 0x38, '9': 0x39,

  // Function keys (F1-F24 → VK 0x70-0x87)
  f1: 0x70, f2: 0x71, f3: 0x72, f4: 0x73, f5: 0x74, f6: 0x75,
  f7: 0x76, f8: 0x77, f9: 0x78, f10: 0x79, f11: 0x7a, f12: 0x7b,
  f13: 0x7c, f14: 0x7d, f15: 0x7e, f16: 0x7f, f17: 0x80, f18: 0x81,
  f19: 0x82, f20: 0x83, f21: 0x84, f22: 0x85, f23: 0x86, f24: 0x87,

  // Modifiers
  ctrl: 0xa2,      // VK_LCONTROL
  lctrl: 0xa2,     // VK_LCONTROL
  rctrl: 0xa3,     // VK_RCONTROL
  shift: 0xa0,     // VK_LSHIFT
  lshift: 0xa0,    // VK_LSHIFT
  rshift: 0xa1,    // VK_RSHIFT
  alt: 0xa4,       // VK_LMENU
  lalt: 0xa4,      // VK_LMENU
  ralt: 0xa5,      // VK_RMENU
  win: 0x5b,       // VK_LWIN
  lwin: 0x5b,      // VK_LWIN
  rwin: 0x5c,      // VK_RWIN

  // Navigation
  up: 0x26,        // VK_UP
  down: 0x28,      // VK_DOWN
  left: 0x25,      // VK_LEFT
  right: 0x27,     // VK_RIGHT
  home: 0x24,      // VK_HOME
  end: 0x23,       // VK_END
  pageup: 0x21,    // VK_PRIOR
  pagedown: 0x22,  // VK_NEXT

  // Editing
  enter: 0x0d,     // VK_RETURN
  return: 0x0d,    // alias
  tab: 0x09,       // VK_TAB
  space: 0x20,     // VK_SPACE
  backspace: 0x08, // VK_BACK
  delete: 0x2e,    // VK_DELETE
  insert: 0x2d,    // VK_INSERT
  escape: 0x1b,    // VK_ESCAPE
  esc: 0x1b,       // alias

  // Punctuation / symbols
  minus: 0xbd,         // VK_OEM_MINUS
  equals: 0xbb,        // VK_OEM_PLUS (= key, not numpad)
  leftbracket: 0xdb,   // VK_OEM_4 [
  rightbracket: 0xdd,  // VK_OEM_6 ]
  backslash: 0xdc,     // VK_OEM_5
  semicolon: 0xba,     // VK_OEM_1
  quote: 0xde,         // VK_OEM_7
  comma: 0xbc,         // VK_OEM_COMMA
  period: 0xbe,        // VK_OEM_PERIOD
  slash: 0xbf,         // VK_OEM_2
  backtick: 0xc0,      // VK_OEM_3

  // Media keys
  media_play_pause: 0xb3,  // VK_MEDIA_PLAY_PAUSE
  media_next: 0xb0,        // VK_MEDIA_NEXT_TRACK
  media_prev: 0xb1,        // VK_MEDIA_PREV_TRACK
  media_stop: 0xb2,        // VK_MEDIA_STOP
  volume_up: 0xaf,         // VK_VOLUME_UP
  volume_down: 0xae,       // VK_VOLUME_DOWN
  volume_mute: 0xad,       // VK_VOLUME_MUTE

  // System
  printscreen: 0x2c,  // VK_SNAPSHOT
  scrolllock: 0x91,   // VK_SCROLL
  pause: 0x13,        // VK_PAUSE
  capslock: 0x14,     // VK_CAPITAL
  numlock: 0x90,      // VK_NUMLOCK

  // Numpad
  numpad0: 0x60, numpad1: 0x61, numpad2: 0x62, numpad3: 0x63,
  numpad4: 0x64, numpad5: 0x65, numpad6: 0x66, numpad7: 0x67,
  numpad8: 0x68, numpad9: 0x69,
  numpad_multiply: 0x6a,  // VK_MULTIPLY
  numpad_add: 0x6b,       // VK_ADD
  numpad_subtract: 0x6d,  // VK_SUBTRACT
  numpad_decimal: 0x6e,   // VK_DECIMAL
  numpad_divide: 0x6f,    // VK_DIVIDE
  numpad_enter: 0x0d,     // same as Enter (use extended key flag)

  // Browser keys
  browser_back: 0xa6,
  browser_forward: 0xa7,
  browser_refresh: 0xa8,
  browser_stop: 0xa9,
  browser_search: 0xaa,
  browser_favorites: 0xab,
  browser_home: 0xac,

  // App launch keys
  launch_mail: 0xb4,
  launch_media: 0xb5,
  launch_app1: 0xb6,
  launch_app2: 0xb7,
} as const;

/** Set of valid key names for fast lookup */
export const VALID_KEYS = new Set(Object.keys(KEY_MAP));

/** Maximum keys in a single combo */
export const MAX_COMBO_KEYS = 6;

/** Modifier key names */
export const MODIFIER_KEYS = new Set([
  'ctrl', 'lctrl', 'rctrl',
  'shift', 'lshift', 'rshift',
  'alt', 'lalt', 'ralt',
  'win', 'lwin', 'rwin',
]);

/** Extended keys that need KEYEVENTF_EXTENDEDKEY flag */
export const EXTENDED_KEYS = new Set([
  'up', 'down', 'left', 'right',
  'home', 'end', 'pageup', 'pagedown',
  'insert', 'delete', 'printscreen',
  'rctrl', 'ralt', 'rwin',
  'numpad_divide', 'numpad_enter',
  'media_play_pause', 'media_next', 'media_prev', 'media_stop',
  'volume_up', 'volume_down', 'volume_mute',
  'browser_back', 'browser_forward', 'browser_refresh', 'browser_stop',
  'browser_search', 'browser_favorites', 'browser_home',
  'launch_mail', 'launch_media', 'launch_app1', 'launch_app2',
]);

/**
 * Validate that a key name is in the allowlist.
 * Returns the VK code if valid, undefined if not.
 */
export function resolveKey(name: string): number | undefined {
  return KEY_MAP[name.toLowerCase()];
}

/**
 * Check if a key name is a modifier (ctrl, shift, alt, win).
 */
export function isModifier(name: string): boolean {
  return MODIFIER_KEYS.has(name.toLowerCase());
}

/**
 * Check if a key needs the KEYEVENTF_EXTENDEDKEY flag.
 */
export function isExtendedKey(name: string): boolean {
  return EXTENDED_KEYS.has(name.toLowerCase());
}
