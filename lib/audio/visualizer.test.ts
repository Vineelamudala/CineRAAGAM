import { describe, expect, it } from 'vitest';
import { binForBar } from './visualizer';

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
