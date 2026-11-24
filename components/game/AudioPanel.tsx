import { Headphones, Music2, Play, RotateCcw, Volume2 } from 'lucide-react';

const BARS = Array.from({ length: 57 }, (_, i) => ({ height: 14 + ((i * 19 + 7) % 54), opacity: 0.35 + (i % 5) * 0.13 }));

const mmss = (sec: number) => `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`;

type Props = {
  clue: number;
  durationSec: number;
  playing: boolean;
  onToggle: () => void;
  onReplay: () => void;
};

/**
 * Listening stage. Phase 0 is still a visual placeholder; Phase 2 wires a
 * real <audio> element (signed URL per unlocked clue) with loading/error states.
 * Replaying never consumes an attempt.
 */
export function AudioPanel({ clue, durationSec, playing, onToggle, onReplay }: Props) {
  return (
    <div className="audio-panel">
      <div className="audio-panel-top">
        <div className="audio-kicker"><span className="sound-pulse" aria-hidden="true" /> NOW PLAYING · CLUE 0{clue}</div>
        <span className="clip-duration">{`${Math.floor(durationSec / 60)}:${String(durationSec % 60).padStart(2, '0')}`}</span>
      </div>
      <div className="audio-art" aria-hidden="true">
        <div className="art-glow glow-one" />
        <div className="art-glow glow-two" />
        <div className="vinyl"><div className="vinyl-inner"><Music2 size={25} /></div></div>
        <div className="waveform">
          {BARS.map((b, i) => <i key={i} style={{ height: `${b.height}%`, opacity: b.opacity }} />)}
        </div>
        <div className="art-caption">A SOUND FROM THE SILVER SCREEN</div>
      </div>
      <div className="player-controls">
        <button className={`play-button ${playing ? 'is-playing' : ''}`} onClick={onToggle} aria-label={playing ? 'Pause clue' : 'Play clue'}>
          {playing ? <span className="pause-bars" aria-hidden="true"><i /><i /></span> : <Play size={20} fill="currentColor" aria-hidden="true" />}
        </button>
        <div className="player-track">
          <div className="track-meta"><span>{playing ? 'Playing preview' : 'Ready when you are'}</span><span>00:00 / {mmss(durationSec)}</span></div>
          <div className="track-rail"><i className={playing ? 'progress-playing' : ''} /></div>
        </div>
        <button className="replay-button" onClick={onReplay} aria-label="Replay clue from the start"><RotateCcw size={15} aria-hidden="true" /><span>Replay</span></button>
        <Volume2 size={17} className="volume-icon" aria-hidden="true" />
      </div>
      <div className="audio-note"><Headphones size={14} aria-hidden="true" /> Headphones recommended for the full experience.</div>
    </div>
  );
}
