'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Trophy } from 'lucide-react';
import { getLeaderboard, type Leaderboard, type LeaderboardPeriod } from '@/lib/game/api';
import { usePlayer } from '@/lib/player/PlayerProvider';
import { getBrowserSupabase } from '@/lib/supabase/browser';

const TABS: { id: LeaderboardPeriod; label: string; hint: string }[] = [
  { id: 'week', label: 'This week', hint: 'Since Monday 00:00 IST' },
  { id: 'month', label: 'This month', hint: 'Since the 1st, 00:00 IST' },
  { id: 'all', label: 'All time', hint: 'Every daily challenge' },
];

const fmt = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' });

export function LeaderboardView() {
  const player = usePlayer();
  const [period, setPeriod] = useState<LeaderboardPeriod>('week');
  const [data, setData] = useState<Partial<Record<LeaderboardPeriod, Leaderboard>>>({});
  const [failed, setFailed] = useState(false);
  const board = data[period];

  useEffect(() => {
    if (player.status !== 'ready') return;
    let cancelled = false;
    getLeaderboard(getBrowserSupabase()!, period)
      .then(b => { if (!cancelled) setData(d => ({ ...d, [period]: b })); })
      .catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; };
  }, [player.status, period]);

  const meVisible = board?.rows.some(r => r.is_me);

  return (
    <div className="mt-8 max-w-[860px]">
      <div role="tablist" aria-label="Leaderboard period" className="mb-5 inline-flex gap-1 rounded-xl border border-line bg-panel p-1">
        {TABS.map(t => (
          <button
            key={t.id}
            role="tab"
            id={`tab-${t.id}`}
            aria-selected={period === t.id}
            aria-controls="leaderboard-panel"
            onClick={() => setPeriod(t.id)}
            className={`cursor-pointer rounded-lg border-0 px-4 py-2 text-[12px] font-semibold ${period === t.id ? 'bg-panel-2 text-text' : 'bg-transparent text-muted hover:text-text'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <section id="leaderboard-panel" role="tabpanel" aria-labelledby={`tab-${period}`} className="rounded-2xl border border-line bg-panel p-4 md:p-6">
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
          <p className="m-0 text-[12px] text-muted">
            {TABS.find(t => t.id === period)!.hint}
            {board?.from ? ` · ${fmt(board.from)} – ${fmt(board.to)}` : ''}
          </p>
          {board && <p className="m-0 text-[12px] text-muted">{board.total} ranked {board.total === 1 ? 'player' : 'players'}</p>}
        </div>

        {failed ? <p className="m-0 text-[12px] text-danger">Couldn’t load the leaderboard. Please refresh.</p>
          : !board ? <div className="h-64 animate-pulse rounded-xl bg-panel-2" aria-busy="true" />
          : board.rows.length === 0 ? (
            <div className="py-10 text-center">
              <Trophy className="mx-auto mb-3 text-muted" aria-hidden="true" />
              <p className="m-0 text-[13px]">No one has scored {period === 'all' ? 'yet' : `this ${period}`}. Solve today’s movie to take the top spot.</p>
            </div>
          ) : (
            <table className="w-full border-collapse text-[13px]">
              <caption className="sr-only-live">Leaderboard, {TABS.find(t => t.id === period)!.label.toLowerCase()}</caption>
              <thead>
                <tr className="text-left font-mono text-[10px] tracking-[0.18em] text-muted">
                  <th scope="col" className="w-14 pb-3 font-normal">RANK</th>
                  <th scope="col" className="pb-3 font-normal">PLAYER</th>
                  <th scope="col" className="pb-3 text-right font-normal">POINTS</th>
                  <th scope="col" className="hidden pb-3 text-right font-normal sm:table-cell">DAYS SOLVED</th>
                </tr>
              </thead>
              <tbody>
                {board.rows.map(r => (
                  <tr key={`${r.rank}-${r.name}`} className={`border-t border-line ${r.is_me ? 'bg-panel-2' : ''}`} aria-current={r.is_me ? 'true' : undefined}>
                    <td className="py-3">
                      <span className={`inline-grid h-7 w-7 place-items-center rounded-full font-mono text-[12px] ${r.rank <= 3 ? 'rank-medal' : 'text-muted'}`}>{r.rank}</span>
                    </td>
                    <td className="py-3 font-semibold">{r.name}{r.is_me && <span className="ml-2 text-[11px] font-normal text-muted">(you)</span>}</td>
                    <td className="py-3 text-right font-mono text-[14px]">{r.points}</td>
                    <td className="hidden py-3 text-right font-mono text-muted sm:table-cell">{r.solved}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

        {board && !meVisible && (
          <p className="m-0 mt-4 rounded-lg border border-line bg-panel-2 px-4 py-3 text-[12px]">
            {board.me
              ? <>You’re <strong>#{board.me.rank}</strong> with {board.me.points} {board.me.points === 1 ? 'point' : 'points'} ({board.me.solved} {board.me.solved === 1 ? 'day' : 'days'} solved).</>
              : !player.displayName
                ? <>Choose a display name (profile icon, top right) and solve a daily challenge to appear here.</>
                : <>Solve a daily challenge {period === 'all' ? '' : `this ${period} `}to appear here. <Link href="/" className="text-text">Play today ↗</Link></>}
          </p>
        )}
      </section>

      <p className="mt-4 text-[11px] leading-relaxed text-muted">
        How ranking works: points from official daily challenges (3 for clue 1, 2 for clue 2, 1 for clue 3). Ties go to the player
        with more days solved, then to whoever reached that total first. Time Travel games never count.
      </p>
    </div>
  );
}
