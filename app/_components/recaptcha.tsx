'use client';

import { startTransition, useCallback } from 'react';
import Script from 'next/script';
import type { RecaptchaAction } from '@/lib/recaptcha';

type Grecaptcha = {
  ready: (callback: () => void) => void;
  execute: (siteKey: string, options: { action: string }) => Promise<string>;
};

declare global {
  interface Window {
    grecaptcha?: Grecaptcha;
  }
}

const LOAD_TIMEOUT_MS = 10_000;
const EXECUTE_TIMEOUT_MS = 10_000;

// Resolves once api.js is ready; null if it never loads (blocked/offline).
function waitForGrecaptcha(): Promise<Grecaptcha | null> {
  return new Promise((resolve) => {
    const startedAt = Date.now();
    const tick = () => {
      const g = window.grecaptcha;
      if (g?.ready) return g.ready(() => resolve(g));
      if (Date.now() - startedAt > LOAD_TIMEOUT_MS) return resolve(null);
      setTimeout(tick, 100);
    };
    tick();
  });
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race([promise, new Promise<null>((resolve) => setTimeout(() => resolve(null), ms))]);
}

// Script loads only when reCAPTCHA is enabled (siteKey set). Tokens are fetched at submit (they expire after 2 min).
// A null token is sent as-is; the server decides (rejects when reCAPTCHA is enabled).
export function useRecaptcha(siteKey: string | null | undefined) {
  const key = siteKey || null;

  const getToken = useCallback(
    async (action: RecaptchaAction): Promise<string | null> => {
      if (!key) return null;
      try {
        const g = await waitForGrecaptcha();
        if (!g) return null;
        return await withTimeout(g.execute(key, { action }), EXECUTE_TIMEOUT_MS);
      } catch {
        return null;
      }
    },
    [key],
  );

  const recaptchaScript = key ? (
    <Script src={`https://www.google.com/recaptcha/api.js?render=${encodeURIComponent(key)}`} strategy="afterInteractive" />
  ) : null;

  return { enabled: key !== null, getToken, recaptchaScript };
}

// Wraps a useActionState dispatcher: fetch a token at submit, then dispatch. Without siteKey the dispatcher is used as-is.
export function useRecaptchaFormAction(
  formAction: (formData: FormData) => void,
  siteKey: string | null | undefined,
  action: RecaptchaAction,
) {
  const { enabled, getToken, recaptchaScript } = useRecaptcha(siteKey);

  const protectedAction = useCallback(
    async (formData: FormData) => {
      const token = await getToken(action);
      if (token) formData.set('recaptchaToken', token);
      // After an await we are outside the form transition.
      startTransition(() => formAction(formData));
    },
    [getToken, action, formAction],
  );

  return { enabled, recaptchaScript, formAction: enabled ? protectedAction : formAction };
}

// Attribution required by Google; the default badge stays visible too.
export function RecaptchaNotice() {
  const link = 'underline underline-offset-2 hover:text-zinc-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary rounded';
  return (
    <p className="text-center text-xs text-pretty text-zinc-500">
      Formulir ini dilindungi reCAPTCHA. Berlaku{' '}
      <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" className={link}>
        Kebijakan Privasi
      </a>{' '}
      dan{' '}
      <a href="https://policies.google.com/terms" target="_blank" rel="noopener noreferrer" className={link}>
        Persyaratan Layanan
      </a>{' '}
      Google.
    </p>
  );
}
