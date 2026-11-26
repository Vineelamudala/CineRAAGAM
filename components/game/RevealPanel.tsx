'use client';

import { useState } from 'react';
import { Check, Share2, SkipForward, Trophy, X } from 'lucide-react';
import type { ChallengeState } from '@/lib/game/api';
import { useStats } from '@/lib/player/StatsProvider';
import { buildShareText } from '@/lib/share';

type Props = { state: ChallengeState };

export function RevealPanel({ state }: Props) {
  const [shareStatus, setShareStatus] = useState('');
  const { stats } = useStats();
  const play = state.play!;
  const reveal = state.reveal!;
  const won = play.status === 'won';
  const timeTravel = play.mode === 'time_travel';
  const points = play.points;

  async function share() {
    const text = buildShareText({
      challengeNumber: state.number,
      results: state.guesses.map(g => g.result),
      points,
      streak: play.mode === 'daily' && won ? stats?.current_streak : undefined,
      url: window.location.origin,
    });
    try {
      if (navigator.share) {
        await navigator.share({ title: 'Cineraagam', text });
        return;
      }
      await navigator.clipboard.writeText(text);
      setShareStatus('Result copied — paste it anywhere.');
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return; // user closed the share sheet
      setShareStatus('Could not share automatically. Please copy your result manually.');
    }
  }

  return (
    <div className="reveal-panel">
      <div className="reveal-icon" aria-hidden="true"><Trophy size={27} /></div>
      <div className="reveal-eyebrow">{won ? 'YOU GOT IT!' : timeTravel ? 'THE MOVIE WAS' : 'TODAY’S MOVIE REVEAL'}</div>
      <h2>{reveal.title}{reveal.year ? <span className="sr-only-live"> ({reveal.year})</span> : null}</h2>
      {reveal.cast.length > 0 && <p className="reveal-cast">Starring {reveal.cast.join(' · ')}</p>}

      <div className="result-score">
        {!timeTravel && <div><strong>{points}</strong><span>{points === 1 ? 'POINT' : 'POINTS'}</span></div>}
        <div><strong>{state.guesses.length}</strong><span>CLUES USED</span></div>
        <div><strong>{won ? 'SOLVED' : 'MISSED'}</strong><span>RESULT</span></div>
      </div>
      {timeTravel && <p className="m-0 -mt-2 mb-4 text-[11px] text-muted">Time Travel · just for fun, no points</p>}

      <ol className="m-0 mb-5 flex list-none flex-wrap justify-center gap-x-4 gap-y-1 p-0 text-[11px] text-muted" aria-label="Your guesses">
        {state.guesses.map(g => (
          <li key={g.clue} className="flex items-center gap-1.5">
            {g.result === 'correct' ? <Check size={13} className="text-success" aria-label="correct" />
              : g.result === 'skipped' ? <SkipForward size={13} aria-label="skipped" />
              : <X size={13} className="text-danger" aria-label="wrong" />}
            <span>Clue {g.clue}: {g.result === 'skipped' ? 'skipped' : g.movie_title}</span>
          </li>
        ))}
      </ol>

      <button className="share-button" onClick={share}><Share2 size={16} aria-hidden="true" /> SHARE RESULT</button>
      <p className="feedback-message" role="status" aria-live="polite">{shareStatus}</p>
      <p className="m-0 mt-3 text-[10px] text-muted">Tap any clue above to listen again.</p>
    </div>
  );
}
