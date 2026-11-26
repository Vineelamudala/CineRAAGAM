import { describe, expect, it } from 'vitest';
import { computeSpectrum, frameAt } from './spectrum';

const sine = (hz: number, seconds: number, rate = 48000, amp = 0.5) =>
  new Float32Array(Math.round(seconds * rate)).map((_, i) => amp * Math.sin((2 * Math.PI * hz * i) / rate));

describe('computeSpectrum', () => {
  it('makes 30 frames per second of 128 bins', () => {
    const s = computeSpectrum(sine(1000, 2), 48000);
    expect(s.frames).toHaveLength(60);
    expect(s.frames[10]).toHaveLength(128);
  });

  it('puts a tone in the right frequency bin', () => {
    // 48000 Hz / 256 = 187.5 Hz per bin: 1000 Hz lands in bin 5.
    const frame = computeSpectrum(sine(1000, 1), 48000).frames[15];
    const loudest = frame.indexOf(Math.max(...frame));
    expect(loudest).toBe(5);
    expect(frame[5]).toBeGreaterThan(200);
    expect(frame[60]).toBeLessThan(frame[5] / 2);
  });

  it('is silent for silence, and follows the music over time', () => {
    const quietThenLoud = new Float32Array(48000);
    quietThenLoud.set(sine(440, 0.5), 24000);
    const s = computeSpectrum(quietThenLoud, 48000);
    expect(Math.max(...frameAt(s, 0.1))).toBe(0);
    expect(Math.max(...frameAt(s, 0.8))).toBeGreaterThan(150);
  });
});

describe('frameAt', () => {
  it('clamps to the first and last frame', () => {
    const s = computeSpectrum(sine(440, 1), 48000);
    expect(frameAt(s, -1)).toBe(s.frames[0]);
    expect(frameAt(s, 99)).toBe(s.frames[s.frames.length - 1]);
  });
});
