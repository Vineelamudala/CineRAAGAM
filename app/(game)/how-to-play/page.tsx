import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'How to Play' };

const RULES: [string, string, string][] = [
  ['01', 'Listen to the hard clue', 'A short BGM or song interlude (5–20 seconds) from a Telugu movie. Replay it as often as you like.'],
  ['02', 'Pick your guess', 'Start typing a movie name and choose it from the suggestions. You get one guess per clue.'],
  ['03', 'Wrong or skip? Easier clue', 'A wrong guess or a skip unlocks the next, easier clue: Hard, then Medium, then Easy.'],
  ['04', 'Earn points', 'Solve on clue 1 for 3 points, clue 2 for 2 points, clue 3 for 1 point. Not solved: 0 points.'],
  ['05', 'Keep your streak', 'Your streak counts consecutive days on which you solved the daily movie. A new challenge starts at midnight IST — finish before then, or an unfinished game moves to Time Travel.'],
  ['06', 'Reveal, share, time travel', 'After the game the movie and cast are revealed. Share your result spoiler-free, or replay past days in Time Travel (just for fun — no points).'],
];

export default function HowToPlayPage() {
  return (
    <section className="placeholder-page">
      <div className="eyebrow"><span className="eyebrow-line" aria-hidden="true" /> CINERAAGAM</div>
      <h1>How to play</h1>
      <p className="welcome-copy">Every day, 3 BGMs / song interludes from one Telugu movie are played one by one, from hard to easy. Identify the movie!</p>
      <ol className="rules-grid list-none p-0">
        {RULES.map(([n, title, text]) => (
          <li className="rule-card" key={n}>
            <span>{n}</span>
            <h2 className="font-display text-[15px] font-bold mt-[18px] mb-2">{title}</h2>
            <p>{text}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
