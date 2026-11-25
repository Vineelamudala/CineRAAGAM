'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CalendarDays, Check, ChevronLeft, ChevronRight, CircleDot, LayoutList, Play, Shuffle, X } from 'lucide-react';
import { listPastChallenges, type PastChallenge } from '@/lib/game/api';
import { usePlayer } from '@/lib/player/PlayerProvider';
import { getBrowserSupabase } from '@/lib/supabase/browser';
import { monthGrid, monthLabel, monthOf, shiftMonth, type MonthKey } from '@/lib/time/calendar';

type Filter = 'all' | 'unplayed' | 'playing' | 'won' | 'lost';
const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'unplayed', label: 'Not played' },
  { id: 'playing', label: 'In progress' },
  { id: 'won', label: 'Solved' },
  { id: 'lost', label: 'Missed' },
];

const matches = (c: PastChallenge, f: Filter) =>
  f === 'all' || (f === 'unplayed' ? c.status === null : c.status === f);

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
  const router = useRouter();
  const [items, setItems] = useState<PastChallenge[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [view, setView] = useState<'calendar' | 'list'>('calendar');
  const [filter, setFilter] = useState<Filter>('all');
  const [month, setMonth] = useState<MonthKey | null>(null);

  useEffect(() => {
    if (player.status !== 'ready') return;
    let cancelled = false;
    listPastChallenges(getBrowserSupabase()!, 200)
      .then(list => { if (!cancelled) setItems(list); })
      .catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; };
  }, [player.status]);

  const byDate = useMemo(() => new Map((items ?? []).map(c => [c.date, c])), [items]);
  const newest = items?.[0] ? monthOf(items[0].date) : null;
  const oldest = items?.length ? monthOf(items[items.length - 1].date) : null;
  const shownMonth = month ?? newest;
  const filtered = (items ?? []).filter(c => matches(c, filter));
  const unplayed = (items ?? []).filter(c => c.status === null);

  function surprise() {
    const pick = unplayed[Math.floor(Math.random() * unplayed.length)];
    if (pick) router.push(`/time-travel/${pick.date}`);
  }

  if (failed || player.status === 'error') {
    return <p className="mt-8 text-[12px] text-danger">Couldn’t load past challenges. Please refresh to try again.</p>;
  }
  if (!items) {
    return <div className="mt-8 h-80 max-w-[760px] animate-pulse rounded-2xl border border-line bg-panel" aria-busy="true" />;
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

  const chip = (active: boolean) =>
    `cursor-pointer rounded-full border px-3 py-1.5 text-[12px] ${active ? 'border-text bg-text text-bg' : 'border-line bg-transparent text-muted hover:text-text'}`;

  return (
    <div className="mt-8 max-w-[760px]">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div role="group" aria-label="Show" className="flex flex-wrap gap-1.5">
          {FILTERS.map(f => (
            <button key={f.id} aria-pressed={filter === f.id} onClick={() => setFilter(f.id)} className={chip(filter === f.id)}>
              {f.label}
            </button>
          ))}
        </div>
        <div className="flex gap-1.5">
          <button onClick={surprise} disabled={!unplayed.length} className={`${chip(false)} flex items-center gap-1.5 disabled:opacity-40`}>
            <Shuffle size={13} aria-hidden="true" /> Surprise me
          </button>
          <div role="group" aria-label="View" className="flex rounded-full border border-line p-0.5">
            <button aria-pressed={view === 'calendar'} aria-label="Calendar view" onClick={() => setView('calendar')} className={`cursor-pointer rounded-full border-0 px-2.5 py-1 ${view === 'calendar' ? 'bg-panel-2 text-text' : 'bg-transparent text-muted'}`}><CalendarDays size={14} /></button>
            <button aria-pressed={view === 'list'} aria-label="List view" onClick={() => setView('list')} className={`cursor-pointer rounded-full border-0 px-2.5 py-1 ${view === 'list' ? 'bg-panel-2 text-text' : 'bg-transparent text-muted'}`}><LayoutList size={14} /></button>
          </div>
        </div>
      </div>

      {view === 'calendar' && shownMonth ? (
        <section className="rounded-2xl border border-line bg-panel p-4 md:p-6" aria-label="Calendar">
          <div className="mb-4 flex items-center justify-between">
            <button onClick={() => setMonth(shiftMonth(shownMonth, -1))} disabled={!oldest || shownMonth <= oldest} aria-label="Previous month"
              className="grid h-9 w-9 cursor-pointer place-items-center rounded-full border border-line bg-transparent text-text disabled:opacity-30"><ChevronLeft size={16} /></button>
            <h2 className="font-display m-0 text-[20px]" aria-live="polite">{monthLabel(shownMonth)}</h2>
            <button onClick={() => setMonth(shiftMonth(shownMonth, 1))} disabled={!newest || shownMonth >= newest} aria-label="Next month"
              className="grid h-9 w-9 cursor-pointer place-items-center rounded-full border border-line bg-transparent text-text disabled:opacity-30"><ChevronRight size={16} /></button>
          </div>
          <table className="w-full table-fixed border-separate border-spacing-1.5">
            <thead>
              <tr>{['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => <th key={d} scope="col" className="pb-1 font-mono text-[10px] font-normal tracking-[0.15em] text-muted">{d.toUpperCase()}</th>)}</tr>
            </thead>
            <tbody>
              {monthGrid(shownMonth).map((week, i) => (
                <tr key={i}>
                  {week.map((date, j) => {
                    if (!date) return <td key={j} />;
                    const c = byDate.get(date);
                    const day = Number(date.slice(8));
                    if (!c) {
                      return <td key={j}><span className="grid aspect-square place-items-center rounded-xl text-[12px] text-muted" title="No show on this day">{day}</span></td>;
                    }
                    const d = describe(c);
                    const dim = !matches(c, filter);
                    return (
                      <td key={j}>
                        <Link
                          href={`/time-travel/${date}`}
                          aria-label={`${fmt(date)}, challenge #${c.number}: ${d.label}`}
                          className={`tt-day grid aspect-square place-items-center rounded-xl border no-underline transition ${dim ? 'border-transparent opacity-25' : 'border-line bg-panel-2 hover:border-muted'} ${c.status ? `tt-${c.status}` : ''}`}
                        >
                          <span className="text-[13px] font-semibold text-text">{day}</span>
                          <span className={`-mt-2 ${d.tone}`} aria-hidden="true">{c.status ? d.icon : <span className="block h-1 w-1 rounded-full bg-current" />}</span>
                        </Link>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="m-0 mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted">
            <span className="flex items-center gap-1 text-success"><Check size={12} aria-hidden="true" /> Solved</span>
            <span className="flex items-center gap-1 text-danger"><X size={12} aria-hidden="true" /> Missed</span>
            <span className="flex items-center gap-1 text-accent"><CircleDot size={12} aria-hidden="true" /> In progress</span>
            <span className="flex items-center gap-1"><span className="block h-1 w-1 rounded-full bg-current" aria-hidden="true" /> Not played</span>
          </p>
        </section>
      ) : filtered.length === 0 ? (
        <p className="text-[13px] text-muted">No days match this filter.</p>
      ) : (
        <ul className="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(210px,1fr))] gap-3 p-0">
          {filtered.map(c => {
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
      )}
    </div>
  );
}
