'use client';

import { useState } from 'react';
import { RotateCcw, Share2, Trophy } from 'lucide-react';
import { gamePoints, type GameState } from '@/lib/game/state';
import { buildShareText } from '@/lib/share';

type Props = {
  state: GameState;
  challengeNumber: number;
  reveal: { title: string; cast: string[] };
  onReset: () => void;
};

export function RevealPanel({ state, challengeNumber, reveal, onReset }: Props) {
  const [shareStatus, setShareStatus] = useState('');
  const won = state.status === 'won';
  const points = gamePoints(state);

  async function share() {
    const text = buildShareText({ challengeNumber, results: state.results, points, url: window.location.origin });
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
      <div className="reveal-eyebrow">{won ? 'YOU GOT IT!' : 'TODAY’S MOVIE REVEAL'}</div>
      <h2>{reveal.title}</h2>
      <p className="reveal-cast">Starring {reveal.cast.join(' · ')}</p>
      <div className="result-score">
        <div><strong>{points}</strong><span>{points === 1 ? 'POINT' : 'POINTS'}</span></div>
        <div><strong>{state.results.length}</strong><span>CLUES USED</span></div>
        <div><strong>{won ? 'SOLVED' : 'MISSED'}</strong><span>RESULT</span></div>
      </div>
      <button className="share-button" onClick={share}><Share2 size={16} aria-hidden="true" /> SHARE RESULT</button>
      <p className="feedback-message" role="status" aria-live="polite">{shareStatus}</p>
      <button className="text-button" onClick={onReset}>Replay demo <RotateCcw size={13} aria-hidden="true" /></button>
    </div>
  );
}
