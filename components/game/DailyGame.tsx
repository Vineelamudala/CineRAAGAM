'use client';

import { useReducer, useState } from 'react';
import { Check } from 'lucide-react';
import { CLUES, clueInfo, type ClueNumber } from '@/lib/game/rules';
import { gameReducer, initialGameState } from '@/lib/game/state';
import type { MovieOption } from '@/lib/search/movies';
import { AudioPanel } from './AudioPanel';
import { GuessForm } from './GuessForm';
import { RevealPanel } from './RevealPanel';

type Props = {
  challengeNumber: number;
  title: string;
  clipDurations: readonly number[];
  catalog: MovieOption[];
  /**
   * Phase 0 demo only: the guess is checked locally. From Phase 2 guesses are
   * validated by the server and the answer never reaches the browser.
   */
  demoAnswerId: string;
  reveal: { title: string; cast: string[] };
};

export function DailyGame({ challengeNumber, title, clipDurations, catalog, demoAnswerId, reveal }: Props) {
  const [state, dispatch] = useReducer(gameReducer, initialGameState);
  const [playing, setPlaying] = useState(false);
  const [message, setMessage] = useState('');
  const finished = state.status !== 'playing';
  const current = clueInfo(state.clue);

  function nextClueText(prefix: string) {
    if (state.clue >= 3) return 'Challenge complete. Here is today’s movie reveal.';
    const next = clueInfo((state.clue + 1) as ClueNumber);
    return `${prefix} Clue ${next.number} (${next.difficulty} · ${next.points} ${next.points === 1 ? 'point' : 'points'}) is ready.`;
  }

  function handleGuess(movie: MovieOption) {
    setPlaying(false);
    const correct = movie.id === demoAnswerId;
    if (correct) setMessage('That’s correct! You recognised the movie.');
    else setMessage(nextClueText('Not quite.'));
    dispatch({ type: 'guess', clue: state.clue, correct });
  }

  function handleSkip() {
    setPlaying(false);
    setMessage(nextClueText('Clue skipped.'));
    dispatch({ type: 'skip', clue: state.clue });
  }

  function reset() {
    setPlaying(false);
    setMessage('');
    dispatch({ type: 'reset' });
  }

  return (
    <section className="game-card" aria-labelledby="challenge-title">
      <div className="game-card-head">
        <div>
          <div className="challenge-label">TODAY’S CHALLENGE <span>•</span> #{String(challengeNumber).padStart(3, '0')}</div>
          <h2 id="challenge-title">{title}</h2>
        </div>
        {!finished && (
          <div className="difficulty-wrap clue-badge">
            <span>CLUE {current.number}</span>
            <strong>{current.difficulty} · {current.points} {current.points === 1 ? 'pt' : 'pts'}</strong>
          </div>
        )}
      </div>

      <ol className="clip-progress" aria-label="Clue progress">
        {CLUES.map(({ number, difficulty }) => {
          const passed = number < state.clue || (finished && number === state.clue && state.status === 'won');
          const isCurrent = number === state.clue && !passed;
          return (
            <li key={number} className={`clip-step ${isCurrent ? 'current' : passed ? 'passed' : ''}`} aria-current={isCurrent ? 'step' : undefined}>
              <span className="step-number">{passed ? <Check size={13} aria-label="done" /> : `0${number}`}</span>
              <span className="step-title">CLUE {number}<span className="sr-only-live"> ({difficulty})</span></span>
              <span className="step-line" aria-hidden="true" />
            </li>
          );
        })}
      </ol>

      {!finished ? (
        <>
          <AudioPanel
            clue={state.clue}
            durationSec={clipDurations[state.clue - 1]}
            playing={playing}
            onToggle={() => setPlaying(p => !p)}
            onReplay={() => setPlaying(true)}
          />
          <GuessForm key={state.clue} catalog={catalog} message={message} onMessage={setMessage} onGuess={handleGuess} onSkip={handleSkip} />
        </>
      ) : (
        <RevealPanel state={state} challengeNumber={challengeNumber} reveal={reveal} onReset={reset} />
      )}

      <div className="game-footnote">
        <span><span className="lock-dot" aria-hidden="true" /> Your answer stays private until you share.</span>
        <span>POWERED BY YOUR LOVE FOR TELUGU CINEMA</span>
      </div>
    </section>
  );
}
