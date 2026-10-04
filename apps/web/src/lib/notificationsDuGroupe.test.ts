import { describe, expect, it } from 'vitest';
import { CATEGORIES, REGLAGES_PAR_DEFAUT, reglagesDepuisLaBase } from './notificationsDuGroupe';

describe('les réglages des notifications du groupe', () => {
  it('ouvre tout tant qu’on n’a rien coupé', () => {
    expect(reglagesDepuisLaBase(null)).toEqual(REGLAGES_PAR_DEFAUT);
  });

  it('garde ce qui a été coupé, et ignore une valeur douteuse', () => {
    expect(reglagesDepuisLaBase({ discussion: false, depenses: 'non', decisions: true })).toEqual({
      discussion: false,
      depenses: true,
      decisions: true,
      groupe: true,
    });
  });

  it('présente chaque catégorie que la base connaît, une fois', () => {
    expect(CATEGORIES.map((categorie) => categorie.cle).sort()).toEqual(Object.keys(REGLAGES_PAR_DEFAUT).sort());
  });
});
