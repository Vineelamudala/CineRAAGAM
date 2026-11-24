import { describe, expect, it } from 'vitest';
import { addDays, dateRange } from './dates';

describe('admin date helpers', () => {
  it('adds days across month and year boundaries', () => {
    expect(addDays('2026-11-30', 1)).toBe('2026-12-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('lists an inclusive date range', () => {
    expect(dateRange('2026-11-29', '2026-12-02')).toEqual(['2026-11-29', '2026-11-30', '2026-12-01', '2026-12-02']);
    expect(dateRange('2026-12-02', '2026-12-01')).toEqual([]);
  });
});
