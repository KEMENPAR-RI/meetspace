'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { CopyAttendanceLink } from '@/app/_components/copy-attendance-link';
import { primaryButton, secondaryButton, smallButton } from './ui';

type Props = {
  // Visible trigger text, e.g. "QR Booking" / "QR Daftar Hadir".
  label: string;
  // Accessible name of the trigger when several are on one page.
  triggerAriaLabel?: string;
  title: string;
  subtitle?: string;
  // Absolute target URL from APP_URL; null when not configured.
  url: string | null;
  // SVG endpoint (`?format=svg`); logo is embedded server-side.
  imageSrc: string;
  // PNG file name for the client-side download, e.g. "qr-booking-ruang-a.png".
  fileName: string;
  size?: 'sm' | 'md';
};

export function QrButton({ label, triggerAriaLabel, size = 'sm', ...dialog }: Props) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-label={triggerAriaLabel}
        className={size === 'sm' ? smallButton : secondaryButton}
      >
        <QrIcon />
        {label}
      </button>
      {/* Mounted on demand: each open fetches a fresh image. */}
      {open && <QrDialog {...dialog} onClose={() => setOpen(false)} />}
    </>
  );
}

const PNG_SIZE = 1024;

type Status = 'loading' | 'ready' | 'unconfigured' | 'denied' | 'error';

function QrDialog({
  title,
  subtitle,
  url,
  imageSrc,
  fileName,
  onClose,
}: Omit<Props, 'label' | 'triggerAriaLabel' | 'size'> & { onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const [status, setStatus] = useState<Status>(url ? 'loading' : 'unconfigured');
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState(false);

  const openDialog = useCallback((el: HTMLDialogElement | null) => {
    dialogRef.current = el;
    if (el && !el.open) el.showModal();
  }, []);

  // fetch (not a bare <img>) so a 503 "APP_URL not set" can be told apart from other failures.
  useEffect(() => {
    if (!url) return;
    const controller = new AbortController();
    let created: string | null = null;
    fetch(imageSrc, { cache: 'no-store', signal: controller.signal })
      .then(async (res) => {
        if (res.status === 503) return setStatus('unconfigured');
        if (res.status === 401 || res.status === 403 || res.status === 404) return setStatus('denied');
        if (!res.ok) return setStatus('error');
        created = URL.createObjectURL(await res.blob());
        setObjectUrl(created);
        setStatus('ready');
      })
      .catch((err: unknown) => {
        if ((err as { name?: string })?.name !== 'AbortError') setStatus('error');
      });
    return () => {
      controller.abort();
      if (created) URL.revokeObjectURL(created);
    };
  }, [imageSrc, url, attempt]);

  // Render the SVG onto a 1024px canvas and save it as PNG (J3).
  const downloadPng = async () => {
    if (!objectUrl) return;
    setDownloading(true);
    setDownloadError(false);
    try {
      const img = new Image();
      img.decoding = 'async';
      img.src = objectUrl;
      await img.decode();
      const canvas = document.createElement('canvas');
      canvas.width = PNG_SIZE;
      canvas.height = PNG_SIZE;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('no canvas');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, PNG_SIZE, PNG_SIZE);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(img, 0, 0, PNG_SIZE, PNG_SIZE);
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
      if (!blob) throw new Error('no blob');
      const href = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = href;
      a.download = fileName;
      a.click();
      setTimeout(() => URL.revokeObjectURL(href), 1000);
    } catch {
      setDownloadError(true);
    } finally {
      setDownloading(false);
    }
  };

  const close = () => dialogRef.current?.close();
  const retry = () => {
    setStatus('loading');
    setAttempt((n) => n + 1);
  };

  return (
    <dialog
      ref={openDialog}
      onClose={onClose}
      aria-labelledby="qr-title"
      aria-describedby={subtitle ? 'qr-subtitle' : undefined}
      className="m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-sm overflow-y-auto rounded-2xl border border-zinc-200 bg-white p-5 text-left text-zinc-900 shadow-lg backdrop:bg-primary/40 sm:p-6"
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 id="qr-title" className="text-lg font-semibold text-primary">
            {title}
          </h2>
          {subtitle && (
            <p id="qr-subtitle" className="mt-0.5 text-sm break-words text-zinc-600">
              {subtitle}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={close}
          aria-label="Tutup"
          className="-m-1 rounded-md p-1 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800 focus-visible:outline-2 focus-visible:outline-primary"
        >
          <svg aria-hidden="true" viewBox="0 0 20 20" fill="currentColor" className="size-5">
            <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
          </svg>
        </button>
      </div>

      {/* Focal point: the code itself, on a white quiet zone */}
      <div className="mx-auto aspect-square w-full max-w-64 overflow-hidden rounded-xl border border-zinc-200 bg-white p-2">
        {status === 'loading' && (
          <div
            role="status"
            aria-label="Memuat QR code"
            className="size-full rounded-lg bg-zinc-100 motion-safe:animate-pulse"
          />
        )}
        {status === 'ready' && objectUrl && (
          // Blob URL: next/image cannot optimize it, and the PNG is already sized for print.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={objectUrl} alt={`QR code menuju ${url}`} className="size-full" />
        )}
        {status !== 'loading' && status !== 'ready' && (
          <div className="flex size-full items-center justify-center rounded-lg bg-zinc-50 p-4 text-center">
            <QrIcon className="size-10 text-zinc-300" />
          </div>
        )}
      </div>

      <div className="mt-4 space-y-3" aria-live="polite">
        {status === 'unconfigured' && (
          <p role="alert" className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            <span className="font-semibold">URL publik belum dikonfigurasi.</span> Minta operator server mengisi{' '}
            <code className="font-mono text-xs">APP_URL</code> agar QR mengarah ke alamat yang benar.
          </p>
        )}
        {status === 'denied' && (
          <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            Tidak diizinkan atau data tidak ditemukan.
          </p>
        )}
        {status === 'error' && (
          <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            Gagal memuat QR code.{' '}
            <button type="button" onClick={retry} className="font-semibold underline underline-offset-2">
              Coba lagi
            </button>
          </div>
        )}

        {url && (
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-zinc-600">Alamat tujuan</p>
            <p className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 font-mono text-xs break-all text-zinc-800">
              {url}
            </p>
            <CopyAttendanceLink url={url} />
          </div>
        )}
      </div>

      <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button
          type="button"
          onClick={close}
          className="inline-flex items-center justify-center rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary motion-safe:transition-colors"
        >
          Tutup
        </button>
        {status === 'ready' && (
          <button type="button" onClick={downloadPng} disabled={downloading} className={primaryButton}>
            <svg aria-hidden="true" viewBox="0 0 20 20" fill="currentColor" className="size-4">
              <path d="M10.75 2.75a.75.75 0 0 0-1.5 0v8.614L6.295 8.235a.75.75 0 1 0-1.09 1.03l4.25 4.5a.75.75 0 0 0 1.09 0l4.25-4.5a.75.75 0 0 0-1.09-1.03l-2.955 3.129V2.75Z" />
              <path d="M3.5 12.75a.75.75 0 0 0-1.5 0v2.5A2.75 2.75 0 0 0 4.75 18h10.5A2.75 2.75 0 0 0 18 15.25v-2.5a.75.75 0 0 0-1.5 0v2.5c0 .69-.56 1.25-1.25 1.25H4.75c-.69 0-1.25-.56-1.25-1.25v-2.5Z" />
            </svg>
            {downloading ? 'Menyiapkan…' : 'Unduh PNG'}
          </button>
        )}
      </div>
      {downloadError && (
        <p role="alert" className="mt-2 text-right text-xs text-red-600">
          Gagal membuat file PNG. Silakan coba lagi.
        </p>
      )}
    </dialog>
  );
}

function QrIcon({ className = 'size-4' }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" fill="currentColor" className={className}>
      <path
        fillRule="evenodd"
        d="M3 4.25C3 3.56 3.56 3 4.25 3h3.5C8.44 3 9 3.56 9 4.25v3.5C9 8.44 8.44 9 7.75 9h-3.5C3.56 9 3 8.44 3 7.75v-3.5Zm1.5.25v3h3v-3h-3ZM11 4.25c0-.69.56-1.25 1.25-1.25h3.5c.69 0 1.25.56 1.25 1.25v3.5C17 8.44 16.44 9 15.75 9h-3.5C11.56 9 11 8.44 11 7.75v-3.5Zm1.5.25v3h3v-3h-3ZM3 12.25c0-.69.56-1.25 1.25-1.25h3.5c.69 0 1.25.56 1.25 1.25v3.5C9 16.44 8.44 17 7.75 17h-3.5C3.56 17 3 16.44 3 15.75v-3.5Zm1.5.25v3h3v-3h-3ZM11 11.75a.75.75 0 0 1 .75-.75h1.5a.75.75 0 0 1 0 1.5h-.75v.75a.75.75 0 0 1-1.5 0v-1.5ZM15.75 11a.75.75 0 0 1 .75.75v.5a.75.75 0 0 1-1.5 0v-.5a.75.75 0 0 1 .75-.75ZM11.75 15.5a.75.75 0 0 1 .75.75v.5a.75.75 0 0 1-1.5 0v-.5a.75.75 0 0 1 .75-.75ZM14.25 14a.75.75 0 0 1 .75.75v.5h.75a.75.75 0 0 1 0 1.5h-1.5a.75.75 0 0 1-.75-.75v-1.25a.75.75 0 0 1 .75-.75Z"
        clipRule="evenodd"
      />
    </svg>
  );
}
