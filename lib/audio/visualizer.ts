'use client';

import { frameAt, type Spectrum } from './spectrum';

/**
 * Audio visualiser (no dependencies). The bars follow a spectrum computed from
 * the clip file itself (lib/audio/spectrum.ts), synced to audio.currentTime.
 * This works on every device: live Web Audio analysis of an <audio> element
 * gets no data on many phones, and can mute playback if started at the wrong
 * moment, so it is not used.
 */

/** Map bar i of n to a frequency bin, giving low/mid frequencies more bars (they carry the music). */
export function binForBar(i: number, bars: number, bins: number): number {
  const usable = Math.floor(bins * 0.72); // the top of the spectrum is mostly empty for compressed audio
  return Math.min(usable - 1, Math.floor(Math.pow(i / Math.max(1, bars - 1), 1.7) * (usable - 1)));
}

/**
 * Bar height (as a scale of the full bar) for a frequency level 0..1.
 * A power curve adds contrast: quiet bins stay low, loud ones jump up.
 */
export function barScale(level: number): number {
  const v = Math.min(1, Math.max(0, level));
  return 0.06 + Math.pow(v, 1.6) * 0.94;
}

/**
 * Detects bass "kicks": how far the current bass energy rises above its
 * recent average. Returns 0 (no beat) .. 1 (strong beat) per frame.
 */
export function createBeatDetector(): (bass: number) => number {
  let average = 0;
  let beat = 0;
  return (bass: number) => {
    average = average * 0.93 + bass * 0.07;
    const kick = Math.min(1, Math.max(0, (bass - average) * 5));
    beat = Math.max(kick, beat * 0.86); // rise instantly, fade out smoothly
    return beat;
  };
}

type Options = {
  /** The clip's spectrum (from loadSpectrum); null when the browser can't decode the file. */
  spectrum: Promise<Spectrum | null>;
  /** Receives --beat (0..1, bass kicks) and --level (0..1, loudness) every frame. */
  stage?: HTMLElement;
  /** Called with true once the bars follow the music (false if they can't). */
  onLive?: (live: boolean) => void;
  /** Diagnostics target, used only when the page URL contains ?debug=viz. */
  debugEl?: HTMLElement;
};

/**
 * Starts animating `bars` in time with `audio` (call when playback starts).
 * Runs even with "reduce motion" on: many Android phones turn that on in battery
 * saver, and the bars only move while the player has pressed play. The extra
 * effects (reel pulse, glow) are switched off for reduce motion in CSS instead.
 * Returns a stop function.
 */
export function startVisualizer(audio: HTMLAudioElement, bars: HTMLElement[], { spectrum: pending, stage, onLive, debugEl }: Options): () => void {
  const debug = debugEl && typeof location !== 'undefined' && /[?&]debug=viz\b/.test(location.search) ? debugEl : null;
  const report = (text: string) => { if (debug) debug.textContent = text; };
  let spectrum: Spectrum | null = null;
  let stopped = false;
  report('viz: analysing the clip…');
  pending.then(s => {
    if (stopped) return;
    spectrum = s;
    onLive?.(!!s);
    if (!s) report('viz: this browser could not decode the clip; bars use the simple pulse');
  });

  const bins = 128;
  const map = bars.map((_, i) => binForBar(i, bars.length, bins));
  // Mirror the spectrum around the centre so the waveform looks symmetric.
  const mid = (bars.length - 1) / 2;
  const order = bars.map((_, i) => map[Math.round((Math.abs(i - mid) / Math.max(1, mid)) * (bars.length - 1))]);
  const detectBeat = createBeatDetector();
  const bassBins = Math.max(2, Math.round(bins * 0.05));
  let raf = 0;
  let frames = 0;
  let peak = 0;
  const frame = () => {
    raf = requestAnimationFrame(frame);
    if (!spectrum) return; // still analysing (or not decodable): bars keep their idle look
    const data = frameAt(spectrum, audio.currentTime);
    let total = 0;
    let bass = 0;
    for (let k = 0; k < data.length; k++) {
      total += data[k];
      if (k < bassBins) bass += data[k];
      if (data[k] > peak) peak = data[k];
    }
    if (debug && ++frames % 15 === 0) {
      report(`viz: following the clip | audio ${audio.paused ? 'paused' : 'playing'} t=${audio.currentTime.toFixed(1)}s | `
        + `level now=${Math.round(total / data.length)} peak=${peak} | frames=${frames} | reduceMotion=${matchMedia('(prefers-reduced-motion: reduce)').matches} | ${navigator.userAgent.replace(/^Mozilla\/5\.0 /, '').slice(0, 90)}`);
    }
    for (let i = 0; i < bars.length; i++) {
      bars[i].style.transform = `scaleY(${barScale(data[order[i]] / 255).toFixed(3)})`;
    }
    if (stage) {
      stage.style.setProperty('--beat', detectBeat(bass / bassBins / 255).toFixed(3));
      stage.style.setProperty('--level', (total / data.length / 255).toFixed(3));
    }
  };
  raf = requestAnimationFrame(frame);
  return () => {
    stopped = true;
    cancelAnimationFrame(raf);
    for (const b of bars) b.style.transform = '';
    stage?.style.removeProperty('--beat');
    stage?.style.removeProperty('--level');
  };
}
