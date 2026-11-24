'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useStats } from '@/lib/player/StatsProvider';
import type { MyStats } from '@/lib/game/api';

function Tile({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="rounded-2xl border border-line bg-panel p-4">
      <div className="font-mono text-[10px] tracking-[0.2em] text-muted uppercase">{label}</div>
      <div className="mt-2 text-[30px] leading-none font-bold tracking-[-0.03em]">{value}</div>
      {note && <div className="mt-1.5 text-[11px] text-muted">{note}</div>}
    </div>
  );
}

const ROWS = [
  { key: '1', label: 'Clue 1', sub: 'Hard · 3 pts' },
  { key: '2', label: 'Clue 2', sub: 'Medium · 2 pts' },
  { key: '3', label: 'Clue 3', sub: 'Easy · 1 pt' },
  { key: 'missed', label: 'Missed', sub: '0 pts' },
] as const;

/**
 * "Solved on" distribution: one series (games) across four outcomes, so a
 * single-hue horizontal bar chart. Bars ≤ 20px, rounded only at the data end,
 * value at the tip in text colour, per-bar tooltip on hover/focus.
 */
function Distribution({ dist, played }: { dist: MyStats['distribution']; played: number }) {
  const [active, setActive] = useState<string | null>(null);
  const max = Math.max(1, ...ROWS.map(r => dist[r.key]));
  return (
    <figure className="m-0">
      <figcaption className="mb-4 font-mono text-[10px] tracking-[0.2em] text-muted uppercase">Solved on · daily games</figcaption>
      <ul className="m-0 grid list-none gap-3 p-0">
        {ROWS.map(r => {
          const value = dist[r.key];
          const pct = played ? Math.round((100 * value) / played) : 0;
          const width = value ? Math.max(2, (value / max) * 100) : 0;
          return (
            <li key={r.key} className="grid grid-cols-[92px_1fr] items-center gap-3">
              <span className="text-[12px] leading-tight">{r.label}<br /><span className="text-[10px] text-muted">{r.sub}</span></span>
              <div
                className="relative flex h-7 items-center outline-none"
                tabIndex={0}
                aria-label={`${r.label}: ${value} ${value === 1 ? 'game' : 'games'}, ${pct}% of games played`}
                onMouseEnter={() => setActive(r.key)}
                onMouseLeave={() => setActive(a => (a === r.key ? null : a))}
                onFocus={() => setActive(r.key)}
                onBlur={() => setActive(a => (a === r.key ? null : a))}
              >
                <span className="dist-bar h-5 rounded-r-[4px]" style={{ width: `calc(${width}% - 40px)` }} />
                <span className="ml-2 font-mono text-[12px] text-text">{value}</span>
                {active === r.key && (
                  <span role="tooltip" className="pointer-events-none absolute -top-9 left-0 z-10 rounded-lg border border-line bg-panel-2 px-2.5 py-1.5 text-[11px] whitespace-nowrap shadow-xl">
                    {r.label}: <strong>{value}</strong> {value === 1 ? 'game' : 'games'} · {pct}%
                  </span>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </figure>
  );
}

export function StatsView() {
  const { stats } = useStats();
  if (!stats) return <div className="mt-8 h-72 max-w-[900px] animate-pulse rounded-2xl border border-line bg-panel" aria-busy="true" />;

  return (
    <div className="mt-8 grid max-w-[900px] gap-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <Tile label="Current streak" value={`${stats.current_streak}`} note={stats.current_streak === 1 ? 'day in a row' : 'days in a row'} />
        <Tile label="Best streak" value={`${stats.best_streak}`} note="your longest run" />
        <Tile label="Win rate" value={stats.win_rate != null ? `${stats.win_rate}%` : '—'} note={`${stats.won} of ${stats.played} solved`} />
        <Tile label="Total points" value={`${stats.total_points}`} note="all-time, daily games" />
        <Tile label="This week" value={`${stats.week_points}`} note={stats.week_rank ? `points · rank #${stats.week_rank}` : 'points'} />
        <Tile label="Played" value={`${stats.played}`} note="daily games finished" />
      </div>

      <section className="rounded-2xl border border-line bg-panel p-5 md:p-6">
        {stats.played === 0 ? (
          <p className="m-0 text-[13px] text-muted">Your “solved on” chart appears after your first daily game. <Link href="/" className="text-text">Play today ↗</Link></p>
        ) : (
          <Distribution dist={stats.distribution} played={stats.played} />
        )}
      </section>
      <p className="m-0 text-[11px] text-muted">Only official daily games count. Time Travel games are just for fun and appear in My History.</p>
    </div>
  );
}
