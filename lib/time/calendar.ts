/** Calendar helpers (dates are YYYY-MM-DD strings, treated as plain calendar days). */

export type MonthKey = `${number}-${string}`; // YYYY-MM

export const monthOf = (iso: string): MonthKey => iso.slice(0, 7) as MonthKey;

export function shiftMonth(month: MonthKey, delta: number): MonthKey {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return d.toISOString().slice(0, 7) as MonthKey;
}

/**
 * Weeks (Monday first) covering a month; days outside the month are null.
 * e.g. monthGrid('2026-11') → 6 rows of 7 cells.
 */
export function monthGrid(month: MonthKey): (string | null)[][] {
  const [y, m] = month.split('-').map(Number);
  const first = new Date(Date.UTC(y, m - 1, 1));
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const lead = (first.getUTCDay() + 6) % 7; // Monday = 0
  const cells: (string | null)[] = Array(lead).fill(null);
  for (let day = 1; day <= daysInMonth; day++) cells.push(`${month}-${String(day).padStart(2, '0')}`);
  while (cells.length % 7) cells.push(null);
  const weeks: (string | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

export const monthLabel = (month: MonthKey) =>
  new Date(`${month}-01T00:00:00Z`).toLocaleDateString('en-IN', { month: 'long', year: 'numeric', timeZone: 'UTC' });
