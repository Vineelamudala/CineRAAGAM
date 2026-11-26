'use client';

/**
 * Live audio visualiser using the Web Audio API (no dependencies).
 * Each <audio> element can be wired into the graph only once, so analysers
 * are cached per element. The clip must be CORS-readable (crossOrigin="anonymous";
 * Supabase Storage sends Access-Control-Allow-Origin: *).
 */
let context: AudioContext | null = null;
const analysers = new WeakMap<HTMLAudioElement, AnalyserNode>();

function analyserFor(audio: HTMLAudioElement): AnalyserNode {
  const existing = analysers.get(audio);
  if (existing) return existing;
  context ??= new AudioContext();
  const source = context.createMediaElementSource(audio);
  const analyser = context.createAnalyser();
  analyser.fftSize = 256;
  // Snappier than the default so drum hits and note changes show up as they happen.
  analyser.smoothingTimeConstant = 0.55;
  // A wider loudness window than the default gives quiet passages and peaks visibly different bars.
  analyser.minDecibels = -90;
  analyser.maxDecibels = -22;
  source.connect(analyser);
  analyser.connect(context.destination);
  analysers.set(audio, analyser);
  return analyser;
}

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

/**
 * Starts animating `bars` from `audio`. Call from a user gesture (play).
 * If `stage` is given, it receives two CSS variables every frame:
 * --beat (0..1, bass kicks) and --level (0..1, overall loudness).
 * Returns a stop function. Returns null when unsupported (bars stay decorative).
 */
export async function startVisualizer(audio: HTMLAudioElement, bars: HTMLElement[], stage?: HTMLElement): Promise<(() => void) | null> {
  // Runs even with "reduce motion" on: many Android phones turn that on in battery
  // saver, and the bars only move while the player has pressed play. The extra
  // effects (reel pulse, glow) are switched off for reduce motion in CSS instead.
  if (typeof AudioContext === 'undefined' || bars.length === 0) return null;
  let analyser: AnalyserNode;
  try {
    analyser = analyserFor(audio);
    if (context!.state === 'suspended') await context!.resume();
  } catch {
    return null;
  }
  const data = new Uint8Array(analyser.frequencyBinCount);
  const map = bars.map((_, i) => binForBar(i, bars.length, data.length));
  // Mirror the spectrum around the centre so the waveform looks symmetric.
  const mid = (bars.length - 1) / 2;
  const order = bars.map((_, i) => map[Math.round((Math.abs(i - mid) / Math.max(1, mid)) * (bars.length - 1))]);
  const detectBeat = createBeatDetector();
  const bassBins = Math.max(2, Math.round(data.length * 0.05));
  let raf = 0;
  const frame = () => {
    analyser.getByteFrequencyData(data);
    let total = 0;
    let bass = 0;
    for (let k = 0; k < data.length; k++) {
      total += data[k];
      if (k < bassBins) bass += data[k];
    }
    for (let i = 0; i < bars.length; i++) {
      bars[i].style.transform = `scaleY(${barScale(data[order[i]] / 255).toFixed(3)})`;
    }
    if (stage) {
      stage.style.setProperty('--beat', detectBeat(bass / bassBins / 255).toFixed(3));
      stage.style.setProperty('--level', (total / data.length / 255).toFixed(3));
    }
    raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);
  return () => {
    cancelAnimationFrame(raf);
    for (const b of bars) b.style.transform = '';
    stage?.style.removeProperty('--beat');
    stage?.style.removeProperty('--level');
  };
}
