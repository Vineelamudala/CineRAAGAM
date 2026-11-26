import type { Metadata } from 'next';
import { TimeTravelList } from '@/components/TimeTravelList';

export const metadata: Metadata = { title: 'Time Travel' };

export default function TimeTravelPage() {
  return (
    <section className="placeholder-page">
      <div className="eyebrow"><span className="eyebrow-line" aria-hidden="true" /> CINERAAGAM</div>
      <h1>The soundtrack archive</h1>
      <p className="welcome-copy">
        Replay any previous daily challenge. Time Travel is just for fun: it gives no points and
        never counts towards leaderboards or streaks.
      </p>
      <TimeTravelList />
    </section>
  );
}
