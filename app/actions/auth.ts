'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

import { authorizeUser, LOGIN_PATH } from '@/lib/auth/access';
import {
  consumeLoginAttempt,
  consumePasswordChangeAttempt,
  resetPasswordChangeAttempts,
  resetUserLoginAttempts,
  resolveLoginIpKey,
} from '@/lib/auth/login-rate-limit';
import { DUMMY_HASH, hashPassword, needsRehash, PasswordHasherBusyError, verifyPassword } from '@/lib/auth/password';
import { clearSession, createSession } from '@/lib/auth/session';
import { PASSWORD_MAX, USERNAME_MAX, type FormState, type LoginState, type PasswordField } from '@/lib/auth/types';
import { checkOfficeAccess, getClientIpKey } from '@/lib/office-access';
import { RECAPTCHA_FAILED_MESSAGE, verifyRecaptcha } from '@/lib/recaptcha';
import { getAppSettings } from '@/lib/settings/queries';
import { prisma } from '@/lib/prisma';
import { changeOwnPassword as changeOwnPasswordService } from '@/lib/user/service';
import { parseChangePassword } from '@/lib/user/validation';

const FAILED_LOGIN_DELAY_MS = 500;
// Same message for unknown username, wrong password, and inactive account (E1/E6).
const LOGIN_FAILED_MESSAGE = 'Username atau password salah.';
const RATE_LIMIT_MESSAGE = 'Terlalu banyak percobaan login. Coba lagi nanti.';
const BUSY_MESSAGE = 'Server sedang sibuk. Coba lagi sebentar.';
const UNKNOWN_IP_MESSAGE = 'Tidak dapat memverifikasi alamat jaringan.';

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

function toLimits(s: Awaited<ReturnType<typeof getAppSettings>>) {
  return { userMax: s.loginRateMax, ipMax: s.loginIpRateMax, windowMin: s.loginRateWindowMin };
}

async function loginLimits() {
  return toLimits(await getAppSettings());
}

// At most one log line per minute, so missing-header requests cannot flood the log.
let missingIpLoggedAt = 0;
function logMissingIp(): void {
  const now = Date.now();
  if (now - missingIpLoggedAt < 60_000) return;
  missingIpLoggedAt = now;
  console.error('[login] client IP header missing or invalid; login refused (check trusted IP header setting)');
}

function readText(formData: FormData, key: string): string {
  const raw = formData.get(key);
  return typeof raw === 'string' ? raw : '';
}

// Success redirects to /dashboard; the password is never echoed back.
export async function login(_prevState: LoginState, formData: FormData): Promise<LoginState> {
  const h = await headers();
  const username = readText(formData, 'username').trim().toLowerCase().slice(0, USERNAME_MAX);
  const password = readText(formData, 'password');
  const fail = (message: string): LoginState => ({ status: 'error', message, values: { username } });

  // No office-IP gate: the dashboard must stay reachable (e.g. to fix the office IP settings).
  // Without a client IP there is no fair bucket: refuse instead of sharing one.
  const ipKey = resolveLoginIpKey(await getClientIpKey(h));
  if (!ipKey) {
    logMissingIp();
    return fail(UNKNOWN_IP_MESSAGE);
  }
  // Rate limits before any scrypt work; allowlisted office IPs skip the global per-username bucket.
  const settings = await getAppSettings();
  const office = settings.officeIpCheck && (await checkOfficeAccess(h)).allowed;
  if (!consumeLoginAttempt(ipKey, username, toLimits(settings), { office })) return fail(RATE_LIMIT_MESSAGE);

  // reCAPTCHA v3 (FormData `recaptchaToken`, action 'login') runs after the rate limits and before any scrypt work.
  // Only an 'unavailable' verifier (Google down, bad keys) lets the attempt through, so a misconfigured key can never
  // lock everyone out of the dashboard settings page; bots are still bound by the rate limits and the password.
  const captcha = await verifyRecaptcha(formData.get('recaptchaToken'), 'login');
  if (!captcha.ok && captcha.reason !== 'unavailable') return fail(RECAPTCHA_FAILED_MESSAGE);

  let user: { id: string; passwordHash: string; isActive: boolean } | null = null;
  let ok = false;
  try {
    if (username && password && password.length <= PASSWORD_MAX) {
      user = await prisma.user.findUnique({
        where: { username },
        select: { id: true, passwordHash: true, isActive: true },
      });
    }
    // Always one scrypt run so timing does not reveal whether the username exists.
    ok = (await verifyPassword(password.slice(0, PASSWORD_MAX), user?.passwordHash ?? DUMMY_HASH)) && Boolean(user);
  } catch (error) {
    if (error instanceof PasswordHasherBusyError) return fail(BUSY_MESSAGE);
    console.error('[login] failed', error);
    return fail('Login gagal. Silakan coba lagi.');
  }

  if (!ok || !user || !user.isActive) {
    await sleep(FAILED_LOGIN_DELAY_MS);
    return fail(LOGIN_FAILED_MESSAGE);
  }

  // Upgrade old hash params transparently; failure here must not block login.
  if (needsRehash(user.passwordHash)) {
    try {
      await prisma.user.update({
        where: { id: user.id },
        data: { passwordHash: await hashPassword(password) },
        select: { id: true },
      });
    } catch (error) {
      console.error('[login] rehash failed', error);
    }
  }

  try {
    await createSession(user.id);
  } catch (error) {
    console.error('[login] failed to create session', error);
    return fail('Login gagal. Silakan coba lagi.');
  }
  resetUserLoginAttempts(username, ipKey);
  redirect('/dashboard');
}

// Clears only this browser's session (other devices stay logged in, ADR 0003).
export async function logout(): Promise<void> {
  await clearSession();
  redirect(LOGIN_PATH);
}

export async function changeOwnPassword(
  _prevState: FormState<PasswordField>,
  formData: FormData,
): Promise<FormState<PasswordField>> {
  const user = await authorizeUser();
  if (!user) return { status: 'error', message: 'Tidak diizinkan.' };

  const parsed = parseChangePassword(formData);
  if (!parsed.ok) return { status: 'error', message: 'Periksa kembali isian formulir.', fieldErrors: parsed.fieldErrors };

  // Two scrypt runs per attempt: limited per user.
  if (!consumePasswordChangeAttempt(user.id, await loginLimits())) return { status: 'error', message: RATE_LIMIT_MESSAGE };

  const result = await changeOwnPasswordService(user.id, parsed.data.currentPassword, parsed.data.newPassword);
  if (!result.ok) {
    if (result.reason === 'wrong-password') {
      await sleep(FAILED_LOGIN_DELAY_MS);
      return {
        status: 'error',
        message: 'Password lama salah.',
        fieldErrors: { currentPassword: 'Password lama salah.' },
      };
    }
    return { status: 'error', message: 'Password gagal diubah. Silakan coba lagi.' };
  }

  resetPasswordChangeAttempts(user.id);
  // Every session (this one too) was revoked; issue a fresh one for this browser.
  try {
    await createSession(user.id);
  } catch (error) {
    // Password is already changed: ask for a fresh login instead of a raw error.
    console.error('[changeOwnPassword] failed to re-issue session', error);
    await clearSession().catch(() => undefined);
    return { status: 'success', message: 'Password berhasil diubah. Silakan login ulang.' };
  }
  return { status: 'success', message: 'Password berhasil diubah.' };
}
