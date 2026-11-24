'use client';

import Link from 'next/link';
import { AudioLines, CalendarDays, ChartNoAxesCombined, Flame, Trophy } from 'lucide-react';
import { RailWeek } from '@/components/WeekStrip';
import { useStats } from '@/lib/player/StatsProvider';

/** Player snapshot next to the game: live streak, weekly rank, win rate and this week. */
export function RightRail() {
  const { stats } = useStats();
  const dash = '—';
  return (
    <aside className="right-rail" aria-label="Your snapshot">
      <div className="rail-card mini-stats">
        <div className="rail-title">YOUR SNAPSHOT <span aria-hidden="true">↗</span></div>
        <div className="mini-stat"><div className="mini-stat-icon purple" aria-hidden="true"><Flame size={17} /></div><div><strong>{stats ? `${stats.current_streak} ${stats.current_streak === 1 ? 'day' : 'days'}` : dash}</strong><span>Current streak</span></div></div>
        <div className="mini-stat"><div className="mini-stat-icon gold" aria-hidden="true"><Trophy size={17} /></div><div><strong>{stats?.week_rank ? `#${stats.week_rank}` : dash}</strong><span>{stats?.week_rank ? 'This week’s rank' : 'Score this week to rank'}</span></div></div>
        <div className="mini-stat"><div className="mini-stat-icon blue" aria-hidden="true"><ChartNoAxesCombined size={17} /></div><div><strong>{stats?.win_rate != null ? `${stats.win_rate}%` : dash}</strong><span>Win rate{stats?.played ? ` (${stats.played} played)` : ''}</span></div></div>
        <Link className="rail-link" href="/stats">View all statistics <span aria-hidden="true">→</span></Link>
      </div>
      <div className="rail-card week-card">
        <div className="rail-title">THIS WEEK <CalendarDays size={15} aria-hidden="true" /></div>
        <RailWeek week={stats?.week} />
        <p>{stats ? `${stats.week_points} ${stats.week_points === 1 ? 'point' : 'points'} this week. One new soundtrack every day.` : 'One new soundtrack every day. Keep your streak alive.'}</p>
      </div>
      <div className="quote-card">
        <div className="quote-mark" aria-hidden="true">“</div>
        <p>Some tunes don&apos;t just play. They take you back.</p>
        <span>THE CINERAAGAM FEELING</span>
        <div className="quote-decoration" aria-hidden="true"><AudioLines size={65} /></div>
      </div>
    </aside>
  );
}
