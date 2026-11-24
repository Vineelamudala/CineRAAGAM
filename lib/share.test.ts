import { describe, expect, it } from 'vitest';
import { buildShareText } from './share';

describe('buildShareText', () => {
  it('shows per-clue results and points for a win', () => {
    expect(buildShareText({ challengeNumber: 24, results: ['wrong', 'correct'], points: 2 })).toBe(
      '🎵 Cineraagam #24\n🟥🟩⬜\nSolved on clue 2/3 · 2 points',
    );
  });

  it('uses singular "point" for a third-clue solve', () => {
    expect(buildShareText({ challengeNumber: 1, results: ['skipped', 'wrong', 'correct'], points: 1 })).toContain('1 point');
  });

  it('handles a loss', () => {
    expect(buildShareText({ challengeNumber: 3, results: ['wrong', 'skipped', 'wrong'], points: 0, url: 'https://example.org' })).toBe(
      '🎵 Cineraagam #3\n🟥⬛🟥\nNot solved today · 0 points\nhttps://example.org',
    );
  });

  it('never contains the movie title', () => {
    const text = buildShareText({ challengeNumber: 24, results: ['correct'], points: 3 });
    expect(text.toLowerCase()).not.toContain('jersey');
  });
});
