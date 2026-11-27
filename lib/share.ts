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
  const clue = results.length;
  const pts = `${points} ${points === 1 ? 'point' : 'points'}`;
  const headline = timeTravel
    ? solved ? `I cracked this Time Travel movie on clue ${clue}/${TOTAL_CLUES} 🎬` : 'This Time Travel movie stumped me 😅'
    : !solved
      ? 'Today’s movie stumped me 😅'
      : clue === 1
        ? `I named today’s movie on the very first clue! ${pts} 🎯`
        : `I cracked today’s movie on clue ${clue}/${TOTAL_CLUES} · ${pts} 🎬`;
  const streakLine = !timeTravel && streak && streak > 1 ? `🔥 ${streak}-day streak` : undefined;
  // A challenge that makes sense for the result: nobody can beat a first-clue solve, only match it.
  const invite = !solved ? 'Can you guess it? 👇'
    : timeTravel ? 'Can you crack it? 👇'
    : clue === 1 ? 'Can you match that? 👇'
    : 'Can you get it in fewer clues? 👇';
  return [`🎵 Cineraagam #${challengeNumber}`, squares, headline, streakLine, invite, url, '#Cineraagam'].filter(Boolean).join('\n');
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
