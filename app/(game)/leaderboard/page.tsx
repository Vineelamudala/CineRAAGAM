import type { Metadata } from 'next';
import { LeaderboardView } from '@/components/LeaderboardView';

export const metadata: Metadata = { title: 'Leaderboard' };

export default function LeaderboardPage() {
  return (
    <section className="placeholder-page">
      <div className="eyebrow"><span className="eyebrow-line" aria-hidden="true" /> CINERAAGAM</div>
      <h1>The leaderboard</h1>
      <p className="welcome-copy">Weekly, monthly and all-time rankings from the official daily challenges.</p>
      <LeaderboardView />
    </section>
  );
}
