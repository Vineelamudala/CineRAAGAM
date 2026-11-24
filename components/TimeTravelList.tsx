'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { CalendarDays, Check, CircleDot, Play, X } from 'lucide-react';
import { listPastChallenges, type PastChallenge } from '@/lib/game/api';
import { usePlayer } from '@/lib/player/PlayerProvider';
import { getBrowserSupabase } from '@/lib/supabase/browser';

const fmt = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });

function describe(c: PastChallenge): { label: string; icon: React.ReactNode; tone: string } {
  if (c.status === 'won') return { label: `Solved · ${c.points} ${c.points === 1 ? 'pt' : 'pts'}${c.mode === 'time_travel' ? ' (for fun)' : ''}`, icon: <Check size={14} />, tone: 'text-success' };
  if (c.status === 'lost') return { label: 'Missed', icon: <X size={14} />, tone: 'text-danger' };
  if (c.status === 'playing') return { label: 'In progress', icon: <CircleDot size={14} />, tone: 'text-accent' };
  return { label: 'Not played', icon: <Play size={13} />, tone: 'text-muted' };
}

export function TimeTravelList() {
  const player = usePlayer();
  const [items, setItems] = useState<PastChallenge[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (player.status !== 'ready') return;
    let cancelled = false;
    listPastChallenges(getBrowserSupabase()!)
      .then(list => { if (!cancelled) setItems(list); })
      .catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; };
  }, [player.status]);

  if (failed || player.status === 'error') {
    return <p className="mt-8 text-[12px] text-danger">Couldn’t load past challenges. Please refresh to try again.</p>;
  }
  if (!items) {
    return <div className="mt-8 grid grid-cols-[repeat(auto-fill,minmax(210px,1fr))] gap-3" aria-busy="true">{Array.from({ length: 6 }, (_, i) => <div key={i} className="h-[92px] animate-pulse rounded-2xl border border-line bg-panel" />)}</div>;
  }
  if (items.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-icon" aria-hidden="true"><CalendarDays /></div>
        <h2 className="font-display m-0 mb-2 text-[20px] font-bold">No past shows yet</h2>
        <p>Once a few daily challenges have aired, you can replay them here.</p>
        <Link className="submit-button" href="/">PLAY TODAY ↗</Link>
      </div>
    );
  }

  return (
    <ul className="mt-8 grid list-none grid-cols-[repeat(auto-fill,minmax(210px,1fr))] gap-3 p-0">
      {items.map(c => {
        const d = describe(c);
        return (
          <li key={c.date}>
            <Link
              href={`/time-travel/${c.date}`}
              className="group flex h-full flex-col gap-2 rounded-2xl border border-line bg-panel p-4 text-text no-underline transition-colors hover:border-accent/50 hover:bg-panel-2"
            >
              <span className="font-mono text-[10px] tracking-[0.2em] text-muted">#{String(c.number).padStart(3, '0')}</span>
              <span className="font-display text-[18px]">{fmt(c.date)}</span>
              <span className={`flex items-center gap-1.5 text-[11px] ${d.tone}`}>{d.icon} {d.label}</span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
