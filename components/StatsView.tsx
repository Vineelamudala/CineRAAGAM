'use client';

import Link from 'next/link';
import { Flame, Gamepad2, Medal, Percent, Star, Target, Trophy } from 'lucide-react';
import { GuessDistribution } from '@/components/GuessDistribution';
import { HistoryView } from '@/components/HistoryView';
import { avgCluesToSolve, avgPoints } from '@/lib/game/statsSummary';
import { useStats } from '@/lib/player/StatsProvider';

function Tile({ icon, value, label }: { icon: React.ReactNode; value: React.ReactNode; label: string }) {
  return (
    <div className="grid justify-items-center gap-2 rounded-2xl border border-line bg-panel px-2 py-5 text-center">
      <span className="text-gold" aria-hidden="true">{icon}</span>
      <span className="text-[32px] leading-none font-bold tracking-[-0.03em]">{value}</span>
      <span className="font-mono text-[10px] tracking-[0.18em] text-muted uppercase">{label}</span>
    </div>
  );
}

/** Statistics page: every stat in one place — totals, streaks, points, distribution and daily history. */
export function StatsView() {
  const { stats } = useStats();
  if (!stats) return <div className="mt-8 h-72 max-w-[900px] animate-pulse rounded-2xl border border-line bg-panel" aria-busy="true" />;

  const avgClues = avgCluesToSolve(stats.distribution);
  const avgPts = avgPoints(stats.total_points, stats.played);

  return (
    <div className="mt-8 grid max-w-[900px] gap-8">
      <section aria-label="Totals" className="grid gap-3">
        <div className="grid grid-cols-3 gap-3">
          <Tile icon={<Gamepad2 size={20} />} value={stats.played} label="Games played" />
          <Tile icon={<Trophy size={20} />} value={stats.won} label="Wins" />
          <Tile icon={<Percent size={20} />} value={stats.win_rate != null ? `${stats.win_rate}%` : '—'} label="Win rate" />
          <Tile icon={<Flame size={20} />} value={<>{stats.current_streak} <span aria-hidden="true">🔥</span></>} label="Current streak" />
          <Tile icon={<Medal size={20} />} value={stats.best_streak} label="Longest streak" />
          <Tile icon={<Target size={20} />} value={avgClues ?? '—'} label="Avg clues to solve" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Tile icon={<Star size={20} />} value={stats.total_points} label="Total points" />
          <Tile icon={<Star size={20} />} value={avgPts ?? '—'} label="Average points" />
        </div>
        <p className="m-0 text-center text-[11px] text-muted">
          Points: clue 1 (hard) = 3 · clue 2 = 2 · clue 3 = 1 · missed = 0. This week: {stats.week_points} {stats.week_points === 1 ? 'point' : 'points'}{stats.week_rank ? ` · rank #${stats.week_rank}` : ''}.
        </p>
      </section>

      <section className="rounded-2xl border border-line bg-panel p-5 md:p-6">
        <h2 className="font-display m-0 mb-4 text-[22px]">Guess distribution</h2>
        {stats.played === 0 ? (
          <p className="m-0 text-[13px] text-muted">Appears after your first daily game. <Link href="/" className="text-text">Play today ↗</Link></p>
        ) : (
          <GuessDistribution dist={stats.distribution} played={stats.played} />
        )}
      </section>

      <section id="history">
        <h2 className="font-display m-0 mb-4 text-[22px]">Daily history</h2>
        <HistoryView />
        <p className="m-0 mt-3 text-[11px] text-muted">Only official daily games count towards stats, points and streaks. Time Travel games are shown here just for fun.</p>
      </section>
    </div>
  );
}
