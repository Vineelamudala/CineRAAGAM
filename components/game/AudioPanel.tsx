'use client';

import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Headphones, Loader2, Play, RotateCcw } from 'lucide-react';
import { loadSpectrum } from '@/lib/audio/spectrum';
import { startVisualizer } from '@/lib/audio/visualizer';

// Resting shape of the bars (a soft wave); while a clip plays they follow the music.
const BARS = Array.from({ length: 48 }, (_, i) => ({ height: 18 + Math.round(22 * Math.abs(Math.sin(i * 0.42)) + 10 * ((i * 7) % 3) / 2), delay: (i % 7) * 0.11 }));

const mmss = (sec: number) => {
  const s = Math.max(0, Math.round(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
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
  const [status, setStatus] = useState<Status>('loading');
  const [time, setTime] = useState(0);
  const [attempt, setAttempt] = useState(0);
  // Audio comes through our own /api/clip endpoint (CDN-cached; the server checks
  // the clue is unlocked for this player). `retry` only changes on a manual retry.
  const src = `/api/clip/${path}${attempt ? `?retry=${attempt}` : ''}`;
  const [live, setLive] = useState(false);
  const waveRef = useRef<HTMLDivElement>(null);
  const artRef = useRef<HTMLDivElement>(null); // the player; receives --beat / --level from the visualiser
  const debugRef = useRef<HTMLPreElement>(null); // visualiser diagnostics (only with ?debug=viz)
  const stopVizRef = useRef<(() => void) | null>(null);

  function stopViz() {
    stopVizRef.current?.();
    stopVizRef.current = null;
    setLive(false);
  }
  useEffect(() => () => { stopVizRef.current?.(); }, []);

  const durationSec = durationMs / 1000;
  const playing = status === 'playing' || status === 'buffering';

  // Analyse the clip as soon as it is available, so the bars are ready when Play is pressed.
  // (Same URL as the <audio> element, so it comes from the browser cache.)
  useEffect(() => { loadSpectrum(src); }, [src]);

  async function play(fromStart: boolean) {
    const audio = audioRef.current;
    if (!audio) return;
    if (fromStart) audio.currentTime = 0;
    if (!stopVizRef.current && waveRef.current) {
      stopVizRef.current = startVisualizer(audio, Array.from(waveRef.current.querySelectorAll('i')), {
        spectrum: loadSpectrum(src),
        stage: artRef.current ?? undefined,
        debugEl: debugRef.current ?? undefined,
        onLive: setLive,
      });
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
    setAttempt(a => a + 1);
  }

  const statusText: Record<Status, string> = {
    loading: 'Loading clue…',
    ready: time > 0 ? 'Paused' : 'Ready when you are',
    playing: 'Playing clue',
    buffering: 'Buffering… (slow connection)',
    error: 'Couldn’t load this clue',
  };

  const progress = Math.min(100, (time / durationSec) * 100);

  function seek(to: number) {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = to;
    setTime(to);
  }

  return (
    <div ref={artRef} className={`audio-panel clue-player ${playing ? 'is-playing' : ''} ${live ? 'is-live' : ''}`}>
      <div className="cp-glow" aria-hidden="true" />

      <div className="cp-head">
        <div className="cp-heading">
          <div className="cp-title">Clue {clue} · {kind === 'bgm' ? 'BGM' : 'Song interlude'}</div>
          <div className="cp-status" role="status" aria-live="polite">{statusText[status]}</div>
        </div>
        {status === 'error' ? (
          <button className="cp-icon-button cp-retry" onClick={retry}><AlertTriangle size={15} aria-hidden="true" /><span>Retry</span></button>
        ) : (
          <button className="cp-icon-button" onClick={() => play(true)} disabled={status === 'loading'} aria-label="Replay clue from the start">
            <RotateCcw size={16} aria-hidden="true" />
          </button>
        )}
      </div>

      <div className="waveform" ref={waveRef} aria-hidden="true">
        {BARS.map((b, i) => <i key={i} style={{ height: `${b.height}%`, animationDelay: `${b.delay}s` }} />)}
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

      <div className="cp-scrub">
        <input
          type="range"
          className="cp-range"
          min={0}
          max={durationSec}
          step={0.05}
          value={Math.min(time, durationSec)}
          onChange={e => seek(Number(e.target.value))}
          disabled={status === 'loading' || status === 'error'}
          aria-label="Position in the clue"
          aria-valuetext={`${mmss(time)} of ${mmss(durationSec)}`}
          style={{ '--progress': `${progress}%` } as React.CSSProperties}
        />
        <div className="cp-times" aria-hidden="true">
          <span>{mmss(time)}</span>
          <span>-{mmss(durationSec - time)}</span>
        </div>
      </div>

      <div className="cp-controls">
        <button
          className={`play-button cp-play ${playing ? 'is-playing' : ''}`}
          onClick={toggle}
          disabled={status === 'loading' || status === 'error'}
          aria-label={playing ? 'Pause clue' : 'Play clue'}
        >
          {status === 'loading' ? <Loader2 size={24} className="animate-spin" aria-hidden="true" />
            : playing ? <span className="pause-bars" aria-hidden="true"><i /><i /></span>
            : <Play size={24} fill="currentColor" aria-hidden="true" />}
        </button>
      </div>
      <div className="audio-note"><Headphones size={14} aria-hidden="true" /> Replay as often as you like. It never uses up a guess.</div>
      <pre ref={debugRef} className="viz-debug" aria-hidden="true" />
    </div>
  );
}
