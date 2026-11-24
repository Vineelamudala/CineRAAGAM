/**
 * India Standard Time helpers. IST is a fixed UTC+05:30 offset with no
 * daylight saving, so plain arithmetic is exact. A new daily challenge
 * starts at 00:00 IST.
 */

export const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** The IST calendar date ("YYYY-MM-DD") for an instant. */
export function istDateString(now: Date | number): string {
  const shifted = new Date(+now + IST_OFFSET_MS);
  return shifted.toISOString().slice(0, 10);
}

/** Milliseconds from `now` until the next 00:00 IST. Always in (0, 24h]. */
export function msUntilNextIstMidnight(now: Date | number): number {
  const istMs = +now + IST_OFFSET_MS;
  const sinceMidnight = ((istMs % DAY_MS) + DAY_MS) % DAY_MS;
  return DAY_MS - sinceMidnight;
}

/** Format a duration as HH:MM:SS (hours are not wrapped). */
export function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return [h, m, s].map(n => String(n).padStart(2, '0')).join(':');
}
