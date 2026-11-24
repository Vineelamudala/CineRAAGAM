import type { Metadata } from 'next';
import { TimeTravelList } from '@/components/TimeTravelList';

export const metadata: Metadata = { title: 'Time Travel' };

export default function TimeTravelPage() {
  return (
    <section className="placeholder-page">
      <div className="eyebrow"><span className="eyebrow-line" aria-hidden="true" /> CINERAAGAM</div>
      <h1>The soundtrack archive</h1>
      <p className="welcome-copy">
        Replay any previous daily challenge. Time Travel games show the points you would have earned,
        but never count towards leaderboards or streaks.
      </p>
      <TimeTravelList />
    </section>
  );
}
