import { describe, expect, it } from 'vitest';
import { matchKey, parseBindings } from './wikidata';

const uri = (q: string) => ({ type: 'uri', value: `http://www.wikidata.org/entity/${q}` });
const lit = (v: string) => ({ type: 'literal', value: v });

describe('parseBindings', () => {
  it('extracts QID, title, year and IMDb id', () => {
    expect(parseBindings([{ film: uri('Q60738148'), title: lit(' Jersey '), year: lit('2019'), imdbId: lit('tt8948790') }]))
      .toEqual([{ wikidata_id: 'Q60738148', title: 'Jersey', release_year: 2019, imdb_id: 'tt8948790' }]);
  });

  it('tolerates missing year and IMDb id', () => {
    expect(parseBindings([{ film: uri('Q1'), title: lit('Old Film') }]))
      .toEqual([{ wikidata_id: 'Q1', title: 'Old Film', release_year: null, imdb_id: null }]);
  });

  it('drops rows without a usable title and rejects bad values', () => {
    expect(parseBindings([
      { film: uri('Q2'), title: lit('Q2') },
      { film: uri('Q3') },
      { film: uri('Q4'), title: lit('Fine'), year: lit('1800'), imdbId: lit('nm123') },
    ])).toEqual([{ wikidata_id: 'Q4', title: 'Fine', release_year: null, imdb_id: null }]);
  });

  it('de-duplicates by QID', () => {
    expect(parseBindings([{ film: uri('Q5'), title: lit('A') }, { film: uri('Q5'), title: lit('A') }])).toHaveLength(1);
  });
});

describe('matchKey', () => {
  it('ignores case and punctuation but keeps the year', () => {
    expect(matchKey('R.R.R', 2022)).toBe(matchKey('rrr', 2022));
    expect(matchKey('Jersey', 2019)).not.toBe(matchKey('Jersey', null));
  });
});
