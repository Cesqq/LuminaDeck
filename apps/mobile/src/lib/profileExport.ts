import { loadProfile, saveProfile } from './storage';
import { File, Paths } from 'expo-file-system/next';
import * as Sharing from 'expo-sharing';
import { profileConfigSchema, type ProfileConfig } from '@luminadeck/shared';

const EXPORT_FILE_NAME = 'luminadeck-profile.json';

export async function exportProfile(): Promise<void> {
  const profile = await loadProfile();
  const json = JSON.stringify(profile, null, 2);
  const file = new File(Paths.cache, EXPORT_FILE_NAME);

  file.create();
  file.write(json);

  const sharingAvailable = await Sharing.isAvailableAsync();
  if (!sharingAvailable) {
    throw new Error('Sharing is not available on this device.');
  }

  await Sharing.shareAsync(file.uri, {
    mimeType: 'application/json',
    dialogTitle: 'Export LuminaDeck Profile',
    UTI: 'public.json',
  });
}

export async function importProfile(uri: string): Promise<boolean> {
  try {
    const file = new File(uri);
    const content = await file.text();
    const parsed: unknown = JSON.parse(content);

    const result = profileConfigSchema.safeParse(parsed);
    if (!result.success) return false;

    const imported: ProfileConfig = {
      ...result.data,
      updatedAt: new Date().toISOString(),
    };

    await saveProfile(imported);
    return true;
  } catch {
    return false;
  }
}
