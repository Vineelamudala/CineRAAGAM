/**
 * Cineraagam game rules (single source of truth for the UI).
 *
 * Each daily movie has three clues that get easier:
 *   clue 1 = Hard (3 points), clue 2 = Medium (2), clue 3 = Easy (1).
 * Not solving the movie earns 0 points.
 *
 * NOTE: the database computes official points server-side (Phase 2).
 * These helpers only describe the rules for display and for client-side
 * state; the browser is never trusted to report points.
 */

export const TOTAL_CLUES = 3;

export type ClueNumber = 1 | 2 | 3;
export type ClueDifficulty = 'Hard' | 'Medium' | 'Easy';

export const CLUES: ReadonlyArray<{ number: ClueNumber; difficulty: ClueDifficulty; points: number }> = [
  { number: 1, difficulty: 'Hard', points: 3 },
  { number: 2, difficulty: 'Medium', points: 2 },
  { number: 3, difficulty: 'Easy', points: 1 },
];

export function clueInfo(clue: ClueNumber) {
  return CLUES[clue - 1];
}

/** Points for a finished game. `solvedOnClue` is null when the movie was not guessed. */
export function pointsFor(solvedOnClue: ClueNumber | null): number {
  return solvedOnClue === null ? 0 : clueInfo(solvedOnClue).points;
}

export function isClueNumber(n: number): n is ClueNumber {
  return n === 1 || n === 2 || n === 3;
}
