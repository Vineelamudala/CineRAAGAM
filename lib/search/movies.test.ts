import { describe, expect, it } from 'vitest';
import { findSimilarMovies, normalizeTitle, searchMovies, spellingKey, type MovieOption } from './movies';

const catalog: MovieOption[] = [
  { id: 'rrr', title: 'RRR' },
  { id: 'avpl', title: 'Ala Vaikunthapurramuloo', aliases: ['AVPL'] },
  { id: 'jersey', title: 'Jersey' },
  { id: 'hi-nanna', title: 'Hi Nanna' },
  { id: 'nannaku', title: 'Nannaku Prematho' },
  { id: 'magadheera', title: 'Magadheera' },
];
const ids = (q: string) => searchMovies(q, catalog).map(m => m.id);

describe('normalizeTitle', () => {
  it('ignores case, spaces, dots and accents', () => {
    expect(normalizeTitle('R.R.R')).toBe('rrr');
    expect(normalizeTitle('r r r')).toBe('rrr');
    expect(normalizeTitle('Café')).toBe('cafe');
  });
});

describe('searchMovies', () => {
  it('returns nothing for an empty query', () => {
    expect(ids('')).toEqual([]);
    expect(ids('  . ')).toEqual([]);
  });

  it('matches only title prefixes for a single letter', () => {
    expect(ids('j')).toEqual(['jersey']);
    expect(ids('r')).toEqual(['rrr']);
  });

  it('matches anywhere in the title from two letters, prefix matches first', () => {
    expect(ids('nanna')).toEqual(['nannaku', 'hi-nanna']);
  });

  it('matches regardless of punctuation and spacing', () => {
    expect(ids('r.r.r')).toEqual(['rrr']);
    expect(ids('hinanna')).toEqual(['hi-nanna']);
  });

  it('matches aliases', () => {
    expect(ids('avpl')).toEqual(['avpl']);
  });

  it('respects the result limit', () => {
    expect(searchMovies('a', catalog, 1)).toHaveLength(1);
  });

  it('finds spelling variants, ranked after exact matches', () => {
    const list: MovieOption[] = [
      { id: 'sarrainodu', title: 'Sarrainodu' },
      { id: 'athidhi', title: 'Athidhi' },
      { id: 'sardar', title: 'Sardar Gabbar Singh' },
    ];
    const find = (q: string) => searchMovies(q, list).map(m => m.id);
    expect(find('sarainodu')).toEqual(['sarrainodu']);
    expect(find('Saraino')).toEqual(['sarrainodu']);
    expect(find('athidi')).toEqual(['athidhi']);
    expect(find('sar')).toEqual(['sardar', 'sarrainodu']); // exact prefix both; alphabetical
  });

  it('does not use the loose key for very short queries', () => {
    expect(ids('rrr')).toEqual(['rrr']); // loose key "r" would match everything with r
  });
});

describe('findSimilarMovies', () => {
  const list: MovieOption[] = [
    { id: 'a', title: 'Sarainodu', year: 2016 },
    { id: 'b', title: 'Athidhi', year: 2007, aliases: ['Atithi'] },
    { id: 'c', title: 'Sardar Gabbar Singh', year: 2016 },
  ];
  it('warns about other spellings of the same name, including aliases', () => {
    expect(findSimilarMovies('Sarrainodu', list).map(m => m.id)).toEqual(['a']);
    expect(findSimilarMovies('athiti', list).map(m => m.id)).toEqual(['b']);
  });
  it('stays quiet for a genuinely new title', () => {
    expect(findSimilarMovies('Pushpa', list)).toEqual([]);
    expect(findSimilarMovies('...', list)).toEqual([]);
  });
});

describe('spellingKey', () => {
  it('treats common transliteration variants as the same name', () => {
    const same = [
      ['Sarrainodu', 'Sarainodu'],
      ['Athidhi', 'Athidi'],
      ['Andarivaadu', 'Andarivadu'],
      ['Aadavaallu Meeku Johaarlu', 'Aadavallu Meeku Joharlu'],
      ['Anta Mana Manchike', 'Antha Mana Manchike'],
      ['Bhakta Prahlada', 'Bhaktha Prahlada'],
      ['Veera', 'Vira'],
      ['Vishwa', 'Vishva'],
      ['Shiva', 'Siva'],
    ];
    for (const [a, b] of same) expect(spellingKey(a), `${a} vs ${b}`).toBe(spellingKey(b));
  });

  it('gives exactly the same key as the database (private.spelling_key)', () => {
    expect(spellingKey('Aadavaallu Meeku Johaarlu')).toBe('adavalumikujoharlu');
    expect(spellingKey('R.R.R.')).toBe('r');
  });

  it('keeps different titles apart', () => {
    expect(spellingKey('Baahubali 2')).not.toBe(spellingKey('Baahubali'));
    expect(spellingKey('118')).not.toBe(spellingKey('1134'));
    expect(spellingKey('Jersey')).not.toBe(spellingKey('Jersy Boys'));
  });
});
