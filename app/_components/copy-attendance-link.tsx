'use client';

import { useEffect, useRef, useState } from 'react';

// Copies the absolute URL (built server-side from APP_URL); falls back to a selectable field.
export function CopyAttendanceLink({ url }: { url: string | null }) {
  const [status, setStatus] = useState<'idle' | 'copied' | 'manual'>('idle');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (status !== 'copied') return;
    const timer = setTimeout(() => setStatus('idle'), 2000);
    return () => clearTimeout(timer);
  }, [status]);

  useEffect(() => {
    if (status === 'manual') inputRef.current?.select();
  }, [status]);

  if (!url) {
    return (
      <p role="note" className="text-xs text-amber-800">
        Link belum tersedia: URL publik aplikasi belum dikonfigurasi.
      </p>
    );
  }

  const onClick = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setStatus('copied');
    } catch {
      setStatus('manual');
    }
  };

  return (
    <div className="min-w-0 space-y-2">
      <button
        type="button"
        onClick={onClick}
        className="inline-flex items-center gap-1.5 rounded-lg border border-primary/20 bg-white px-3 py-1.5 text-sm font-medium text-primary shadow-xs hover:bg-primary/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary motion-safe:transition-colors"
      >
        <svg aria-hidden="true" viewBox="0 0 20 20" fill="currentColor" className="size-4">
          <path d="M12.232 4.232a2.5 2.5 0 0 1 3.536 3.536l-1.225 1.224a.75.75 0 0 0 1.061 1.06l1.224-1.224a4 4 0 0 0-5.656-5.656l-3 3a4 4 0 0 0 .225 5.865.75.75 0 0 0 .977-1.138 2.5 2.5 0 0 1-.142-3.667l3-3Z" />
          <path d="M11.603 7.963a.75.75 0 0 0-.977 1.138 2.5 2.5 0 0 1 .142 3.667l-3 3a2.5 2.5 0 0 1-3.536-3.536l1.225-1.224a.75.75 0 0 0-1.061-1.06l-1.224 1.224a4 4 0 1 0 5.656 5.656l3-3a4 4 0 0 0-.225-5.865Z" />
        </svg>
        {status === 'copied' ? 'Tersalin' : 'Copy link'}
      </button>
      <p aria-live="polite" className="sr-only">
        {status === 'copied' ? 'Link daftar hadir tersalin' : ''}
      </p>
      {status === 'manual' && (
        <div className="space-y-1">
          <label htmlFor="attendance-link" className="block text-xs text-zinc-600">
            Salin link secara manual:
          </label>
          <input
            ref={inputRef}
            id="attendance-link"
            type="text"
            readOnly
            value={url}
            onFocus={(e) => e.currentTarget.select()}
            className="block w-full min-w-0 rounded-lg border border-zinc-300 bg-zinc-50 px-3 py-1.5 font-mono text-xs text-zinc-800 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25"
          />
        </div>
      )}
    </div>
  );
}
