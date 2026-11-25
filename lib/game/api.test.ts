import { describe, expect, it } from 'vitest';
import { parseCatalog } from './api';

describe('parseCatalog', () => {
  it('expands the compact catalogue format', () => {
    expect(parseCatalog([
      ['a', 'Jersey', 2019],
      ['b', 'Ala Vaikunthapurramuloo', 2020, ['AVPL']],
      ['c', 'Old Film', null],
    ])).toEqual([
      { id: 'a', title: 'Jersey', year: 2019, aliases: [] },
      { id: 'b', title: 'Ala Vaikunthapurramuloo', year: 2020, aliases: ['AVPL'] },
      { id: 'c', title: 'Old Film', year: undefined, aliases: [] },
    ]);
  });
});
