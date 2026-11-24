import { describe, expect, it } from 'vitest';
import { formatCountdown, istDateString, msUntilNextIstMidnight } from './ist';

const HOUR = 3600_000;

describe('IST date', () => {
  it('rolls over to the next day at 18:30 UTC (00:00 IST)', () => {
    expect(istDateString(new Date('2026-11-24T18:29:59Z'))).toBe('2026-11-24');
    expect(istDateString(new Date('2026-11-24T18:30:00Z'))).toBe('2026-11-25');
  });

  it('handles month and year boundaries', () => {
    expect(istDateString(new Date('2026-12-31T18:30:00Z'))).toBe('2027-01-01');
  });
});

describe('countdown to next IST midnight', () => {
  it('is 24h exactly at IST midnight', () => {
    expect(msUntilNextIstMidnight(new Date('2026-11-24T18:30:00Z'))).toBe(24 * HOUR);
  });

  it('is one second just before IST midnight', () => {
    expect(msUntilNextIstMidnight(new Date('2026-11-24T18:29:59Z'))).toBe(1000);
  });

  it('is 18h30m at UTC midnight (which is 05:30 IST)', () => {
    expect(msUntilNextIstMidnight(new Date('2026-11-25T00:00:00Z'))).toBe(18.5 * HOUR);
  });

  it('formats as HH:MM:SS', () => {
    expect(formatCountdown(0)).toBe('00:00:00');
    expect(formatCountdown(5.5 * HOUR + 15_999)).toBe('05:30:15');
    expect(formatCountdown(24 * HOUR)).toBe('24:00:00');
    expect(formatCountdown(-5)).toBe('00:00:00');
  });
});
