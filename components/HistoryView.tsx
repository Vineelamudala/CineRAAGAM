'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Check, SkipForward, X } from 'lucide-react';
import { getMyHistory, type HistoryEntry } from '@/lib/game/api';
import { TOTAL_CLUES } from '@/lib/game/rules';
import { useNow } from '@/lib/hooks/useNow';
import { usePlayer } from '@/lib/player/PlayerProvider';
import { getBrowserSupabase } from '@/lib/supabase/browser';
import { istDateString } from '@/lib/time/ist';

const PAGE = 30;
const fmt = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

/** One line describing the day's result, e.g. "Won · 2 clues · 2 pts". */
function summary(e: HistoryEntry): { text: string; tone: string } {
  const clues = `${e.clues_used} ${e.clues_used === 1 ? 'clue' : 'clues'}`;
  const tt = e.mode === 'time_travel';
  if (e.status === 'won') return { text: tt ? `Won · ${clues} · Time Travel (no points)` : `Won · ${clues} · ${e.points} ${e.points === 1 ? 'pt' : 'pts'}`, tone: 'text-success' };
  if (e.status === 'lost') return { text: tt ? 'Missed · Time Travel' : 'Missed · 0 pts', tone: 'text-danger' };
  if (e.status === 'playing') return { text: `In progress · ${clues} used`, tone: 'text-accent' };
  return { text: 'Not played', tone: 'text-muted' };
}

/** One circle per clue: ✓ solved, ✗ wrong, ⏭ skipped, empty = not reached. */
function ClueCircles({ results }: { results: HistoryEntry['results'] }) {
  return (
    <span className="flex gap-1.5" aria-hidden="true">
      {Array.from({ length: TOTAL_CLUES }, (_, i) => {
        const r = results[i];
        const cls = r === 'correct' ? 'border-success bg-success text-bg'
          : r === 'wrong' ? 'border-danger bg-danger/20 text-danger'
          : r === 'skipped' ? 'border-line bg-panel-2 text-muted'
          : 'border-line bg-transparent';
        return (
          <span key={i} className={`grid h-8 w-8 place-items-center rounded-full border-2 ${cls}`}>
            {r === 'correct' ? <Check size={15} strokeWidth={3} /> : r === 'wrong' ? <X size={15} strokeWidth={3} /> : r === 'skipped' ? <SkipForward size={13} /> : null}
          </span>
        );
      })}
    </span>
  );
}

/** "Daily history" on the Statistics page. */
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

  if (failed || player.status === 'error') return <p className="text-[12px] text-danger">Couldn’t load your history. Please refresh.</p>;
  if (!items) return <div className="h-40 animate-pulse rounded-2xl border border-line bg-panel" aria-busy="true" />;
  if (items.length === 0) {
    return <p className="m-0 text-[13px] text-muted">Your daily history starts with your first game. <Link href="/" className="text-text">Play today ↗</Link></p>;
  }

  return (
    <>
      <ol className="m-0 grid list-none gap-2 p-0" aria-label="Daily history">
        {items.map(e => {
          const s = summary(e);
          const playHref = e.date === today ? '/' : `/time-travel/${e.date}`;
          return (
            <li key={e.date} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-panel px-4 py-3.5">
              <div className="grid gap-1">
                <span className="text-[14px] font-semibold">
                  {fmt(e.date)} <span className="ml-1 font-mono text-[11px] font-normal text-muted">#{String(e.number).padStart(3, '0')}</span>
                </span>
                <span className={`text-[12px] ${s.tone}`}>
                  {s.text}
                  {e.title && <span className="text-muted"> · {e.title}</span>}
                </span>
                {(e.status === null || e.status === 'playing') && (
                  <Link href={playHref} className="text-[11px] text-muted hover:text-text">
                    {e.status === 'playing' ? 'In progress — continue' : e.date === today ? 'Not played yet — play now' : 'Missed — play in Time Travel'} →
                  </Link>
                )}
              </div>
              <ClueCircles results={e.results ?? []} />
            </li>
          );
        })}
      </ol>
      {hasMore && (
        <button onClick={loadMore} disabled={loadingMore} className="mt-4 cursor-pointer rounded-lg border border-line bg-panel px-4 py-2 text-[12px] text-text disabled:opacity-50">
          {loadingMore ? 'Loading…' : 'Show older days'}
        </button>
      )}
    </>
  );
}
