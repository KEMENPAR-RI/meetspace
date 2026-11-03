import { z } from 'zod';

import { readCheckbox } from '@/lib/user/validation';

import { sniffLogoMime } from './logo-sniff';
import { APPEARANCE_LIMITS, PRIMARY_COLORS, type AppearanceField, type LogoMime, type PrimaryColor } from './types';

const CONTROL_CHARS = /[\u0000-\u001f\u007f]/;

const schema = z.object({
  appName: z
    .string()
    .trim()
    .min(1, 'Nama aplikasi wajib diisi.')
    .max(APPEARANCE_LIMITS.appName, `Nama aplikasi maksimal ${APPEARANCE_LIMITS.appName} karakter.`)
    .refine((v) => !CONTROL_CHARS.test(v), 'Nama aplikasi mengandung karakter yang tidak valid.'),
  institutionName: z
    .string()
    .trim()
    .max(APPEARANCE_LIMITS.institutionName, `Nama instansi maksimal ${APPEARANCE_LIMITS.institutionName} karakter.`)
    .refine((v) => !CONTROL_CHARS.test(v), 'Nama instansi mengandung karakter yang tidak valid.')
    .transform((v) => (v === '' ? null : v)),
  primaryColor: z.enum(PRIMARY_COLORS, 'Pilih warna utama.'),
});

// logo: undefined = keep, null = remove, object = replace.
export type AppearanceInput = {
  appName: string;
  institutionName: string | null;
  primaryColor: PrimaryColor;
  logo: undefined | null | { mime: LogoMime; data: Uint8Array };
};

export type AppearanceValues = Partial<Record<AppearanceField, string>>;

export type ParseAppearanceResult =
  | { ok: true; data: AppearanceInput }
  | { ok: false; fieldErrors: Partial<Record<AppearanceField, string>>; values: AppearanceValues };

function readString(formData: FormData, key: string): string {
  const raw = formData.get(key);
  return typeof raw === 'string' ? raw : '';
}

// The file itself is never echoed back.
export function readAppearanceValues(formData: FormData): AppearanceValues {
  return {
    appName: readString(formData, 'appName'),
    institutionName: readString(formData, 'institutionName'),
    primaryColor: readString(formData, 'primaryColor'),
    removeLogo: readCheckbox(formData, 'removeLogo') ? '1' : '',
  };
}

// Form fields: appName, institutionName, primaryColor, logo (file input), removeLogo (checkbox value="1").
export async function parseAppearance(formData: FormData): Promise<ParseAppearanceResult> {
  const values = readAppearanceValues(formData);
  const fieldErrors: Partial<Record<AppearanceField, string>> = {};

  const result = schema.safeParse(values);
  if (!result.success) {
    for (const issue of result.error.issues) fieldErrors[issue.path[0] as AppearanceField] ??= issue.message;
  }

  let logo: AppearanceInput['logo'];
  const file = formData.get('logo');
  if (values.removeLogo === '1') logo = null;
  else if (file instanceof Blob && file.size > 0) {
    if (file.size > APPEARANCE_LIMITS.logoMaxBytes) {
      fieldErrors.logo = `Ukuran logo maksimal ${APPEARANCE_LIMITS.logoMaxBytes / 1024} KB.`;
    } else {
      const data = new Uint8Array(await file.arrayBuffer());
      const mime = sniffLogoMime(data);
      if (!mime) fieldErrors.logo = 'Logo harus berupa gambar PNG, JPEG, atau WebP.';
      else logo = { mime, data };
    }
  }

  if (!result.success || Object.keys(fieldErrors).length > 0) return { ok: false, fieldErrors, values };
  return { ok: true, data: { ...result.data, logo } };
}
