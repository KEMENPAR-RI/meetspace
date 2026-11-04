'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CircleHelp, TriangleAlert } from 'lucide-react';

export type ConfirmOptions = {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  tone?: 'danger' | 'default';
};

type Pending = { options: ConfirmOptions; resolve: (value: boolean) => void };

// Per-component confirm: the dialog DOM exists only while a confirm is pending.
export function useConfirm(): {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
  confirmDialog: React.ReactNode;
} {
  const [pending, setPending] = useState<Pending | null>(null);
  const pendingRef = useRef<Pending | null>(null);

  const confirm = useCallback(
    (options: ConfirmOptions) =>
      new Promise<boolean>((resolve) => {
        pendingRef.current?.resolve(false); // a newer confirm replaces the old one
        const next = { options, resolve };
        pendingRef.current = next;
        setPending(next);
      }),
    [],
  );

  const settle = useCallback((value: boolean) => {
    const current = pendingRef.current;
    if (!current) return;
    pendingRef.current = null;
    setPending(null);
    current.resolve(value);
  }, []);

  useEffect(
    () => () => {
      pendingRef.current?.resolve(false);
      pendingRef.current = null;
    },
    [],
  );

  // Portal is only created after a click, never during SSR/prerender.
  const confirmDialog = pending
    ? createPortal(<ConfirmDialog options={pending.options} onSettle={settle} />, document.body)
    : null;

  return { confirm, confirmDialog };
}

function ConfirmDialog({
  options,
  onSettle,
}: {
  options: ConfirmOptions;
  onSettle: (value: boolean) => void;
}) {
  const id = useId();
  const confirmRef = useRef<HTMLButtonElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const danger = options.tone === 'danger';

  // close() before unmount so the browser restores focus to the opener.
  const done = (value: boolean) => {
    dialogRef.current?.close();
    onSettle(value);
  };

  // Child refs attach before the parent ref callback runs.
  const openDialog = useCallback(
    (el: HTMLDialogElement | null) => {
      dialogRef.current = el;
      if (!el || el.open) return;
      el.showModal();
      (danger ? cancelRef : confirmRef).current?.focus();
    },
    [danger],
  );

  return (
    <dialog
      ref={openDialog}
      aria-labelledby={`${id}-title`}
      aria-describedby={`${id}-message`}
      onCancel={(e) => {
        // Esc: settle here instead of letting the native close race the unmount.
        e.preventDefault();
        e.stopPropagation();
        done(false);
      }}
      onClose={(e) => {
        e.stopPropagation();
        onSettle(false);
      }}
      className="m-auto w-[calc(100%-2rem)] max-w-sm rounded-2xl border border-zinc-200 bg-white p-5 text-zinc-900 shadow-lg backdrop:bg-primary/40 sm:p-6"
    >
      <span
        className={`mb-3 flex size-10 items-center justify-center rounded-full ${danger ? 'bg-red-50 text-red-600' : 'bg-secondary/30 text-primary'}`}
      >
        {danger ? <TriangleAlert className="size-5" /> : <CircleHelp className="size-5" />}
      </span>
      <h2 id={`${id}-title`} className="text-lg font-semibold text-primary">
        {options.title}
      </h2>
      <p id={`${id}-message`} className="mt-2 text-sm text-zinc-600">
        {options.message}
      </p>
      <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button
          ref={cancelRef}
          type="button"
          onClick={() => done(false)}
          className="inline-flex items-center justify-center rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary motion-safe:transition-colors"
        >
          {options.cancelText ?? 'Kembali'}
        </button>
        <button
          ref={confirmRef}
          type="button"
          onClick={() => done(true)}
          className={`inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-semibold text-white shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 motion-safe:transition-colors ${
            danger
              ? 'bg-red-600 hover:bg-red-700 focus-visible:outline-red-600'
              : 'bg-primary hover:bg-primary/90 focus-visible:outline-primary'
          }`}
        >
          {options.confirmText ?? 'Lanjutkan'}
        </button>
      </div>
    </dialog>
  );
}
