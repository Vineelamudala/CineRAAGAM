import { describe, expect, it } from 'vitest';
import { normalizeTitle, searchMovies, type MovieOption } from './movies';

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
});
