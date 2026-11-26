import { describe, expect, it } from 'vitest';
import { barScale, binForBar, createBeatDetector } from './visualizer';

describe('barScale', () => {
  it('goes from a small stub in silence to full height at the loudest', () => {
    expect(barScale(0)).toBeCloseTo(0.06);
    expect(barScale(1)).toBeCloseTo(1);
    expect(barScale(2)).toBeCloseTo(1); // clamped
  });
  it('adds contrast: mid levels stay lower than a straight line', () => {
    expect(barScale(0.5)).toBeLessThan(0.06 + 0.5 * 0.94);
    expect(barScale(0.8)).toBeGreaterThan(barScale(0.5));
  });
});

describe('createBeatDetector', () => {
  it('fires on a sudden bass rise and fades afterwards', () => {
    const beat = createBeatDetector();
    for (let i = 0; i < 60; i++) beat(0.2); // steady background
    expect(beat(0.2)).toBeLessThan(0.05);
    const kick = beat(0.6);
    expect(kick).toBeGreaterThan(0.8);
    const after = [beat(0.2), beat(0.2), beat(0.2)];
    expect(after[0]).toBeLessThan(kick);
    expect(after[2]).toBeLessThan(after[0]);
  });
  it('does not fire for steady loud music', () => {
    const beat = createBeatDetector();
    for (let i = 0; i < 120; i++) beat(0.7);
    expect(beat(0.7)).toBeLessThan(0.05);
  });
});

describe('binForBar', () => {
  it('maps the first bar to the lowest bin and stays within the usable range', () => {
    const bins = 128;
    const mapped = Array.from({ length: 57 }, (_, i) => binForBar(i, 57, bins));
    expect(mapped[0]).toBe(0);
    expect(Math.max(...mapped)).toBeLessThan(Math.floor(bins * 0.72));
  });

  it('is non-decreasing (low frequencies on the left)', () => {
    const mapped = Array.from({ length: 57 }, (_, i) => binForBar(i, 57, 128));
    for (let i = 1; i < mapped.length; i++) expect(mapped[i]).toBeGreaterThanOrEqual(mapped[i - 1]);
  });
});
