import type { AppearanceInput } from './appearance-validation';
import { encodeSettings, type SettingsPatch } from './codec';
import { invalidateAppSettings } from './queries';
import { writeSettingRows } from './repository';

// Superadmin only; callers authorize first. One transaction, one upsert per key.
async function save(patch: SettingsPatch, updatedById: string, label: string): Promise<boolean> {
  try {
    await writeSettingRows(encodeSettings(patch, updatedById, new Date()));
    return true;
  } catch (error) {
    console.error(`[settings] ${label} save failed`, error);
    return false;
  } finally {
    invalidateAppSettings();
  }
}

// Patch from parseSettingsTab (one tab's keys) or clearRecaptchaSecret.
export async function saveSettingsPatch(patch: SettingsPatch, updatedById: string): Promise<boolean> {
  return save(patch, updatedById, 'settings');
}

// logo: undefined = keep, null = remove, object = replace.
export async function saveAppearance(input: AppearanceInput, updatedById: string): Promise<boolean> {
  return save(
    {
      appName: input.appName,
      institutionName: input.institutionName,
      primaryColor: input.primaryColor,
      ...(input.logo !== undefined ? { logo: input.logo } : {}),
    },
    updatedById,
    'appearance',
  );
}
