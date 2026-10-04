import { describe, expect, it } from 'vitest';
import { decomptesDepuisLaBase } from './sondages';

describe('le décompte des sondages secrets', () => {
  it('ne donne que le nombre de votants tant que le sondage est ouvert', () => {
    const decomptes = decomptesDepuisLaBase([
      { sondage_id: 's1', option_id: 'a', voix: null, votants: 3 },
      { sondage_id: 's1', option_id: 'b', voix: null, votants: 3 },
    ]);
    expect(decomptes.get('s1')).toEqual({ votants: 3, voix: null });
  });

  it('donne les voix de chaque option une fois clos, sondage par sondage', () => {
    const decomptes = decomptesDepuisLaBase([
      { sondage_id: 's1', option_id: 'a', voix: 2, votants: 3 },
      { sondage_id: 's1', option_id: 'b', voix: 1, votants: 3 },
      { sondage_id: 's2', option_id: 'c', voix: null, votants: 1 },
    ]);
    expect(decomptes.get('s1')).toEqual({ votants: 3, voix: { a: 2, b: 1 } });
    expect(decomptes.get('s2')).toEqual({ votants: 1, voix: null });
  });
});
