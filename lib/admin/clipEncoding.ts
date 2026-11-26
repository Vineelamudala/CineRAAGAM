/**
 * Clip preparation helpers for the admin uploader. Pure functions are unit
 * tested; the browser-only parts (decode / record) live in ClipUploader.
 */

export const CLIP_MIN_SEC = 5;
export const CLIP_MAX_SEC = 20;
export const FADE_SEC = 0.15;

/** Clamp a selection to the file length and the 5–20 s rule. */
export function clampSelection(start: number, length: number, total: number): { start: number; length: number } {
  const len = Math.min(CLIP_MAX_SEC, Math.max(CLIP_MIN_SEC, length), total);
  const s = Math.min(Math.max(0, start), Math.max(0, total - len));
  return { start: Math.round(s * 10) / 10, length: Math.round(len * 10) / 10 };
}

/**
 * File picker filter: audio AND video (only the sound is used), plus explicit
 * extensions, because iPhones grey out files that match only `audio/*`.
 */
export const ACCEPT_FILES = 'audio/*,video/*,.mp3,.m4a,.aac,.wav,.ogg,.oga,.opus,.flac,.webm,.mp4,.m4v,.mov,.3gp';

/** True when the file is long enough to cut a valid clip from. */
export const canCutClip = (totalSec: number) => totalSec >= CLIP_MIN_SEC;

/** Best recording format the browser supports, with its storage extension. */
export function pickRecordingFormat(isSupported: (mime: string) => boolean): { mime: string; ext: 'webm' | 'ogg' | 'm4a'; contentType: string } | null {
  const options = [
    { mime: 'audio/webm;codecs=opus', ext: 'webm', contentType: 'audio/webm' },
    { mime: 'audio/ogg;codecs=opus', ext: 'ogg', contentType: 'audio/ogg' },
    { mime: 'audio/mp4', ext: 'm4a', contentType: 'audio/mp4' },
  ] as const;
  return options.find(o => isSupported(o.mime)) ?? null;
}

/** Peak amplitude per bucket, for drawing a waveform (values 0..1). */
export function waveformPeaks(samples: Float32Array, buckets: number): number[] {
  const size = Math.max(1, Math.floor(samples.length / buckets));
  const peaks: number[] = [];
  for (let b = 0; b < buckets; b++) {
    let max = 0;
    const end = Math.min(samples.length, (b + 1) * size);
    for (let i = b * size; i < end; i++) {
      const v = Math.abs(samples[i]);
      if (v > max) max = v;
    }
    peaks.push(Math.min(1, max));
  }
  return peaks;
}

export const formatSeconds = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toFixed(1).padStart(4, '0')}`;
