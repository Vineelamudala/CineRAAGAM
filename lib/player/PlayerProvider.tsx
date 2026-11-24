'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getBrowserSupabase } from '@/lib/supabase/browser';
import { normalizeDisplayName, validateDisplayName } from './displayName';

export type PlayerStatus = 'loading' | 'ready' | 'error' | 'offline-config';

type PlayerContextValue = {
  status: PlayerStatus;
  userId: string | null;
  displayName: string | null;
  /** Saves the display name on the server. Resolves to an error message, or null on success. */
  saveDisplayName: (name: string) => Promise<string | null>;
  retry: () => void;
};

const PlayerContext = createContext<PlayerContextValue | null>(null);

// One sign-in attempt per page load, even with React Strict Mode double effects.
let sessionPromise: Promise<string> | null = null;

async function ensureAnonymousSession(supabase: SupabaseClient): Promise<string> {
  const { data } = await supabase.auth.getSession();
  if (data.session?.user) return data.session.user.id;
  const { data: signIn, error } = await supabase.auth.signInAnonymously();
  if (error || !signIn.user) throw error ?? new Error('Anonymous sign-in failed');
  return signIn.user.id;
}

type State = { status: PlayerStatus; userId: string | null; displayName: string | null };

export function PlayerProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<State>({ status: 'loading', userId: null, displayName: null });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const supabase = getBrowserSupabase();
    let cancelled = false;

    async function load() {
      if (!supabase) {
        console.warn('Supabase is not configured (NEXT_PUBLIC_SUPABASE_URL / _PUBLISHABLE_KEY). Running without player profiles.');
        return { status: 'offline-config' as const, userId: null, displayName: null };
      }
      sessionPromise ??= ensureAnonymousSession(supabase);
      try {
        const userId = await sessionPromise;
        const { data, error } = await supabase.from('profiles').select('display_name').eq('id', userId).maybeSingle();
        if (error) throw error;
        return { status: 'ready' as const, userId, displayName: data?.display_name ?? null };
      } catch (err) {
        sessionPromise = null; // allow a retry
        console.error('Could not start player session', err);
        return { status: 'error' as const, userId: null, displayName: null };
      }
    }

    load().then(next => { if (!cancelled) setState(next); });
    return () => { cancelled = true; };
  }, [attempt]);

  const saveDisplayName = useCallback(async (raw: string): Promise<string | null> => {
    const invalid = validateDisplayName(raw);
    if (invalid) return invalid;
    const supabase = getBrowserSupabase();
    if (!supabase || state.status !== 'ready') return 'We could not reach the server. Please try again in a moment.';

    const { data, error } = await supabase.rpc('set_display_name', { p_name: normalizeDisplayName(raw) });
    if (error) {
      if (error.code === '23505') return 'That name is already taken. Try adding a number, e.g. ' + normalizeDisplayName(raw).slice(0, 17) + '7.';
      if (error.code === '22023') return 'That name is not allowed. Use English or Telugu letters, numbers, spaces, dots, dashes or underscores.';
      console.error('set_display_name failed', error);
      return 'Could not save your name. Please try again.';
    }
    setState(s => ({ ...s, displayName: data as string }));
    return null;
  }, [state.status]);

  const retry = useCallback(() => {
    setState(s => ({ ...s, status: 'loading' }));
    setAttempt(a => a + 1);
  }, []);

  const value = useMemo(() => ({ ...state, saveDisplayName, retry }), [state, saveDisplayName, retry]);
  return <PlayerContext.Provider value={value}>{children}</PlayerContext.Provider>;
}

export function usePlayer(): PlayerContextValue {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error('usePlayer must be used inside <PlayerProvider>');
  return ctx;
}
