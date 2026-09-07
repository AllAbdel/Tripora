import { describe, expect, it } from 'vitest';
import { ORIGINS, searchOrigins } from './origins.js';

describe('villes de départ', () => {
  it('couvre la France et l’Europe sans doublon de nom', () => {
    const names = ORIGINS.map((place) => place.name);
    expect(new Set(names).size).toBe(names.length);
    expect(ORIGINS.length).toBeGreaterThan(70);
    expect(names).toContain('Toulouse');
    expect(names).toContain('Berlin');
  });

  it('a des coordonnées et au moins un aéroport partout', () => {
    for (const place of ORIGINS) {
      expect(Number.isFinite(place.lat), place.name).toBe(true);
      expect(Number.isFinite(place.lng), place.name).toBe(true);
      expect(place.iata?.length ?? 0, place.name).toBeGreaterThan(0);
    }
  });

  it('trouve une ville sans se soucier des accents ni de la casse', () => {
    expect(searchOrigins('nimes')[0]?.name).toBe('Nîmes');
    expect(searchOrigins('SAINT-ET')[0]?.name).toBe('Saint-Étienne');
    expect(searchOrigins('édim')[0]?.name).toBe('Édimbourg');
  });

  it('remonte d’abord les villes qui commencent par la saisie', () => {
    // « or » ouvre Oran et Orléans, mais n'est qu'au milieu de Bordeaux : les
    // deux premières doivent passer devant, quel que soit leur ordre entre
    // elles. Nommer la gagnante rendrait le test otage du catalogue.
    const noms = searchOrigins('or', 30).map((place) => place.name);
    expect(noms[0]).toMatch(/^Or/);
    expect(noms.indexOf('Orléans')).toBeLessThan(noms.indexOf('Bordeaux'));
  });

  it('propose quelque chose même sur une saisie vide', () => {
    expect(searchOrigins('').length).toBeGreaterThan(0);
    expect(searchOrigins('zzzzzz')).toHaveLength(0);
  });
});
