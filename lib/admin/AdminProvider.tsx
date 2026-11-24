'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getBrowserSupabase } from '@/lib/supabase/browser';

/**
 * Admin session state for the dashboard UI. This only decides what to SHOW;
 * every read and write is still enforced by Row Level Security
 * (private.is_admin(), which also requires 2-step verification when enrolled).
 */
export type AdminStatus = 'loading' | 'signed-out' | 'player' | 'not-admin' | 'needs-mfa' | 'ready' | 'unconfigured';

type AdminContextValue = {
  status: AdminStatus;
  email: string | null;
  mfaEnabled: boolean;
  supabase: SupabaseClient | null;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AdminContext = createContext<AdminContextValue | null>(null);

export async function evaluateAdmin(supabase: SupabaseClient): Promise<{ status: AdminStatus; email: string | null; mfaEnabled: boolean }> {
  const { data: { session } } = await supabase.auth.getSession();
  const user = session?.user;
  if (!user) return { status: 'signed-out', email: null, mfaEnabled: false };
  if (user.is_anonymous) return { status: 'player', email: null, mfaEnabled: false };
  if (user.app_metadata?.role !== 'admin') return { status: 'not-admin', email: user.email ?? null, mfaEnabled: false };
  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aal?.nextLevel === 'aal2' && aal.currentLevel !== 'aal2') return { status: 'needs-mfa', email: user.email ?? null, mfaEnabled: true };
  return { status: 'ready', email: user.email ?? null, mfaEnabled: aal?.currentLevel === 'aal2' };
}

export function AdminProvider({ children }: { children: React.ReactNode }) {
  const supabase = getBrowserSupabase();
  const [state, setState] = useState<{ status: AdminStatus; email: string | null; mfaEnabled: boolean }>({
    status: supabase ? 'loading' : 'unconfigured', email: null, mfaEnabled: false,
  });

  const refresh = useCallback(async () => {
    if (!supabase) return;
    setState(await evaluateAdmin(supabase));
  }, [supabase]);

  useEffect(() => {
    if (!supabase) return;
    let cancelled = false;
    evaluateAdmin(supabase).then(s => { if (!cancelled) setState(s); });
    const { data: sub } = supabase.auth.onAuthStateChange(event => {
      if (event === 'SIGNED_OUT' || event === 'SIGNED_IN' || event === 'MFA_CHALLENGE_VERIFIED') {
        evaluateAdmin(supabase).then(s => { if (!cancelled) setState(s); });
      }
    });
    return () => { cancelled = true; sub.subscription.unsubscribe(); };
  }, [supabase]);

  const signOut = useCallback(async () => {
    await supabase?.auth.signOut();
    setState({ status: 'signed-out', email: null, mfaEnabled: false });
  }, [supabase]);

  const value = useMemo(() => ({ ...state, supabase, refresh, signOut }), [state, supabase, refresh, signOut]);
  return <AdminContext.Provider value={value}>{children}</AdminContext.Provider>;
}

export function useAdmin(): AdminContextValue {
  const ctx = useContext(AdminContext);
  if (!ctx) throw new Error('useAdmin must be used inside <AdminProvider>');
  return ctx;
}

/** Supabase client for admin pages (only rendered once the admin is signed in). */
export function useAdminDb(): SupabaseClient {
  const { supabase } = useAdmin();
  if (!supabase) throw new Error('Supabase is not configured');
  return supabase;
}
