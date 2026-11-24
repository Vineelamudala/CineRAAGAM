import type { Metadata } from 'next';
import { StatsView } from '@/components/StatsView';

export const metadata: Metadata = { title: 'Statistics' };

export default function StatsPage() {
  return (
    <section className="placeholder-page">
      <div className="eyebrow"><span className="eyebrow-line" aria-hidden="true" /> CINERAAGAM</div>
      <h1>Your journey in music</h1>
      <p className="welcome-copy">Every streak, every movie recognised.</p>
      <StatsView />
    </section>
  );
}
