import { z } from 'zod';
import { VALID_KEYS, MAX_COMBO_KEYS } from './keys';

/**
 * Payload validation schemas for LuminaDeck action messages.
 * Protocol v1.1 — extended action types, hello handshake, capabilities.
 */

// --- Key name validator ---

const keyName = z.string().refine(
  (key) => VALID_KEYS.has(key.toLowerCase()),
  (key) => ({ message: `Invalid key name: "${key}". Not in allowlist.` }),
);

// --- Action Schemas ---

export const keybindSchema = z.object({
  type: z.literal('keybind'),
  keys: z.array(keyName)
    .min(1, 'At least one key required')
    .max(MAX_COMBO_KEYS, `Max ${MAX_COMBO_KEYS} keys per combo`),
});

export const appLaunchSchema = z.object({
  type: z.literal('app_launch'),
  path: z.string()
    .min(1)
    .max(260)
    .refine(
      (p) => !p.includes('..') && !p.includes('~'),
      'Path must not contain ".." or "~" (directory traversal prevention)',
    )
    .refine(
      (p) => /\.(exe|lnk|bat|cmd|msc|cpl)$/i.test(p),
      'Path must end with a valid executable extension',
    ),
  args: z.array(z.string().max(1024)).max(10).optional(),
});

const systemActionName = z.enum([
  'volume_up', 'volume_down', 'volume_mute',
  'media_play_pause', 'media_next', 'media_prev', 'media_stop',
  'screenshot', 'lock_screen', 'sleep',
  'brightness_up', 'brightness_down',
  'mic_mute',
  'minimize_window', 'snap_left', 'snap_right', 'switch_window', 'close_window',
]);

export const systemActionSchema = z.object({
  type: z.literal('system_action'),
  action: systemActionName,
});

export const textInputSchema = z.object({
  type: z.literal('text_input'),
  text: z.string().min(1).max(4096),
});

export const folderSchema = z.object({
  type: z.literal('folder'),
  folderId: z.string().min(1).max(64),
  folderName: z.string().min(1).max(32),
  buttons: z.array(z.any()).max(64),
  layout: z.enum(['2x4', '3x4', '4x5', '5x3', '8x4', '8x8']),
});

export const timerSchema = z.object({
  type: z.literal('timer'),
  durationMs: z.number().int().min(1000).max(86400000),
  countUp: z.boolean(),
  label: z.string().max(32).optional(),
});

export const counterSchema = z.object({
  type: z.literal('counter'),
  initialValue: z.number().int(),
  step: z.number().int().min(-1000).max(1000),
  label: z.string().max(32).optional(),
});

export const obsSchema = z.object({
  type: z.literal('obs'),
  command: z.enum([
    'switch_scene', 'toggle_record', 'toggle_stream',
    'toggle_source', 'replay_buffer', 'obs_screenshot',
  ]),
  sceneName: z.string().max(128).optional(),
  sourceName: z.string().max(128).optional(),
  filterName: z.string().max(128).optional(),
});

export const discordSchema = z.object({
  type: z.literal('discord'),
  command: z.enum(['toggle_mute', 'toggle_deafen', 'push_to_talk']),
});

export const macroActionSchema = z.object({
  type: z.literal('macro'),
  macroId: z.string().min(1).max(64),
  macroName: z.string().min(1).max(64),
});

export const multiActionSchema = z.object({
  type: z.literal('multi_action'),
  actions: z.array(
    z.discriminatedUnion('type', [
      keybindSchema, appLaunchSchema, systemActionSchema, textInputSchema,
    ]),
  )
    .min(1, 'At least one action required')
    .max(20, 'Max 20 actions in a multi-action'),
  delays: z.array(z.number().int().min(0).max(10000)).optional(),
});

export const actionSchema = z.discriminatedUnion('type', [
  keybindSchema,
  appLaunchSchema,
  systemActionSchema,
  multiActionSchema,
  textInputSchema,
  folderSchema,
  timerSchema,
  counterSchema,
  obsSchema,
  discordSchema,
  macroActionSchema,
]);

// --- Hello Handshake (v1.1) ---

export const helloSchema = z.object({
  type: z.literal('hello'),
  protocolVersion: z.string().min(1),
  clientVersion: z.string().min(1),
  deviceName: z.string().min(1).max(64),
  deviceId: z.string().min(1).max(128),
});

export const textInputMessageSchema = z.object({
  type: z.literal('text_input'),
  id: z.string().min(1).max(64),
  text: z.string().min(1).max(4096),
});

export const macroExecuteSchema = z.object({
  type: z.literal('macro_execute'),
  id: z.string().min(1).max(64),
  macroId: z.string().min(1).max(64),
  params: z.record(z.string()).optional(),
});

export const requestCapabilitiesSchema = z.object({
  type: z.literal('request_capabilities'),
});

export const profileSyncSchema = z.object({
  type: z.literal('profile_sync'),
  rules: z.array(z.object({
    processName: z.string().min(1).max(128),
    profileId: z.string().min(1).max(64),
  })).max(50),
});

// --- Message Schemas ---

export const executeMessageSchema = z.object({
  type: z.literal('execute'),
  id: z.string().min(1).max(64),
  action: actionSchema,
});

export const pingMessageSchema = z.object({
  type: z.literal('ping'),
  timestamp: z.number(),
});

export const pairRequestSchema = z.object({
  type: z.literal('pair_request'),
  deviceName: z.string().min(1).max(64),
  deviceId: z.string().min(1).max(128),
});

export const clientMessageSchema = z.discriminatedUnion('type', [
  helloSchema,
  executeMessageSchema,
  pingMessageSchema,
  pairRequestSchema,
  textInputMessageSchema,
  macroExecuteSchema,
  requestCapabilitiesSchema,
  profileSyncSchema,
]);

// --- Button Config Schema ---

export const buttonLabelSchema = z.string().max(16).optional();

export const gridLayoutSchema = z.enum(['2x4', '3x4', '4x5', '5x3', '8x4', '8x8']);

// --- Validation helpers ---

export type ValidationResult<T> =
  | { success: true; data: T }
  | { success: false; error: string };

export function validateAction(payload: unknown): ValidationResult<z.infer<typeof actionSchema>> {
  const result = actionSchema.safeParse(payload);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return {
    success: false,
    error: result.error.issues.map((i) => i.message).join('; '),
  };
}

export function validateClientMessage(payload: unknown): ValidationResult<z.infer<typeof clientMessageSchema>> {
  const result = clientMessageSchema.safeParse(payload);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return {
    success: false,
    error: result.error.issues.map((i) => i.message).join('; '),
  };
}
