import { describe, expect, it } from 'vitest';
import { canCutClip, clampSelection, formatSeconds, pickRecordingFormat, waveformPeaks } from './clipEncoding';

describe('clampSelection', () => {
  it('keeps clips between 5 and 20 seconds', () => {
    expect(clampSelection(0, 3, 200)).toEqual({ start: 0, length: 5 });
    expect(clampSelection(0, 45, 200)).toEqual({ start: 0, length: 20 });
    expect(clampSelection(10, 12.34, 200)).toEqual({ start: 10, length: 12.3 });
  });

  it('never runs past the end of the file', () => {
    expect(clampSelection(195, 10, 200)).toEqual({ start: 190, length: 10 });
    expect(clampSelection(-4, 10, 200)).toEqual({ start: 0, length: 10 });
  });

  it('uses the whole file when it is shorter than the requested length', () => {
    expect(clampSelection(0, 20, 7)).toEqual({ start: 0, length: 7 });
  });

  it('rejects files shorter than 5 seconds', () => {
    expect(canCutClip(4.9)).toBe(false);
    expect(canCutClip(5)).toBe(true);
  });
});

describe('pickRecordingFormat', () => {
  it('prefers WebM/Opus, then Ogg, then MP4', () => {
    expect(pickRecordingFormat(() => true)?.ext).toBe('webm');
    expect(pickRecordingFormat(m => m.startsWith('audio/ogg'))?.ext).toBe('ogg');
    expect(pickRecordingFormat(m => m === 'audio/mp4')).toEqual({ mime: 'audio/mp4', ext: 'm4a', contentType: 'audio/mp4' });
    expect(pickRecordingFormat(() => false)).toBeNull();
  });
});

describe('waveformPeaks', () => {
  it('returns one absolute peak per bucket', () => {
    // Float32 samples: compare approximately (0.3 is stored as 0.30000001…).
    const peaks = waveformPeaks(new Float32Array([0.1, -0.5, 0.2, 0.9, -0.3, 0]), 3);
    expect(peaks).toHaveLength(3);
    [0.5, 0.9, 0.3].forEach((v, i) => expect(peaks[i]).toBeCloseTo(v, 5));
  });
});

describe('formatSeconds', () => {
  it('formats as m:ss.s', () => {
    expect(formatSeconds(65.25)).toBe('1:05.3');
    expect(formatSeconds(5)).toBe('0:05.0');
  });
});
