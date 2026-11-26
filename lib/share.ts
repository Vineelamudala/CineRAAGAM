import { TOTAL_CLUES, type ClueResult } from './game/rules';

const MARK: Record<ClueResult, string> = { correct: '🟩', wrong: '🟥', skipped: '⬛' };
const UNUSED = '⬜';

/**
 * Spoiler-free share text: it shows how the player did on each clue but
 * never the movie, the guesses, or anything that hints at the answer.
 * Time Travel games have no points, so none are mentioned.
 */
export function buildShareText(opts: {
  challengeNumber: number;
  results: readonly ClueResult[];
  points: number;
  streak?: number;
  timeTravel?: boolean;
  url?: string;
}): string {
  const { challengeNumber, results, points, streak, timeTravel = false, url } = opts;
  const squares = Array.from({ length: TOTAL_CLUES }, (_, i) => (results[i] ? MARK[results[i]] : UNUSED)).join('');
  const solved = results.includes('correct');
  const headline = timeTravel
    ? solved ? `Solved on clue ${results.length}/${TOTAL_CLUES} · Time Travel` : 'Not solved · Time Travel'
    : solved
      ? `Solved on clue ${results.length}/${TOTAL_CLUES} · ${points} ${points === 1 ? 'point' : 'points'}`
      : 'Not solved today · 0 points';
  const streakLine = !timeTravel && streak && streak > 1 ? `🔥 ${streak}-day streak` : undefined;
  return [`🎵 Cineraagam #${challengeNumber}`, squares, headline, streakLine, url].filter(Boolean).join('\n');
}

/**
 * Share links for social apps. X and WhatsApp accept the whole message;
 * Facebook only accepts a link (it no longer allows pre-filled text).
 */
export function shareLinks(text: string, url: string): { x: string; whatsapp: string; facebook: string } {
  return {
    x: `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`,
    whatsapp: `https://wa.me/?text=${encodeURIComponent(text)}`,
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
  };
}
