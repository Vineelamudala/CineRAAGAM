import { describe, expect, it } from 'vitest';
import { encodeMp3, MP3_KBPS, MP3_SAMPLE_RATE, toInt16 } from './mp3';

const tone = (seconds: number, hz = 440) =>
  new Float32Array(Math.round(seconds * MP3_SAMPLE_RATE)).map((_, i) => 0.4 * Math.sin((2 * Math.PI * hz * i) / MP3_SAMPLE_RATE));

describe('toInt16', () => {
  it('maps -1..1 to the 16-bit range and clips beyond it', () => {
    expect(Array.from(toInt16(new Float32Array([0, 1, -1, 2, -2])))).toEqual([0, 32767, -32768, 32767, -32768]);
  });
});

describe('encodeMp3', () => {
  it('produces a valid constant-bitrate MP3 of the expected size', () => {
    const seconds = 2;
    const bytes = encodeMp3([tone(seconds), tone(seconds, 660)]);
    // Starts with an MPEG-1 Layer III frame header (sync word 0xFFF, layer bits 01).
    expect(bytes[0]).toBe(0xff);
    expect(bytes[1] & 0xfe).toBe(0xfa);
    const expected = (MP3_KBPS * 1000 * seconds) / 8;
    expect(bytes.length).toBeGreaterThan(expected * 0.9);
    expect(bytes.length).toBeLessThan(expected * 1.15);
  });

  it('encodes mono too', () => {
    expect(encodeMp3([tone(1)]).length).toBeGreaterThan(1000);
  });

  it('rejects more than two channels', () => {
    expect(() => encodeMp3([tone(0.1), tone(0.1), tone(0.1)])).toThrow();
  });
});
