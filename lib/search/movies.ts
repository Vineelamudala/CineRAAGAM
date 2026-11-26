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
 * A looser key that ignores the usual spelling differences when Telugu titles
 * are written in English: "Sarrainodu" = "Sarainodu", "Athidhi" = "Athidi",
 * "Andarivaadu" = "Andarivadu", "Veera" = "Vira", "Vishwa" = "Vishva".
 * MUST stay identical to private.spelling_key() in the database
 * (supabase/migrations/20261126150000_spelling_variants.sql).
 */
export function spellingKey(text: string): string {
  return text
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .replace(/([bcdgjkpst])h/g, '$1') // th → t, dh → d, bh → b, sh → s …
    .replace(/w/g, 'v')
    .replace(/ee/g, 'i')
    .replace(/oo/g, 'u')
    .replace(/(.)\1+/g, '$1'); // doubled letters count once
}

/**
 * Movies that are probably the same film as `title` (any spelling of it, in
 * any year), for warning admins before they add a duplicate.
 */
export function findSimilarMovies(title: string, catalog: readonly MovieOption[]): MovieOption[] {
  const key = spellingKey(title);
  if (!key) return [];
  return catalog.filter(movie => namesOf(movie).loose.includes(key));
}

type Names = { exact: string[]; loose: string[] };
const namesCache = new WeakMap<MovieOption, Names>();
function namesOf(movie: MovieOption): Names {
  let names = namesCache.get(movie);
  if (!names) {
    const all = [movie.title, ...(movie.aliases ?? [])];
    names = { exact: all.map(normalizeTitle), loose: all.map(spellingKey) };
    namesCache.set(movie, names);
  }
  return names;
}

/**
 * Autocomplete search. One character matches title/alias prefixes only (to
 * keep the list useful); two or more characters match anywhere. Spelling
 * variants match too (from 3 letters). Ranking: exact prefix, spelling-variant
 * prefix, exact anywhere, spelling-variant anywhere; then alphabetical.
 */
export function searchMovies(query: string, catalog: readonly MovieOption[], limit = 8): MovieOption[] {
  const q = normalizeTitle(query);
  if (!q) return [];
  const loose = spellingKey(query);
  const useLoose = loose.length >= 3;

  const scored: { movie: MovieOption; rank: number }[] = [];
  for (const movie of catalog) {
    const { exact, loose: looseNames } = namesOf(movie);
    let rank = -1;
    if (exact.some(n => n.startsWith(q))) rank = 0;
    else if (useLoose && looseNames.some(n => n.startsWith(loose))) rank = 1;
    else if (q.length >= 2 && exact.some(n => n.includes(q))) rank = 2;
    else if (useLoose && looseNames.some(n => n.includes(loose))) rank = 3;
    if (rank >= 0) scored.push({ movie, rank });
  }

  return scored
    .sort((a, b) => a.rank - b.rank || a.movie.title.localeCompare(b.movie.title))
    .slice(0, limit)
    .map(s => s.movie);
}
