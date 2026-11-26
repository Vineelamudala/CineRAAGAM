'use client';

import Link from 'next/link';
import { GuessDistribution } from '@/components/GuessDistribution';
import { useStats } from '@/lib/player/StatsProvider';

function Tile({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="rounded-2xl border border-line bg-panel p-4">
      <div className="font-mono text-[10px] tracking-[0.2em] text-muted uppercase">{label}</div>
      <div className="mt-2 text-[30px] leading-none font-bold tracking-[-0.03em]">{value}</div>
      {note && <div className="mt-1.5 text-[11px] text-muted">{note}</div>}
    </div>
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
        <h2 className="m-0 mb-4 font-mono text-[10px] font-normal tracking-[0.2em] text-muted uppercase">Guess distribution · daily games</h2>
        {stats.played === 0 ? (
          <p className="m-0 text-[13px] text-muted">Your guess distribution appears after your first daily game. <Link href="/" className="text-text">Play today ↗</Link></p>
        ) : (
          <GuessDistribution dist={stats.distribution} played={stats.played} />
        )}
      </section>
      <p className="m-0 text-[11px] text-muted">Only official daily games count. Time Travel games are just for fun and appear in My History.</p>
    </div>
  );
}
