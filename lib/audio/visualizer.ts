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
  analyser.smoothingTimeConstant = 0.78;
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

export const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Starts animating `bars` from `audio`. Call from a user gesture (play).
 * Returns a stop function. Returns null when unsupported (bars stay decorative).
 */
export async function startVisualizer(audio: HTMLAudioElement, bars: HTMLElement[]): Promise<(() => void) | null> {
  if (prefersReducedMotion() || typeof AudioContext === 'undefined' || bars.length === 0) return null;
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
  let raf = 0;
  const frame = () => {
    analyser.getByteFrequencyData(data);
    for (let i = 0; i < bars.length; i++) {
      const v = data[order[i]] / 255;
      bars[i].style.transform = `scaleY(${(0.12 + v * 1.05).toFixed(3)})`;
    }
    raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);
  return () => {
    cancelAnimationFrame(raf);
    for (const b of bars) b.style.transform = '';
  };
}
