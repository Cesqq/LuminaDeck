import { z } from 'zod';
import { VALID_KEYS, MAX_COMBO_KEYS } from './keys';

/**
 * Payload validation schemas for LuminaDeck action messages.
 * All incoming payloads are validated against these schemas before execution.
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
    .max(260) // MAX_PATH on Windows
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
]);

export const systemActionSchema = z.object({
  type: z.literal('system_action'),
  action: systemActionName,
});

export const multiActionSchema = z.object({
  type: z.literal('multi_action'),
  actions: z.array(
    z.discriminatedUnion('type', [keybindSchema, appLaunchSchema, systemActionSchema]),
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
]);

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
  executeMessageSchema,
  pingMessageSchema,
  pairRequestSchema,
]);

// --- Button Config Schema ---

export const buttonLabelSchema = z.string().max(16).optional();

export const gridLayoutSchema = z.enum(['2x4', '3x4', '4x5']);

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
