'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Check, CircleDot, History, Play, X } from 'lucide-react';
import { getMyHistory, type HistoryEntry } from '@/lib/game/api';
import { useNow } from '@/lib/hooks/useNow';
import { usePlayer } from '@/lib/player/PlayerProvider';
import { getBrowserSupabase } from '@/lib/supabase/browser';
import { istDateString } from '@/lib/time/ist';

const PAGE = 30;
const fmt = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

function Result({ e, today }: { e: HistoryEntry; today: string }) {
  const tt = e.mode === 'time_travel';
  const playHref = e.date === today ? '/' : `/time-travel/${e.date}`;
  if (e.status === 'won') {
    return (
      <span className="flex items-center gap-1.5 text-success">
        <Check size={14} aria-hidden="true" /> Solved on clue {e.solved_on_clue}
        {tt ? ' · Time Travel (no points)' : ` · ${e.points} ${e.points === 1 ? 'pt' : 'pts'}`}
      </span>
    );
  }
  if (e.status === 'lost') return <span className="flex items-center gap-1.5 text-danger"><X size={14} aria-hidden="true" /> Missed{tt ? ' (time travel)' : ''}</span>;
  if (e.status === 'playing') return <Link href={playHref} className="flex items-center gap-1.5 text-accent"><CircleDot size={14} aria-hidden="true" /> In progress — continue</Link>;
  return (
    <Link href={playHref} className="flex items-center gap-1.5 text-muted hover:text-text">
      <Play size={13} aria-hidden="true" /> {e.date === today ? 'Not played yet — play now' : 'Missed — play in Time Travel'}
    </Link>
  );
}

export function HistoryView() {
  const player = usePlayer();
  const [items, setItems] = useState<HistoryEntry[] | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [failed, setFailed] = useState(false);
  const now = useNow();
  const today = now === null ? '' : istDateString(now);

  useEffect(() => {
    if (player.status !== 'ready') return;
    let cancelled = false;
    getMyHistory(getBrowserSupabase()!, PAGE, 0)
      .then(list => { if (!cancelled) { setItems(list); setHasMore(list.length === PAGE); } })
      .catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; };
  }, [player.status]);

  const loadMore = useCallback(async () => {
    if (!items) return;
    setLoadingMore(true);
    try {
      const more = await getMyHistory(getBrowserSupabase()!, PAGE, items.length);
      setItems([...items, ...more]);
      setHasMore(more.length === PAGE);
    } catch {
      setFailed(true);
    } finally {
      setLoadingMore(false);
    }
  }, [items]);

  if (failed || player.status === 'error') return <p className="mt-8 text-[12px] text-danger">Couldn’t load your history. Please refresh.</p>;
  if (!items) return <div className="mt-8 h-72 max-w-[900px] animate-pulse rounded-2xl border border-line bg-panel" aria-busy="true" />;
  if (items.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-icon" aria-hidden="true"><History /></div>
        <h2 className="font-display m-0 mb-2 text-[20px] font-bold">Your history starts today</h2>
        <p>Play today’s challenge and it will show up here.</p>
        <Link className="submit-button" href="/">PLAY TODAY ↗</Link>
      </div>
    );
  }

  return (
    <div className="mt-8 max-w-[900px]">
      <ol className="m-0 grid list-none gap-2 p-0">
        {items.map(e => (
          <li key={e.date} className="grid gap-1 rounded-2xl border border-line bg-panel px-4 py-3.5 sm:grid-cols-[170px_1fr_auto] sm:items-center sm:gap-4">
            <span className="font-mono text-[11px] text-muted">#{String(e.number).padStart(3, '0')} · {fmt(e.date)}</span>
            <span className="font-display text-[16px]">
              {e.title ?? <span className="font-sans text-[13px] text-muted">{e.status ? 'Revealed when you finish' : '—'}</span>}
              {e.title && e.year ? <span className="ml-2 font-mono text-[11px] text-muted">{e.year}</span> : null}
            </span>
            <span className="text-[12px]"><Result e={e} today={today} /></span>
          </li>
        ))}
      </ol>
      {hasMore && (
        <button onClick={loadMore} disabled={loadingMore} className="mt-4 cursor-pointer rounded-lg border border-line bg-panel px-4 py-2 text-[12px] text-text disabled:opacity-50">
          {loadingMore ? 'Loading…' : 'Show older days'}
        </button>
      )}
    </div>
  );
}
