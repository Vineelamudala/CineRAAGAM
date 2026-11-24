import { describe, expect, it } from 'vitest';
import { gamePoints, gameReducer, initialGameState, solvedOnClue, type GameAction, type GameState } from './state';

const play = (...actions: GameAction[]): GameState => actions.reduce(gameReducer, initialGameState);

describe('game state machine', () => {
  it('starts on clue 1 and playing', () => {
    expect(initialGameState).toEqual({ clue: 1, results: [], status: 'playing' });
  });

  it('a correct first guess wins with 3 points and ends the game', () => {
    const s = play({ type: 'guess', clue: 1, correct: true });
    expect(s.status).toBe('won');
    expect(solvedOnClue(s)).toBe(1);
    expect(gamePoints(s)).toBe(3);
  });

  it('a wrong guess unlocks the next clue', () => {
    const s = play({ type: 'guess', clue: 1, correct: false });
    expect(s).toEqual({ clue: 2, results: ['wrong'], status: 'playing' });
  });

  it('a skip unlocks the next clue', () => {
    const s = play({ type: 'skip', clue: 1 });
    expect(s).toEqual({ clue: 2, results: ['skipped'], status: 'playing' });
  });

  it('solving on clue 2 earns 2 points, on clue 3 earns 1 point', () => {
    const two = play({ type: 'skip', clue: 1 }, { type: 'guess', clue: 2, correct: true });
    expect(gamePoints(two)).toBe(2);
    const three = play({ type: 'skip', clue: 1 }, { type: 'guess', clue: 2, correct: false }, { type: 'guess', clue: 3, correct: true });
    expect(gamePoints(three)).toBe(1);
    expect(three.results).toEqual(['skipped', 'wrong', 'correct']);
  });

  it('three unsuccessful clues reveal the movie with 0 points', () => {
    const s = play({ type: 'guess', clue: 1, correct: false }, { type: 'skip', clue: 2 }, { type: 'guess', clue: 3, correct: false });
    expect(s.status).toBe('lost');
    expect(s.clue).toBe(3);
    expect(solvedOnClue(s)).toBeNull();
    expect(gamePoints(s)).toBe(0);
  });

  it('allows only one guess per clue (duplicate or stale submissions are ignored)', () => {
    const afterFirst = play({ type: 'guess', clue: 1, correct: false });
    const duplicate = gameReducer(afterFirst, { type: 'guess', clue: 1, correct: true });
    expect(duplicate).toBe(afterFirst);
  });

  it('cannot skip ahead to a clue that is not unlocked', () => {
    expect(gameReducer(initialGameState, { type: 'guess', clue: 2, correct: true })).toBe(initialGameState);
  });

  it('ignores every action after the game is finished', () => {
    const won = play({ type: 'guess', clue: 1, correct: true });
    expect(gameReducer(won, { type: 'skip', clue: 1 })).toBe(won);
    const lost = play({ type: 'skip', clue: 1 }, { type: 'skip', clue: 2 }, { type: 'skip', clue: 3 });
    expect(gameReducer(lost, { type: 'guess', clue: 3, correct: true })).toBe(lost);
  });

  it('reset returns to the initial state', () => {
    const won = play({ type: 'guess', clue: 1, correct: true });
    expect(gameReducer(won, { type: 'reset' })).toEqual(initialGameState);
  });
});
