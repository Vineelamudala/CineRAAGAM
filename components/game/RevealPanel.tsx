'use client';

import { useState } from 'react';
import { ChartNoAxesColumn, Check, MessageCircle, Share2, SkipForward, Trophy, X } from 'lucide-react';
import type { ChallengeState } from '@/lib/game/api';
import { useStats } from '@/lib/player/StatsProvider';
import { buildShareText, shareLinks } from '@/lib/share';

type Props = { state: ChallengeState };

export function RevealPanel({ state }: Props) {
  const [shareStatus, setShareStatus] = useState('');
  const { stats, openStats } = useStats();
  const play = state.play!;
  const reveal = state.reveal!;
  const won = play.status === 'won';
  const timeTravel = play.mode === 'time_travel';
  const points = play.points;

  const shareText = () => buildShareText({
    challengeNumber: state.number,
    results: state.guesses.map(g => g.result),
    points,
    streak: play.mode === 'daily' && won ? stats?.current_streak : undefined,
    timeTravel,
    url: window.location.origin,
  });

  function openSocial(app: 'x' | 'whatsapp' | 'facebook') {
    const url = shareLinks(shareText(), window.location.origin)[app];
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  async function share() {
    const text = shareText();
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

      <div className="flex flex-wrap items-center justify-center gap-2">
        <button className="share-button" onClick={share}><Share2 size={16} aria-hidden="true" /> SHARE RESULT</button>
        {play.mode === 'daily' && (
          <button className="stats-button" onClick={() => openStats(won ? (String(play.solved_on_clue) as '1' | '2' | '3') : 'missed')}>
            <ChartNoAxesColumn size={16} aria-hidden="true" /> STATISTICS
          </button>
        )}
      </div>
      <div className="mt-4 flex items-center justify-center gap-3" role="group" aria-label="Share on social media">
        <button className="social-button social-x" onClick={() => openSocial('x')} aria-label="Share on X (Twitter)" title="Share on X (Twitter)">
          <span aria-hidden="true" className="text-[18px] font-bold leading-none">𝕏</span>
        </button>
        <button className="social-button social-whatsapp" onClick={() => openSocial('whatsapp')} aria-label="Share on WhatsApp" title="Share on WhatsApp">
          <MessageCircle size={22} aria-hidden="true" />
        </button>
        <button className="social-button social-facebook" onClick={() => openSocial('facebook')} aria-label="Share on Facebook" title="Share on Facebook">
          <span aria-hidden="true" className="font-sans text-[24px] font-extrabold leading-none">f</span>
        </button>
      </div>
      <p className="feedback-message" role="status" aria-live="polite">{shareStatus}</p>
      <p className="m-0 mt-3 text-[10px] text-muted">Tap any clue above to listen again.</p>
    </div>
  );
}
