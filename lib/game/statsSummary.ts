import type { MyStats } from './api';

/** Average clue number on which the player solves (1 = always on the hard clue). Null before any win. */
export function avgCluesToSolve(dist: MyStats['distribution']): number | null {
  const won = dist['1'] + dist['2'] + dist['3'];
  if (won === 0) return null;
  return Math.round(((dist['1'] * 1 + dist['2'] * 2 + dist['3'] * 3) / won) * 10) / 10;
}

/** Average points per finished daily game (misses count as 0). Null before any game. */
export function avgPoints(totalPoints: number, played: number): number | null {
  if (played === 0) return null;
  return Math.round((totalPoints / played) * 10) / 10;
}
