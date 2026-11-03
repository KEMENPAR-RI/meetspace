'use server';

import { refresh, updateTag } from 'next/cache';
import { z } from 'zod';

import { authorizeSuperadmin } from '@/lib/auth/access';
import type { FormState } from '@/lib/auth/types';
import { parseAppearance, readAppearanceValues } from '@/lib/settings/appearance-validation';
import { APPEARANCE_TAG } from '@/lib/settings/queries';
import { hasStoredRecaptchaSecret } from '@/lib/settings/recaptcha';
import { saveAppearance, saveSettingsPatch } from '@/lib/settings/service';
import { SETTINGS_TABS, type AppearanceField, type SettingsField, type SettingsTab } from '@/lib/settings/types';
import { parseSettingsTab, readSettingsValues } from '@/lib/settings/validation';

// 'tampilan' is saved by updateAppearance (multipart + logo).
const editableTab = z.enum(SETTINGS_TABS).exclude(['tampilan']);

// Superadmin only. `tab` is bound on the client: validated here. Saves only that tab's fields
// (SETTINGS_TAB_FIELDS); checkboxes officeIpCheck/recaptchaEnabled use value="1"; empty recaptchaSecretKey = keep.
export async function updateSettingsTab(
  tab: SettingsTab,
  _prevState: FormState<SettingsField>,
  formData: FormData,
): Promise<FormState<SettingsField>> {
  const parsedTab = editableTab.safeParse(tab);
  const values = parsedTab.success ? readSettingsValues(parsedTab.data, formData) : undefined;

  const user = await authorizeSuperadmin();
  if (!user) return { status: 'error', message: 'Tidak diizinkan.', values };
  if (!parsedTab.success) return { status: 'error', message: 'Tab pengaturan tidak valid.' };

  const parsed = parseSettingsTab(parsedTab.data, formData);
  if (!parsed.ok) {
    return { status: 'error', message: 'Periksa kembali isian formulir.', fieldErrors: parsed.fieldErrors, values: parsed.values };
  }

  const { patch } = parsed;
  if (patch.recaptchaEnabled && patch.recaptchaSecretKey === undefined) {
    let stored: boolean;
    try {
      stored = await hasStoredRecaptchaSecret();
    } catch (error) {
      console.error('[settings] failed to read stored reCAPTCHA secret', error);
      return { status: 'error', message: 'Pengaturan gagal disimpan. Silakan coba lagi.', values };
    }
    if (!stored) {
      const message = 'Isi site key dan secret key sebelum mengaktifkan reCAPTCHA.';
      return { status: 'error', message: 'Periksa kembali isian formulir.', fieldErrors: { recaptchaEnabled: message }, values };
    }
  }

  if (!(await saveSettingsPatch(patch, user.id))) {
    return { status: 'error', message: 'Pengaturan gagal disimpan. Silakan coba lagi.', values };
  }

  refresh();
  return { status: 'success', message: 'Pengaturan disimpan.' };
}

// Superadmin only. Removes the stored secret and turns reCAPTCHA off (no form fields needed).
// useActionState signature; neither argument is needed.
export async function clearRecaptchaSecret(
  prevState: FormState<SettingsField>,
  formData: FormData,
): Promise<FormState<SettingsField>> {
  void prevState;
  void formData;
  const user = await authorizeSuperadmin();
  if (!user) return { status: 'error', message: 'Tidak diizinkan.' };

  if (!(await saveSettingsPatch({ recaptchaSecretKey: '', recaptchaEnabled: false }, user.id))) {
    return { status: 'error', message: 'Secret key gagal dihapus. Silakan coba lagi.' };
  }

  refresh();
  return { status: 'success', message: 'Secret key dihapus dan reCAPTCHA dinonaktifkan.' };
}

// Superadmin only; tab 'tampilan', separate from updateSettingsTab (multipart, own field errors).
// Fields: appName, institutionName, primaryColor (select), logo (file, <= 512 KB, PNG/JPEG/WebP by magic bytes),
// removeLogo (checkbox value="1").
export async function updateAppearance(
  _prevState: FormState<AppearanceField>,
  formData: FormData,
): Promise<FormState<AppearanceField>> {
  const user = await authorizeSuperadmin();
  if (!user) return { status: 'error', message: 'Tidak diizinkan.', values: readAppearanceValues(formData) };

  const parsed = await parseAppearance(formData);
  if (!parsed.ok) {
    return { status: 'error', message: 'Periksa kembali isian formulir.', fieldErrors: parsed.fieldErrors, values: parsed.values };
  }

  if (!(await saveAppearance(parsed.data, user.id))) {
    return { status: 'error', message: 'Tampilan gagal disimpan. Silakan coba lagi.', values: readAppearanceValues(formData) };
  }

  updateTag(APPEARANCE_TAG);
  refresh();
  return { status: 'success', message: 'Tampilan disimpan.' };
}
