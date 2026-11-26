'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { getMyStats, type MyStats } from '@/lib/game/api';
import { getBrowserSupabase } from '@/lib/supabase/browser';
import { usePlayer } from './PlayerProvider';

export type DistributionKey = '1' | '2' | '3' | 'missed';

type StatsContextValue = {
  stats: MyStats | null; // null while loading or unavailable
  refresh: () => void;
  /** The Wordle-style statistics popup. `highlight` marks today's result. */
  dialog: { open: boolean; highlight: DistributionKey | null };
  openStats: (highlight?: DistributionKey | null) => void;
  closeStats: () => void;
};

const StatsContext = createContext<StatsContextValue | null>(null);

/** The signed-in player's streak and stats, shared by the sidebar, top bar, right rail and popup. */
export function StatsProvider({ children }: { children: React.ReactNode }) {
  const player = usePlayer();
  const [stats, setStats] = useState<MyStats | null>(null);
  const [version, setVersion] = useState(0);
  const [dialog, setDialog] = useState<StatsContextValue['dialog']>({ open: false, highlight: null });

  useEffect(() => {
    if (player.status !== 'ready') return;
    let cancelled = false;
    getMyStats(getBrowserSupabase()!)
      .then(s => { if (!cancelled) setStats(s); })
      .catch(() => { /* stats are decorative; the game works without them */ });
    return () => { cancelled = true; };
  }, [player.status, version]);

  const refresh = useCallback(() => setVersion(v => v + 1), []);
  const openStats = useCallback((highlight: DistributionKey | null = null) => setDialog({ open: true, highlight }), []);
  const closeStats = useCallback(() => setDialog(d => ({ ...d, open: false })), []);
  const value = useMemo(() => ({ stats, refresh, dialog, openStats, closeStats }), [stats, refresh, dialog, openStats, closeStats]);
  return <StatsContext.Provider value={value}>{children}</StatsContext.Provider>;
}

export function useStats(): StatsContextValue {
  const ctx = useContext(StatsContext);
  if (!ctx) throw new Error('useStats must be used inside <StatsProvider>');
  return ctx;
}
