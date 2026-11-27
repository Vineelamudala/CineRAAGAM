import { describe, expect, it } from 'vitest';
import { buildShareText, shareLinks } from './share';

describe('buildShareText', () => {
  it('shows per-clue results, points and a challenge to friends for a win', () => {
    expect(buildShareText({ challengeNumber: 3, results: ['wrong', 'correct'], points: 2, url: 'https://cineraagam.vercel.app' })).toBe(
      '🎵 Cineraagam #3\n🟥🟩⬜\nI cracked today’s movie on clue 2/3 · 2 points 🎬\nThink you can beat me? 👇\nhttps://cineraagam.vercel.app',
    );
  });

  it('celebrates a first-clue solve', () => {
    expect(buildShareText({ challengeNumber: 7, results: ['correct'], points: 3 })).toContain('I named today’s movie on the very first clue! 3 points 🎯');
  });

  it('uses singular "point" for a third-clue solve', () => {
    expect(buildShareText({ challengeNumber: 1, results: ['skipped', 'wrong', 'correct'], points: 1 })).toContain('clue 3/3 · 1 point 🎬');
  });

  it('handles a loss', () => {
    expect(buildShareText({ challengeNumber: 3, results: ['wrong', 'skipped', 'wrong'], points: 0, url: 'https://example.org' })).toBe(
      '🎵 Cineraagam #3\n🟥⬛🟥\nToday’s movie stumped me 😅\nCan you guess it? 👇\nhttps://example.org',
    );
  });

  it('adds the streak when it is longer than one day', () => {
    expect(buildShareText({ challengeNumber: 9, results: ['correct'], points: 3, streak: 4 })).toContain('🔥 4-day streak');
    expect(buildShareText({ challengeNumber: 9, results: ['correct'], points: 3, streak: 1 })).not.toContain('streak');
  });

  it('never mentions points or streaks for Time Travel games', () => {
    const text = buildShareText({ challengeNumber: 5, results: ['wrong', 'correct'], points: 0, streak: 9, timeTravel: true });
    expect(text).toContain('I cracked this Time Travel movie on clue 2/3 🎬');
    expect(text).not.toMatch(/point|streak/);
    expect(buildShareText({ challengeNumber: 5, results: ['wrong', 'skipped', 'wrong'], points: 0, timeTravel: true })).toContain('This Time Travel movie stumped me 😅');
  });

  it('builds X, WhatsApp and Facebook share links', () => {
    const links = shareLinks('🎵 Cineraagam #4\n🟩⬜⬜', 'https://cineraagam.vercel.app');
    expect(links.x).toBe('https://twitter.com/intent/tweet?text=%F0%9F%8E%B5%20Cineraagam%20%234%0A%F0%9F%9F%A9%E2%AC%9C%E2%AC%9C');
    expect(decodeURIComponent(links.whatsapp.split('text=')[1])).toBe('🎵 Cineraagam #4\n🟩⬜⬜');
    expect(links.facebook).toBe('https://www.facebook.com/sharer/sharer.php?u=https%3A%2F%2Fcineraagam.vercel.app');
  });

  it('never contains the movie title', () => {
    const text = buildShareText({ challengeNumber: 24, results: ['correct'], points: 3 });
    expect(text.toLowerCase()).not.toContain('jersey');
  });
});
