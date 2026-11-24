import { TOTAL_CLUES, type ClueResult } from './game/rules';

const MARK: Record<ClueResult, string> = { correct: '🟩', wrong: '🟥', skipped: '⬛' };
const UNUSED = '⬜';

/**
 * Spoiler-free share text: it shows how the player did on each clue but
 * never the movie, the guesses, or anything that hints at the answer.
 */
export function buildShareText(opts: {
  challengeNumber: number;
  results: readonly ClueResult[];
  points: number;
  streak?: number;
  url?: string;
}): string {
  const { challengeNumber, results, points, streak, url } = opts;
  const squares = Array.from({ length: TOTAL_CLUES }, (_, i) => (results[i] ? MARK[results[i]] : UNUSED)).join('');
  const solved = results.includes('correct');
  const headline = solved
    ? `Solved on clue ${results.length}/${TOTAL_CLUES} · ${points} ${points === 1 ? 'point' : 'points'}`
    : `Not solved today · 0 points`;
  const streakLine = streak && streak > 1 ? `🔥 ${streak}-day streak` : undefined;
  return [`🎵 Cineraagam #${challengeNumber}`, squares, headline, streakLine, url].filter(Boolean).join('\n');
}
