export type MovieOption = {
  id: string;
  title: string;
  year?: number;
  /** Alternate names players may type, e.g. "AVPL". */
  aliases?: string[];
};

/**
 * Normalise a title for matching: lower-case, strip accents, and drop
 * everything that is not a letter or digit, so "R.R.R", "r r r" and "RRR"
 * are all "rrr".
 */
export function normalizeTitle(text: string): string {
  return text
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '');
}

/**
 * Autocomplete search. One character matches title/alias prefixes only (to
 * keep the list useful); two or more characters match anywhere. Prefix
 * matches rank first, then alphabetical.
 */
export function searchMovies(query: string, catalog: readonly MovieOption[], limit = 8): MovieOption[] {
  const q = normalizeTitle(query);
  if (!q) return [];

  const scored: { movie: MovieOption; rank: number }[] = [];
  for (const movie of catalog) {
    const names = [movie.title, ...(movie.aliases ?? [])].map(normalizeTitle);
    let rank = -1;
    if (names.some(n => n.startsWith(q))) rank = 0;
    else if (q.length >= 2 && names.some(n => n.includes(q))) rank = 1;
    if (rank >= 0) scored.push({ movie, rank });
  }

  return scored
    .sort((a, b) => a.rank - b.rank || a.movie.title.localeCompare(b.movie.title))
    .slice(0, limit)
    .map(s => s.movie);
}
