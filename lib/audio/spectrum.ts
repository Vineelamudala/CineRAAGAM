/**
 * Pre-computed spectrum of a clip, so the visualiser follows the music on every
 * device. Live analysis (Web Audio + the <audio> element) gets no data on many
 * phones; analysing the file itself and following audio.currentTime works
 * everywhere. Output matches an AnalyserNode with fftSize 256: 128 byte bins
 * per frame (0 = quiet, 255 = loud).
 */
export type Spectrum = { fps: number; frames: Uint8Array[] };

export const SPECTRUM_FPS = 30;
const FFT_SIZE = 256;
const MIN_DB = -90;
const MAX_DB = -22;
const SMOOTHING = 0.55;

/** In-place iterative radix-2 FFT (re/im length must be a power of two). */
function fft(re: Float32Array, im: Float32Array): void {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const half = len >> 1;
    const angle = (-2 * Math.PI) / len;
    const wr = Math.cos(angle);
    const wi = Math.sin(angle);
    for (let i = 0; i < n; i += len) {
      let cr = 1;
      let ci = 0;
      for (let k = 0; k < half; k++) {
        const a = i + k;
        const b = a + half;
        const br = re[b] * cr - im[b] * ci;
        const bi = re[b] * ci + im[b] * cr;
        re[b] = re[a] - br;
        im[b] = im[a] - bi;
        re[a] += br;
        im[a] += bi;
        const next = cr * wr - ci * wi;
        ci = cr * wi + ci * wr;
        cr = next;
      }
    }
  }
}

/** Spectrum frames (SPECTRUM_FPS per second) for mono samples. */
export function computeSpectrum(samples: Float32Array, sampleRate: number, fps = SPECTRUM_FPS): Spectrum {
  const bins = FFT_SIZE / 2;
  const window = new Float32Array(FFT_SIZE).map((_, i) => 0.5 * (1 - Math.cos((2 * Math.PI * i) / (FFT_SIZE - 1))));
  const re = new Float32Array(FFT_SIZE);
  const im = new Float32Array(FFT_SIZE);
  const smooth = new Float32Array(bins);
  const count = Math.max(1, Math.ceil((samples.length / sampleRate) * fps));
  const frames: Uint8Array[] = [];
  for (let f = 0; f < count; f++) {
    const start = Math.round((f / fps) * sampleRate) - FFT_SIZE / 2;
    for (let i = 0; i < FFT_SIZE; i++) {
      const s = samples[start + i];
      re[i] = (s === undefined ? 0 : s) * window[i];
      im[i] = 0;
    }
    fft(re, im);
    const out = new Uint8Array(bins);
    for (let k = 0; k < bins; k++) {
      const magnitude = Math.hypot(re[k], im[k]) / FFT_SIZE;
      smooth[k] = SMOOTHING * smooth[k] + (1 - SMOOTHING) * magnitude;
      const db = 20 * Math.log10(smooth[k] + 1e-12);
      out[k] = Math.max(0, Math.min(255, Math.round(((db - MIN_DB) / (MAX_DB - MIN_DB)) * 255)));
    }
    frames.push(out);
  }
  return { fps, frames };
}

/** The frame to show at `time` seconds. */
export function frameAt(spectrum: Spectrum, time: number): Uint8Array {
  const i = Math.min(spectrum.frames.length - 1, Math.max(0, Math.floor(time * spectrum.fps)));
  return spectrum.frames[i];
}

async function analyse(bytes: ArrayBuffer): Promise<Spectrum | null> {
  try {
    if (typeof OfflineAudioContext === 'undefined') return null;
    const decoded = await new OfflineAudioContext(1, 1, 44100).decodeAudioData(bytes);
    const mono = new Float32Array(decoded.length);
    for (let c = 0; c < decoded.numberOfChannels; c++) {
      const channel = decoded.getChannelData(c);
      for (let i = 0; i < mono.length; i++) mono[i] += channel[i] / decoded.numberOfChannels;
    }
    return computeSpectrum(mono, decoded.sampleRate);
  } catch {
    return null; // can't decode here: the bars fall back to a simple pulse
  }
}

/** A downloaded clip: the file itself (played from memory) and its spectrum. */
export type LoadedClip = { blob: Blob; spectrum: Promise<Spectrum | null> };

const clips = new Map<string, Promise<LoadedClip>>();

/**
 * Downloads a clip completely, once per page. Playing it from memory (a blob:
 * URL) instead of streaming it avoids two phone problems: iPhones need the
 * server to answer partial "range" requests for streamed audio (or they fail /
 * stop early), and seeking works everywhere. Rejects when the clip can't be
 * downloaded (e.g. locked or offline); a later call retries.
 */
export function loadClip(url: string): Promise<LoadedClip> {
  let pending = clips.get(url);
  if (!pending) {
    pending = (async () => {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`clip HTTP ${res.status}`);
      const blob = await res.blob();
      return { blob, spectrum: blob.arrayBuffer().then(analyse) };
    })();
    pending.catch(() => clips.delete(url));
    clips.set(url, pending);
  }
  return pending;
}
