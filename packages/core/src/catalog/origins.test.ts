import { describe, expect, it } from 'vitest';
import { nearestAirports, ORIGINS, searchOrigins } from './origins.js';

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
  it('rattache un point quelconque aux aéroports qui le desservent', () => {
    // Colmar n'est pas dans la liste et n'a pas d'aéroport : sans
    // rattachement, aucun prix de vol ne serait relevé pour un départ de là.
    const colmar = nearestAirports({ lat: 48.0794, lng: 7.3585 });
    expect(colmar).toBeDefined();
    expect(colmar!.km).toBeLessThan(150);
    expect(colmar!.iata.length).toBeGreaterThan(0);
    // La ville de rattachement est renvoyée pour être affichée : « vols au
    // départ de X » doit être vérifiable, pas deviné.
    expect(colmar!.ville).toBeTruthy();
  });

  it('préfère la ville la plus proche', () => {
    const proche = nearestAirports({ lat: 48.8566, lng: 2.3522 })!;
    expect(proche.ville).toBe('Paris');
    expect(proche.km).toBe(0);
  });

  it('ne rattache rien au milieu de l’océan', () => {
    // Un prix relevé à quatre cents kilomètres n'est pas un prix : mieux vaut
    // que l'écran dise qu'il n'en a pas.
    expect(nearestAirports({ lat: 0, lng: -30 })).toBeUndefined();
    expect(nearestAirports({ lat: 48.8566, lng: 2.3522 }, 0.5)?.ville).toBe('Paris');
  });
});
