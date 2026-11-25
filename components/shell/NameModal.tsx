'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { AudioLines, X } from 'lucide-react';
import { DISPLAY_NAME_MAX, validateDisplayName } from '@/lib/player/displayName';

type Props = {
  initialName: string;
  /** Saves the name; resolves to an error message, or null on success. */
  onSave: (name: string) => Promise<string | null>;
  onClose: () => void;
};

export function NameModal({ initialName, onSave, onClose }: Props) {
  const [value, setValue] = useState(initialName);
  const [touched, setTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const titleId = useId();
  const errorId = useId();

  const localError = validateDisplayName(value);
  const shownError = serverError ?? (touched && value.trim() !== '' ? localError : null);

  // Focus the input on open; on close, restore focus to the previous element,
  // or to the main content when nothing had focus (e.g. the first-visit prompt).
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    inputRef.current?.focus();
    return () => {
      const target = previous && previous !== document.body && previous.isConnected ? previous : document.getElementById('main');
      target?.focus({ preventScroll: true });
    };
  }, []);

  async function submit() {
    setTouched(true);
    if (localError || saving) return;
    setSaving(true);
    const error = await onSave(value);
    setSaving(false);
    setServerError(error);
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
            onChange={e => { setValue(e.target.value); setServerError(null); }}
            onBlur={() => setTouched(true)}
            placeholder="Your name"
            aria-invalid={shownError ? true : undefined}
            aria-describedby={shownError ? errorId : undefined}
          />
          {shownError && <p id={errorId} role="alert" className="text-danger! -mt-1! mb-3! text-[11px]!">{shownError}</p>}
          <button type="submit" className="submit-button modal-submit" disabled={!value.trim() || saving}>
            {saving ? 'SAVING…' : <>LET’S PLAY <span aria-hidden="true">↗</span></>}
          </button>
        </form>
        <small>No email. No password. Just your name.</small>
        <small className="mt-1.5! leading-normal">Your progress is saved in this browser. Clearing browser data or switching devices starts a fresh profile.</small>
        <button className="skip-name" onClick={onClose}>Maybe later</button>
      </div>
    </div>
  );
}
