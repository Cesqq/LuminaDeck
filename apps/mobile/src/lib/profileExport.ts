import { loadProfile, saveProfile } from './storage';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import type { ProfileConfig, PageConfig, ButtonConfig } from '@luminadeck/shared';

const EXPORT_FILE_NAME = 'luminadeck-profile.json';

/**
 * Export the current profile as a shareable JSON file.
 * Opens the system share sheet so the user can AirDrop, save to Files, etc.
 */
export async function exportProfile(): Promise<void> {
  const profile = await loadProfile();
  const json = JSON.stringify(profile, null, 2);
  const fileUri = FileSystem.cacheDirectory + EXPORT_FILE_NAME;

  await FileSystem.writeAsStringAsync(fileUri, json, {
    encoding: FileSystem.EncodingType.UTF8,
  });

  const sharingAvailable = await Sharing.isAvailableAsync();
  if (!sharingAvailable) {
    throw new Error('Sharing is not available on this device.');
  }

  await Sharing.shareAsync(fileUri, {
    mimeType: 'application/json',
    dialogTitle: 'Export LuminaDeck Profile',
    UTI: 'public.json',
  });
}

/**
 * Validate that a parsed object conforms to the ProfileConfig shape.
 * Performs structural checks without pulling in zod for the mobile bundle.
 */
function isValidProfile(obj: unknown): obj is ProfileConfig {
  if (typeof obj !== 'object' || obj === null) return false;
  const p = obj as Record<string, unknown>;

  if (typeof p.id !== 'string' || p.id.length === 0) return false;
  if (typeof p.name !== 'string' || p.name.length === 0) return false;
  if (typeof p.createdAt !== 'string') return false;
  if (typeof p.updatedAt !== 'string') return false;
  if (typeof p.theme !== 'string') return false;

  if (!Array.isArray(p.pages) || p.pages.length === 0) return false;

  for (const page of p.pages) {
    if (!isValidPage(page)) return false;
  }

  return true;
}

function isValidPage(obj: unknown): obj is PageConfig {
  if (typeof obj !== 'object' || obj === null) return false;
  const pg = obj as Record<string, unknown>;

  if (typeof pg.id !== 'string') return false;
  if (typeof pg.name !== 'string') return false;
  if (!Array.isArray(pg.buttons)) return false;

  const validLayouts = ['2x4', '3x4', '4x5'];
  if (typeof pg.layout !== 'string' || !validLayouts.includes(pg.layout)) return false;

  for (const btn of pg.buttons) {
    if (!isValidButton(btn)) return false;
  }

  return true;
}

function isValidButton(obj: unknown): obj is ButtonConfig {
  if (typeof obj !== 'object' || obj === null) return false;
  const btn = obj as Record<string, unknown>;

  if (typeof btn.id !== 'string') return false;
  if (typeof btn.page !== 'number') return false;
  if (typeof btn.position !== 'number') return false;

  // action can be null or a valid action object
  if (btn.action !== null && btn.action !== undefined) {
    if (typeof btn.action !== 'object') return false;
    const action = btn.action as Record<string, unknown>;
    const validTypes = ['keybind', 'app_launch', 'system_action', 'multi_action'];
    if (typeof action.type !== 'string' || !validTypes.includes(action.type)) return false;
  }

  // label is optional, but if present must be a string <= 16 chars
  if (btn.label !== undefined && btn.label !== null) {
    if (typeof btn.label !== 'string' || btn.label.length > 16) return false;
  }

  return true;
}

/**
 * Import a profile from a file URI.
 * Validates the JSON structure and saves it as the active profile.
 * Returns true on success, false if the file is invalid.
 */
export async function importProfile(uri: string): Promise<boolean> {
  try {
    const content = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.UTF8,
    });

    const parsed: unknown = JSON.parse(content);

    if (!isValidProfile(parsed)) {
      return false;
    }

    // Update timestamps to reflect the import moment
    const imported: ProfileConfig = {
      ...parsed,
      updatedAt: new Date().toISOString(),
    };

    await saveProfile(imported);
    return true;
  } catch {
    return false;
  }
}
