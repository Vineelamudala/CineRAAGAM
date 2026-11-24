'use client';

import { useCallback, useSyncExternalStore } from 'react';

const EVENT = 'cineraagam:storage';

function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null; // storage blocked (private mode, disabled cookies, ...)
  }
}

/**
 * A localStorage-backed string value that stays in sync across components
 * and tabs. Server render and storage failures fall back to null.
 *
 * Interim only: from Phase 1 the display name lives in Supabase.
 */
export function useStoredValue(key: string): [string | null, (value: string | null) => void] {
  const subscribe = useCallback((onChange: () => void) => {
    const handler = (e: Event) => {
      if (e instanceof StorageEvent && e.key !== null && e.key !== key) return;
      onChange();
    };
    window.addEventListener('storage', handler);
    window.addEventListener(EVENT, handler);
    return () => {
      window.removeEventListener('storage', handler);
      window.removeEventListener(EVENT, handler);
    };
  }, [key]);

  const value = useSyncExternalStore(subscribe, () => read(key), () => null);

  const setValue = useCallback((next: string | null) => {
    try {
      if (next === null) window.localStorage.removeItem(key);
      else window.localStorage.setItem(key, next);
    } catch {
      /* ignore: value just won't persist */
    }
    window.dispatchEvent(new Event(EVENT));
  }, [key]);

  return [value, setValue];
}
