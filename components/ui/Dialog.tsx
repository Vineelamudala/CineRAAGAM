'use client';

import { useEffect, useId, useRef } from 'react';
import { X } from 'lucide-react';

/**
 * Accessible modal dialog: labelled, Escape / backdrop click closes, Tab stays
 * inside, focus moves in on open and returns to where it was on close.
 */
export function Dialog({ title, onClose, children, className = '' }: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    ref.current?.querySelector<HTMLElement>('[data-autofocus], button')?.focus();
    return () => {
      const target = previous && previous !== document.body && previous.isConnected ? previous : document.getElementById('main');
      target?.focus({ preventScroll: true });
    };
  }, []);

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') { e.stopPropagation(); onClose(); return; }
    if (e.key !== 'Tab' || !ref.current) return;
    const focusable = ref.current.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input, [tabindex="0"]');
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }

  return (
    <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onKeyDown={onKeyDown}
        className={`relative max-h-[92vh] w-full max-w-[460px] overflow-y-auto rounded-2xl border border-line bg-panel p-6 shadow-2xl ${className}`}
      >
        <div className="mb-5 flex items-center justify-between gap-3">
          <h2 id={titleId} className="font-display m-0 text-[24px] font-bold">{title}</h2>
          <button onClick={onClose} aria-label="Close" className="grid h-9 w-9 cursor-pointer place-items-center rounded-full border border-line bg-transparent text-text hover:border-muted">
            <X size={17} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
