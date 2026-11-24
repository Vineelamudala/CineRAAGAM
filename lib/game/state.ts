import { TOTAL_CLUES, type ClueNumber, pointsFor } from './rules';

/**
 * Client-side game state machine. In Phase 2 the authoritative state lives in
 * Postgres and this reducer only mirrors what the server returns, but the
 * transition rules are identical:
 *   - one guess per clue
 *   - a correct guess ends the game
 *   - a wrong guess or a skip unlocks the next clue
 *   - after the third unsuccessful clue the movie is revealed
 *   - nothing can change once the game is finished
 */

export type ClueResult = 'correct' | 'wrong' | 'skipped';

export type GameState = {
  /** Clue currently being played (the last clue reached once finished). */
  clue: ClueNumber;
  /** Result for each clue already used, in order. */
  results: ClueResult[];
  status: 'playing' | 'won' | 'lost';
};

export type GameAction =
  | { type: 'guess'; clue: ClueNumber; correct: boolean }
  | { type: 'skip'; clue: ClueNumber }
  | { type: 'reset' };

export const initialGameState: GameState = { clue: 1, results: [], status: 'playing' };

export function gameReducer(state: GameState, action: GameAction): GameState {
  if (action.type === 'reset') return initialGameState;
  if (state.status !== 'playing') return state;
  // Reject stale or duplicate submissions for a clue that is no longer current.
  if (action.clue !== state.clue) return state;

  const result: ClueResult = action.type === 'skip' ? 'skipped' : action.correct ? 'correct' : 'wrong';
  const results = [...state.results, result];

  if (result === 'correct') return { clue: state.clue, results, status: 'won' };
  if (state.clue >= TOTAL_CLUES) return { clue: state.clue, results, status: 'lost' };
  return { clue: (state.clue + 1) as ClueNumber, results, status: 'playing' };
}

export function solvedOnClue(state: GameState): ClueNumber | null {
  return state.status === 'won' ? state.clue : null;
}

export function gamePoints(state: GameState): number {
  return pointsFor(solvedOnClue(state));
}
