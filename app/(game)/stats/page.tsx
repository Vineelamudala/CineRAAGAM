import type { Metadata } from 'next';
import { StatsView } from '@/components/StatsView';

export const metadata: Metadata = { title: 'Your Stats' };

export default function StatsPage() {
  return (
    <section className="placeholder-page">
      <div className="eyebrow"><span className="eyebrow-line" aria-hidden="true" /> DAILY CHALLENGE PERFORMANCE</div>
      <h1>Your stats</h1>
      <p className="welcome-copy">Every game, streak, point and movie — all in one place.</p>
      <StatsView />
    </section>
  );
}
