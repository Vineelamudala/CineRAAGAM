'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Check, Clapperboard, RefreshCw, SkipForward, X } from 'lucide-react';
import { AudioPanel } from './AudioPanel';
import { GuessForm } from './GuessForm';
import { RevealPanel } from './RevealPanel';
import { fetchCatalog, getChallenge, submitGuess, type ChallengeState } from '@/lib/game/api';
import { CLUES, clueInfo, type ClueNumber } from '@/lib/game/rules';
import { useNow } from '@/lib/hooks/useNow';
import { usePlayer } from '@/lib/player/PlayerProvider';
import type { MovieOption } from '@/lib/search/movies';
import { getBrowserSupabase } from '@/lib/supabase/browser';
import { istDateString } from '@/lib/time/ist';

type Load =
  | { kind: 'loading' }
  | { kind: 'none' }
  | { kind: 'error' }
  | { kind: 'ready'; state: ChallengeState };

const formatDate = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

/** The game card. `date` (YYYY-MM-DD) plays a past day (Time Travel); omitted = today. */
export function DailyGame({ date }: { date?: string }) {
  const player = usePlayer();
  const [load, setLoad] = useState<Load>({ kind: 'loading' });
  const [catalog, setCatalog] = useState<MovieOption[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [listenClue, setListenClue] = useState<ClueNumber | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const now = useNow();

  const ready = player.status === 'ready';

  useEffect(() => {
    if (!ready) return;
    const supabase = getBrowserSupabase()!;
    let cancelled = false;
    getChallenge(supabase, date)
      .then(state => { if (!cancelled) setLoad(state ? { kind: 'ready', state } : { kind: 'none' }); })
      .catch(() => { if (!cancelled) setLoad({ kind: 'error' }); });
    fetchCatalog(supabase)
      .then(list => { if (!cancelled) setCatalog(list); })
      .catch(() => { /* suggestions show "loading"; guessing reports the error */ });
    return () => { cancelled = true; };
  }, [ready, date, reloadKey]);

  const reload = useCallback(() => { setLoad({ kind: 'loading' }); setReloadKey(k => k + 1); }, []);

  async function send(clue: ClueNumber, movie: MovieOption | null) {
    if (load.kind !== 'ready' || busy) return;
    setBusy(true);
    setMessage('');
    try {
      const next = await submitGuess(getBrowserSupabase()!, load.state.date, clue, movie?.id ?? null);
      setLoad({ kind: 'ready', state: next });
      setListenClue(null);
      const p = next.play!;
      if (p.status === 'won') setMessage('That’s correct! You recognised the movie.');
      else if (p.status === 'lost') setMessage('');
      else {
        const nextClue = clueInfo(p.current_clue);
        const prefix = movie ? 'Not quite.' : 'Clue skipped.';
        setMessage(`${prefix} Clue ${nextClue.number} (${nextClue.difficulty} · ${nextClue.points} ${nextClue.points === 1 ? 'point' : 'points'}) is ready.`);
      }
    } catch {
      // Safe to retry: the server ignores duplicate submissions for a clue.
      setMessage('We couldn’t reach the server. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  }

  // ---- non-game states ----
  if (player.status === 'offline-config') {
    return <Notice title="Game server not configured" text="Set NEXT_PUBLIC_SUPABASE_URL and the publishable key (see README)." />;
  }
  if (player.status === 'error' || load.kind === 'error') {
    return <Notice title="We couldn’t load the challenge" text="Check your connection and try again." action={<button className="submit-button" onClick={() => (player.status === 'error' ? player.retry() : reload())}><RefreshCw size={14} className="mr-2" aria-hidden="true" /> TRY AGAIN</button>} />;
  }
  if (player.status === 'loading' || load.kind === 'loading') {
    return <section className="game-card min-h-[520px] animate-pulse" aria-busy="true" aria-label="Loading today’s challenge" />;
  }
  if (load.kind === 'none') {
    return date
      ? <Notice title="No show on that day" text="There was no published challenge for this date." action={<Link className="submit-button" href="/time-travel">BACK TO TIME TRAVEL</Link>} />
      : <Notice title="Tonight’s show is being prepared" text="Today’s challenge isn’t published yet. Check back soon — or replay a past day in Time Travel." action={<Link className="submit-button" href="/time-travel">TIME TRAVEL ↗</Link>} />;
  }

  // ---- the game ----
  const state = load.state;
  const play = state.play;
  const status = play?.status ?? 'playing';
  const finished = status !== 'playing';
  const currentClue: ClueNumber = play?.current_clue ?? 1;
  const current = clueInfo(currentClue);
  const resultFor = (n: number) => state.guesses.find(g => g.clue === n)?.result;
  const unlocked = (n: number) => !!state.clips[n - 1]?.path;
  const audioClue: ClueNumber | null = listenClue ?? (finished ? null : currentClue);
  const audioClip = audioClue ? state.clips[audioClue - 1] : null;
  const newDayAvailable = state.is_today && now !== null && istDateString(now) !== state.date;
  const timeTravel = !state.is_today;

  return (
    <section className="game-card" aria-labelledby="challenge-title">
      {newDayAvailable && (
        <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-line bg-panel-2 px-4 py-3 text-[12px]">
          <span>A new show has started. Today’s challenge is ready.</span>
          <button className="submit-button h-9!" onClick={() => { setListenClue(null); setMessage(''); reload(); }}>LOAD IT</button>
        </div>
      )}
      <div className="game-card-head">
        <div>
          <div className="challenge-label">
            {timeTravel ? 'TIME TRAVEL' : 'TODAY’S CHALLENGE'} <span>•</span> #{String(state.number).padStart(3, '0')}
            {timeTravel && <> <span>•</span> {formatDate(state.date).toUpperCase()}</>}
          </div>
          <h2 id="challenge-title">The mystery soundtrack</h2>
        </div>
        {!finished && (
          <div className="difficulty-wrap clue-badge">
            <span>CLUE {current.number}</span>
            <strong>{current.difficulty} · {current.points} {current.points === 1 ? 'pt' : 'pts'}</strong>
          </div>
        )}
      </div>

      {timeTravel && (
        <p className="m-0 mt-3 text-[11px] text-muted">Time Travel is just for fun: points shown here don’t count for leaderboards or streaks.</p>
      )}

      <ol className="clip-progress" aria-label="Clues">
        {CLUES.map(({ number, difficulty }) => {
          const result = resultFor(number);
          const isCurrent = !finished && number === currentClue;
          const canListen = unlocked(number);
          const listening = audioClue === number;
          const label = result === 'correct' ? <Check size={13} aria-label="solved" />
            : result === 'wrong' ? <X size={13} aria-label="wrong" />
            : result === 'skipped' ? <SkipForward size={12} aria-label="skipped" />
            : `0${number}`;
          return (
            <li key={number} className={`clip-step ${isCurrent ? 'current' : result ? 'passed' : ''} ${result && result !== 'correct' ? 'missed' : ''}`} aria-current={isCurrent ? 'step' : undefined}>
              {canListen && !listening ? (
                <button
                  type="button"
                  className="step-listen flex cursor-pointer items-center gap-[inherit] border-0 bg-transparent p-0 text-inherit"
                  onClick={() => setListenClue(number)}
                  aria-label={`Listen to clue ${number} (${difficulty}) again`}
                >
                  <span className="step-number">{label}</span>
                  <span className="step-title">CLUE {number}</span>
                </button>
              ) : (
                <>
                  <span className="step-number">{label}</span>
                  <span className="step-title">CLUE {number}<span className="sr-only-live"> ({difficulty}){listening ? ', playing' : ''}</span></span>
                </>
              )}
              <span className="step-line" aria-hidden="true" />
            </li>
          );
        })}
      </ol>

      {audioClip?.path && (
        <AudioPanel key={audioClip.path} clue={audioClip.clue} path={audioClip.path} durationMs={audioClip.duration_ms} kind={audioClip.kind} />
      )}

      {!finished ? (
        <>
          {listenClue !== null && listenClue !== currentClue && (
            <p className="m-0 mt-3 text-[11px] text-muted">
              Replaying clue {listenClue}. <button className="cursor-pointer border-0 bg-transparent p-0 text-[11px] text-accent underline" onClick={() => setListenClue(null)}>Back to clue {currentClue}</button>
            </p>
          )}
          <GuessForm
            key={currentClue}
            catalog={catalog}
            message={message}
            busy={busy}
            onMessage={setMessage}
            onGuess={movie => send(currentClue, movie)}
            onSkip={() => send(currentClue, null)}
          />
        </>
      ) : (
        <RevealPanel state={state} />
      )}

      <div className="game-footnote">
        <span><span className="lock-dot" aria-hidden="true" /> Your answer stays private until you share.</span>
        <span>{state.is_today ? 'FINISH BEFORE MIDNIGHT IST' : 'POWERED BY YOUR LOVE FOR TELUGU CINEMA'}</span>
      </div>
    </section>
  );
}

function Notice({ title, text, action }: { title: string; text: string; action?: React.ReactNode }) {
  return (
    <section className="game-card flex min-h-[420px] flex-col items-center justify-center gap-3 text-center">
      <div className="empty-icon" aria-hidden="true"><Clapperboard /></div>
      <h2 className="font-display m-0 text-[24px]">{title}</h2>
      <p className="m-0 max-w-[380px] text-[12px] leading-relaxed text-muted">{text}</p>
      {action && <div className="mt-2">{action}</div>}
    </section>
  );
}
