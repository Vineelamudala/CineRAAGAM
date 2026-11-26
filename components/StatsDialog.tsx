'use client';

import Link from 'next/link';
import { Clock3 } from 'lucide-react';
import { GuessDistribution } from '@/components/GuessDistribution';
import { Dialog } from '@/components/ui/Dialog';
import { useNow } from '@/lib/hooks/useNow';
import { useStats } from '@/lib/player/StatsProvider';
import { formatCountdown, msUntilNextIstMidnight } from '@/lib/time/ist';

function Tile({ value, label, tone }: { value: string; label: string; tone: string }) {
  return (
    <div className="grid justify-items-center gap-1.5 text-center">
      <span className={`stat-tile grid h-14 w-14 place-items-center rounded-xl text-[22px] font-bold ${tone}`}>{value}</span>
      <span className="text-[12px] text-muted">{label}</span>
    </div>
  );
}

/** Wordle-style statistics popup: shown after today's game and from the top bar. */
export function StatsDialog() {
  const { stats, dialog, closeStats } = useStats();
  const now = useNow();
  if (!dialog.open) return null;

  return (
    <Dialog title="Statistics" onClose={closeStats}>
      {!stats ? (
        <div className="h-64 animate-pulse rounded-xl bg-panel-2" aria-busy="true" />
      ) : (
        <div className="grid gap-6">
          <div className="grid grid-cols-4 gap-2">
            <Tile value={`${stats.played}`} label="Played" tone="stat-gold" />
            <Tile value={`${stats.won}`} label="Won" tone="stat-green" />
            <Tile value={stats.win_rate != null ? `${stats.win_rate}` : '0'} label="Win %" tone="stat-blue" />
            <Tile value={`${stats.total_points}`} label="Points" tone="stat-silver" />
          </div>

          <div className="grid grid-cols-2 gap-2 text-center">
            <div>
              <div className="text-[28px] font-bold">{stats.current_streak} <span aria-hidden="true">🔥</span></div>
              <div className="text-[12px] text-muted">Current streak</div>
            </div>
            <div>
              <div className="text-[28px] font-bold">{stats.best_streak} <span aria-hidden="true">💪</span></div>
              <div className="text-[12px] text-muted">Max streak</div>
            </div>
          </div>

          <section>
            <h3 className="m-0 mb-3 text-[18px] font-semibold">Guess distribution</h3>
            {stats.played === 0
              ? <p className="m-0 text-[12px] text-muted">Finish a daily game to see which clue you usually solve on.</p>
              : <GuessDistribution dist={stats.distribution} played={stats.played} highlight={dialog.highlight} compact />}
          </section>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4 text-[12px]">
            <span className="flex items-center gap-2 text-muted">
              <Clock3 size={14} aria-hidden="true" /> Next show in
              <strong className="font-mono text-[15px] text-text">{now === null ? '--:--:--' : formatCountdown(msUntilNextIstMidnight(now))}</strong>
            </span>
            <Link href="/stats" onClick={closeStats} className="text-muted hover:text-text">All statistics →</Link>
          </div>
        </div>
      )}
    </Dialog>
  );
}
