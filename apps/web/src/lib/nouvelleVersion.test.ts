import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { estUnMorceauPerdu, rechargerPourLaNouvelleVersion } from './nouvelleVersion';

const recharger = vi.fn();

beforeEach(() => {
  sessionStorage.clear();
  recharger.mockReset();
  vi.stubGlobal('location', { ...window.location, reload: recharger });
});

afterEach(() => vi.unstubAllGlobals());

describe('une nouvelle version publiée pendant que la page était ouverte', () => {
  it('reconnaît un morceau de code introuvable, dans chaque navigateur', () => {
    // Le message relevé en production, sur /conditions.
    expect(
      estUnMorceauPerdu(new TypeError('Failed to fetch dynamically imported module: https://tripora-3rg.pages.dev/assets/Conditions-DfWGkcjC.js')),
    ).toBe(true);
    expect(estUnMorceauPerdu(new TypeError('Importing a module script failed.'))).toBe(true);
    expect(estUnMorceauPerdu(new Error('error loading dynamically imported module'))).toBe(true);
    expect(estUnMorceauPerdu(new Error('Cannot read properties of undefined'))).toBe(false);
    expect(estUnMorceauPerdu(undefined)).toBe(false);
  });

  it('recharge une fois, pas deux de suite : pas de boucle si le fichier manque vraiment', () => {
    expect(rechargerPourLaNouvelleVersion(1_000_000)).toBe(true);
    expect(recharger).toHaveBeenCalledTimes(1);
    expect(rechargerPourLaNouvelleVersion(1_030_000)).toBe(false);
    expect(recharger).toHaveBeenCalledTimes(1);
    // Une minute plus tard, une autre publication peut à nouveau recharger.
    expect(rechargerPourLaNouvelleVersion(1_070_000)).toBe(true);
    expect(recharger).toHaveBeenCalledTimes(2);
  });
});
