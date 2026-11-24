import { describe, expect, it } from 'vitest';
import { monthGrid, monthOf, shiftMonth } from './calendar';

describe('calendar helpers', () => {
  it('builds a Monday-first grid', () => {
    const grid = monthGrid('2026-11'); // 1 Nov 2026 is a Sunday
    expect(grid[0]).toEqual([null, null, null, null, null, null, '2026-11-01']);
    expect(grid.at(-1)).toEqual(['2026-11-30', null, null, null, null, null, null]);
    expect(grid.flat().filter(Boolean)).toHaveLength(30);
  });

  it('handles February in leap years', () => {
    expect(monthGrid('2028-02').flat().filter(Boolean)).toHaveLength(29);
  });

  it('shifts months across years', () => {
    expect(shiftMonth('2026-12', 1)).toBe('2027-01');
    expect(shiftMonth('2026-01', -1)).toBe('2025-12');
    expect(monthOf('2026-11-25')).toBe('2026-11');
  });
});
