import { describe, expect, it } from 'vitest';
import { CLUES, clueInfo, pointsFor } from './rules';

describe('points rules', () => {
  it('awards 3 / 2 / 1 points for solving on clue 1 / 2 / 3', () => {
    expect(pointsFor(1)).toBe(3);
    expect(pointsFor(2)).toBe(2);
    expect(pointsFor(3)).toBe(1);
  });

  it('awards 0 points when the movie is not solved', () => {
    expect(pointsFor(null)).toBe(0);
  });

  it('orders clues from hard to easy', () => {
    expect(CLUES.map(c => c.difficulty)).toEqual(['Hard', 'Medium', 'Easy']);
    expect(clueInfo(1).difficulty).toBe('Hard');
    expect(clueInfo(3).difficulty).toBe('Easy');
  });
});
