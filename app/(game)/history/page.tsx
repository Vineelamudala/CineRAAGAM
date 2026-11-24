import type { Metadata } from 'next';
import { HistoryView } from '@/components/HistoryView';

export const metadata: Metadata = { title: 'My History' };

export default function HistoryPage() {
  return (
    <section className="placeholder-page">
      <div className="eyebrow"><span className="eyebrow-line" aria-hidden="true" /> CINERAAGAM</div>
      <h1>Your game history</h1>
      <p className="welcome-copy">
        Every daily challenge since you started: the movie, how you did and the points you earned.
        Missed days can still be played in Time Travel.
      </p>
      <HistoryView />
    </section>
  );
}
