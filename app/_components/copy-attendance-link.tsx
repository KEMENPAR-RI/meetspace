'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, Copy, TriangleAlert } from 'lucide-react';

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
      <p role="note" className="flex items-center gap-1.5 text-xs text-amber-800">
        <TriangleAlert className="size-3.5 shrink-0" />
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
        {status === 'copied' ? <Check className="size-4" /> : <Copy className="size-4" />}
        {status === 'copied' ? 'Tersalin' : 'Copy link'}
      </button>
      <p aria-live="polite" className="sr-only">
        {status === 'copied' ? 'Link tersalin' : ''}
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
