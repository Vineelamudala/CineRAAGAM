import { Check, X } from 'lucide-react';
import type { MyStats } from '@/lib/game/api';

const LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export type DayState = 'won' | 'lost' | 'today' | 'open' | 'none';

/** Monday–Sunday of the current IST week with my daily result for each day. */
export function weekStates(week: MyStats['week'] | undefined): DayState[] {
  if (!week) return Array(7).fill('none');
  return week.map(d =>
    d.status === 'won' ? 'won'
      : d.status === 'lost' ? 'lost'
      : d.is_today ? 'today'
      : d.has_challenge ? 'open' // a past day not solved (missed or unfinished)
      : 'none');
}

export function dayLabel(i: number, s: DayState): string {
  const what = { won: 'solved', lost: 'missed', today: 'today', open: 'not solved', none: 'no game' }[s];
  return `${NAMES[i]}: ${what}`;
}

/** Sidebar variant (round chips). */
export function SidebarWeek({ week }: { week: MyStats['week'] | undefined }) {
  const states = weekStates(week);
  return (
    <div className="streak-days" role="list" aria-label="This week">
      {states.map((s, i) => (
        <span key={i} role="listitem" aria-label={dayLabel(i, s)} className={s === 'won' ? 'done' : s === 'lost' ? 'missed' : s === 'today' ? 'today' : ''}>
          {s === 'won' ? <Check size={12} aria-hidden="true" /> : s === 'lost' ? <X size={11} aria-hidden="true" /> : LETTERS[i]}
        </span>
      ))}
    </div>
  );
}

/** Right-rail variant (letters above chips). */
export function RailWeek({ week }: { week: MyStats['week'] | undefined }) {
  const states = weekStates(week);
  return (
    <div className="week-days" role="list" aria-label="This week">
      {states.map((s, i) => (
        <div key={i} role="listitem" aria-label={dayLabel(i, s)} className={s === 'today' ? 'today' : s}>
          <span aria-hidden="true">{LETTERS[i]}</span>
          <i aria-hidden="true">{s === 'won' ? <Check size={12} /> : s === 'lost' ? <X size={11} /> : s === 'today' ? '•' : '·'}</i>
        </div>
      ))}
    </div>
  );
}
