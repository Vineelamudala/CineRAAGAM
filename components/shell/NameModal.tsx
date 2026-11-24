'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { AudioLines, X } from 'lucide-react';
import { DISPLAY_NAME_MAX, normalizeDisplayName, validateDisplayName } from '@/lib/player/displayName';

type Props = {
  initialName: string;
  onSave: (name: string) => void;
  onClose: () => void;
};

export function NameModal({ initialName, onSave, onClose }: Props) {
  const [value, setValue] = useState(initialName);
  const [touched, setTouched] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const titleId = useId();
  const errorId = useId();

  const error = validateDisplayName(value);
  const showError = touched && value.trim() !== '' && error;

  // Focus the input on open; restore focus to the previous element on close.
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    inputRef.current?.focus();
    return () => previous?.focus?.();
  }, []);

  function submit() {
    setTouched(true);
    if (!error) onSave(normalizeDisplayName(value));
  }

  // Escape closes; Tab stays inside the dialog.
  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') { e.stopPropagation(); onClose(); return; }
    if (e.key !== 'Tab' || !dialogRef.current) return;
    const focusable = dialogRef.current.querySelectorAll<HTMLElement>('button:not([disabled]), input');
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }

  return (
    <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div ref={dialogRef} className="name-modal" role="dialog" aria-modal="true" aria-labelledby={titleId} onKeyDown={onKeyDown}>
        <button className="modal-close" onClick={onClose} aria-label="Close"><X size={17} /></button>
        <div className="brand-mark modal-mark" aria-hidden="true"><AudioLines size={22} /></div>
        <div className="eyebrow centered">WELCOME TO CINERAAGAM</div>
        <h2 id={titleId}>What should we<br /><em>call you?</em></h2>
        <p>Choose a display name for your player profile and leaderboard.</p>
        <form onSubmit={e => { e.preventDefault(); submit(); }} noValidate>
          <label htmlFor="display-name" className="sr-only-live">Display name</label>
          <input
            id="display-name"
            ref={inputRef}
            value={value}
            maxLength={DISPLAY_NAME_MAX}
            autoComplete="nickname"
            onChange={e => setValue(e.target.value)}
            onBlur={() => setTouched(true)}
            placeholder="Your name"
            aria-invalid={showError ? true : undefined}
            aria-describedby={showError ? errorId : undefined}
          />
          {showError && <p id={errorId} role="alert" className="text-danger! -mt-1! mb-3! text-[11px]!">{error}</p>}
          <button type="submit" className="submit-button modal-submit" disabled={!value.trim()}>LET’S PLAY <span aria-hidden="true">↗</span></button>
        </form>
        <small>No email. No password. Just your name.</small>
        <button className="skip-name" onClick={onClose}>Maybe later</button>
      </div>
    </div>
  );
}
