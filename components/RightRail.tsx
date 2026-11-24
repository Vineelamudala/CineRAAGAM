import Link from 'next/link';
import { AudioLines, CalendarDays, ChartNoAxesCombined, Check, Flame, Trophy } from 'lucide-react';
import { DEMO_STATS } from '@/lib/demo';

const WEEK = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

/** Player snapshot. Values are demo data until Phase 4 (statistics). */
export function RightRail() {
  return (
    <aside className="right-rail" aria-label="Your snapshot">
      <div className="rail-card mini-stats">
        <div className="rail-title">YOUR SNAPSHOT <span aria-hidden="true">↗</span></div>
        <div className="mini-stat"><div className="mini-stat-icon purple" aria-hidden="true"><Flame size={17} /></div><div><strong>{String(DEMO_STATS.streak).padStart(2, '0')} days</strong><span>Current streak</span></div></div>
        <div className="mini-stat"><div className="mini-stat-icon gold" aria-hidden="true"><Trophy size={17} /></div><div><strong>#{DEMO_STATS.rank}</strong><span>Leaderboard rank</span></div></div>
        <div className="mini-stat"><div className="mini-stat-icon blue" aria-hidden="true"><ChartNoAxesCombined size={17} /></div><div><strong>{DEMO_STATS.winRate}%</strong><span>Win rate</span></div></div>
        <Link className="rail-link" href="/stats">View all statistics <span aria-hidden="true">→</span></Link>
      </div>
      <div className="rail-card week-card">
        <div className="rail-title">THE WEEK AHEAD <CalendarDays size={15} aria-hidden="true" /></div>
        <div className="week-days" aria-hidden="true">
          {WEEK.map((d, i) => <div key={i} className={i === 2 ? 'today' : ''}><span>{d}</span><i>{i < 2 ? <Check size={12} /> : i === 2 ? '•' : '·'}</i></div>)}
        </div>
        <p>One new soundtrack every day. Keep your streak alive.</p>
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
