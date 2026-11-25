'use client';

import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Headphones, Loader2, Music2, Play, RotateCcw, Volume2 } from 'lucide-react';
import { startVisualizer } from '@/lib/audio/visualizer';
import { signClipUrl } from '@/lib/game/api';
import { getBrowserSupabase } from '@/lib/supabase/browser';

const BARS = Array.from({ length: 57 }, (_, i) => ({ height: 14 + ((i * 19 + 7) % 54), opacity: 0.35 + (i % 5) * 0.13, delay: (i % 7) * 0.11 }));

const mmss = (sec: number) => {
  const s = Math.max(0, Math.floor(sec));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};

type Status = 'loading' | 'ready' | 'playing' | 'buffering' | 'error';

type Props = {
  clue: number;
  /** Storage path of the unlocked clip. Parent remounts this component (key) when it changes. */
  path: string;
  durationMs: number;
  kind: 'bgm' | 'song_interlude';
};

/**
 * Listening stage with a real <audio> element. Replaying never uses up a guess.
 * Handles slow connections (buffering) and failures (retry with a fresh URL).
 */
export function AudioPanel({ clue, path, durationMs, kind }: Props) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [src, setSrc] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>('loading');
  const [time, setTime] = useState(0);
  const [attempt, setAttempt] = useState(0);
  const [live, setLive] = useState(false);
  const waveRef = useRef<HTMLDivElement>(null);
  const stopVizRef = useRef<(() => void) | null>(null);

  function stopViz() {
    stopVizRef.current?.();
    stopVizRef.current = null;
    setLive(false);
  }
  useEffect(() => () => { stopVizRef.current?.(); }, []);

  useEffect(() => {
    const supabase = getBrowserSupabase();
    if (!supabase) return;
    let cancelled = false;
    signClipUrl(supabase, path)
      .then(url => { if (!cancelled) setSrc(url); })
      .catch(() => { if (!cancelled) setStatus('error'); });
    return () => { cancelled = true; };
  }, [path, attempt]);

  const durationSec = durationMs / 1000;
  const playing = status === 'playing' || status === 'buffering';

  async function play(fromStart: boolean) {
    const audio = audioRef.current;
    if (!audio || !src) return;
    if (fromStart) audio.currentTime = 0;
    // Start the live visualiser from this user gesture (browsers require one for Web Audio).
    if (!stopVizRef.current && waveRef.current) {
      stopVizRef.current = await startVisualizer(audio, Array.from(waveRef.current.querySelectorAll('i')));
      setLive(!!stopVizRef.current);
    }
    try {
      await audio.play();
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return; // interrupted by pause
      setStatus('error');
    }
  }

  function toggle() {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) audio.pause();
    else play(audio.ended);
  }

  function retry() {
    setStatus('loading');
    setSrc(null);
    setAttempt(a => a + 1);
  }

  const statusText: Record<Status, string> = {
    loading: 'Loading clue…',
    ready: time > 0 ? 'Paused' : 'Ready when you are',
    playing: 'Playing clue',
    buffering: 'Buffering… (slow connection)',
    error: 'Couldn’t load this clue',
  };

  return (
    <div className={`audio-panel ${playing ? 'is-playing' : ''} ${live ? 'is-live' : ''}`}>
      <div className="audio-panel-top">
        <div className="audio-kicker"><span className="sound-pulse" aria-hidden="true" /> NOW PLAYING · CLUE 0{clue} · {kind === 'bgm' ? 'BGM' : 'SONG INTERLUDE'}</div>
        <span className="clip-duration">{`${Math.floor(durationSec / 60)}:${String(Math.round(durationSec % 60)).padStart(2, '0')}`}</span>
      </div>
      <div className="audio-art" aria-hidden="true">
        <div className="art-glow glow-one" />
        <div className="art-glow glow-two" />
        <div className="vinyl"><div className="vinyl-inner"><Music2 size={25} /></div></div>
        <div className="waveform" ref={waveRef}>
          {BARS.map((b, i) => <i key={i} style={{ height: `${b.height}%`, opacity: b.opacity, animationDelay: `${b.delay}s` }} />)}
        </div>
        <div className="art-caption">A SOUND FROM THE SILVER SCREEN</div>
      </div>

      {src && (
        <audio
          ref={audioRef}
          src={src}
          crossOrigin="anonymous"
          preload="auto"
          onCanPlay={() => setStatus(s => (s === 'loading' ? 'ready' : s))}
          onPlaying={() => setStatus('playing')}
          onWaiting={() => setStatus('buffering')}
          onPause={() => { stopViz(); setStatus(s => (s === 'error' ? s : 'ready')); }}
          onEnded={() => { stopViz(); setStatus('ready'); setTime(0); }}
          onTimeUpdate={e => setTime(e.currentTarget.currentTime)}
          onError={() => setStatus('error')}
        />
      )}

      <div className="player-controls">
        <button
          className={`play-button ${playing ? 'is-playing' : ''}`}
          onClick={toggle}
          disabled={status === 'loading' || status === 'error'}
          aria-label={playing ? 'Pause clue' : 'Play clue'}
        >
          {status === 'loading' ? <Loader2 size={20} className="animate-spin" aria-hidden="true" />
            : playing ? <span className="pause-bars" aria-hidden="true"><i /><i /></span>
            : <Play size={20} fill="currentColor" aria-hidden="true" />}
        </button>
        <div className="player-track">
          <div className="track-meta">
            <span role="status" aria-live="polite">{statusText[status]}</span>
            <span>{mmss(time)} / {mmss(durationSec)}</span>
          </div>
          <div className="track-rail" aria-hidden="true">
            <i style={{ width: `${Math.min(100, (time / durationSec) * 100)}%`, transition: 'width .25s linear' }} />
          </div>
        </div>
        {status === 'error' ? (
          <button className="replay-button" onClick={retry}><AlertTriangle size={15} aria-hidden="true" /><span>Retry</span></button>
        ) : (
          <button className="replay-button" onClick={() => play(true)} disabled={status === 'loading'} aria-label="Replay clue from the start">
            <RotateCcw size={15} aria-hidden="true" /><span>Replay</span>
          </button>
        )}
        <Volume2 size={17} className="volume-icon" aria-hidden="true" />
      </div>
      <div className="audio-note"><Headphones size={14} aria-hidden="true" /> Replay as often as you like — it never uses up a guess.</div>
    </div>
  );
}
