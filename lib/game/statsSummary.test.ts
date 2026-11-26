import { describe, expect, it } from 'vitest';
import { avgCluesToSolve, avgPoints } from './statsSummary';

describe('avgCluesToSolve', () => {
  it('is null before the first win', () => {
    expect(avgCluesToSolve({ '1': 0, '2': 0, '3': 0, missed: 4 })).toBeNull();
  });

  it('averages the clue number of wins only (misses ignored)', () => {
    expect(avgCluesToSolve({ '1': 1, '2': 0, '3': 0, missed: 5 })).toBe(1);
    expect(avgCluesToSolve({ '1': 2, '2': 1, '3': 1, missed: 0 })).toBe(1.8); // (2+2+3)/4 = 1.75 → 1.8
  });
});

describe('avgPoints', () => {
  it('is null before any game', () => {
    expect(avgPoints(0, 0)).toBeNull();
  });

  it('includes misses as 0 and rounds to one decimal', () => {
    expect(avgPoints(3, 1)).toBe(3);
    expect(avgPoints(10, 6)).toBe(1.7);
  });
});
