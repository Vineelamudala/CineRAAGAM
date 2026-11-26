'use client';

import { useState } from 'react';
import type { MyStats } from '@/lib/game/api';

const ROWS = [
  { key: '1', label: '1', sub: 'Hard · 3 pts' },
  { key: '2', label: '2', sub: 'Medium · 2 pts' },
  { key: '3', label: '3', sub: 'Easy · 1 pt' },
  { key: 'missed', label: '✗', sub: 'Missed · 0 pts' },
] as const;

/**
 * "Guess distribution": which clue the player solved on (1 / 2 / 3) or missed.
 * One series → one hue; bars ≤ 20px with a rounded data end; value + share at
 * the tip in text colour; per-bar tooltip on hover/focus. `highlight` marks
 * today's result.
 */
export function GuessDistribution({ dist, played, highlight, compact = false }: {
  dist: MyStats['distribution'];
  played: number;
  highlight?: '1' | '2' | '3' | 'missed' | null;
  compact?: boolean;
}) {
  const [active, setActive] = useState<string | null>(null);
  const max = Math.max(1, ...ROWS.map(r => dist[r.key]));
  return (
    <ul className="m-0 grid list-none gap-2.5 p-0" aria-label="Guess distribution">
      {ROWS.map(r => {
        const value = dist[r.key];
        const pct = played ? Math.round((100 * value) / played) : 0;
        const width = value ? Math.max(3, (value / max) * 100) : 0;
        const isToday = highlight === r.key;
        return (
          <li key={r.key} className={`grid items-center gap-3 ${compact ? 'grid-cols-[22px_1fr]' : 'grid-cols-[110px_1fr]'}`}>
            <span className="text-[14px] font-semibold leading-tight">
              {r.label}
              {!compact && <span className="block text-[10px] font-normal text-muted">{r.sub}</span>}
            </span>
            <div
              className="relative flex h-7 items-center outline-none"
              tabIndex={0}
              aria-label={`${r.key === 'missed' ? 'Missed' : `Solved on clue ${r.key}`}: ${value} ${value === 1 ? 'game' : 'games'}, ${pct}%${isToday ? ' (today)' : ''}`}
              onMouseEnter={() => setActive(r.key)}
              onMouseLeave={() => setActive(a => (a === r.key ? null : a))}
              onFocus={() => setActive(r.key)}
              onBlur={() => setActive(a => (a === r.key ? null : a))}
            >
              <span className={`dist-bar h-5 rounded-r-[4px] ${isToday ? (r.key === 'missed' ? 'dist-bar-today-miss' : 'dist-bar-today') : ''}`} style={{ width: `calc(${width}% - 84px)` }} />
              <span className="ml-2 font-mono text-[12px] whitespace-nowrap text-text">{value} <span className="text-muted">· {pct}%</span></span>
              {active === r.key && (
                <span role="tooltip" className="pointer-events-none absolute -top-9 left-0 z-10 rounded-lg border border-line bg-panel-2 px-2.5 py-1.5 text-[11px] whitespace-nowrap shadow-xl">
                  {r.sub}: <strong>{value}</strong> {value === 1 ? 'game' : 'games'} · {pct}%
                </span>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
