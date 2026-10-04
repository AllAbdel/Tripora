import { describe, expect, it } from 'vitest';
import { ORIGINS, nearestAirports, searchOrigins } from './origins.js';

describe('aéroports comme points de départ', () => {
  it('propose Orly et Roissy séparément, pas seulement « Paris »', () => {
    // Le manque signalé : on ne pouvait choisir que « Paris », alors qu'entre
    // Orly et Roissy il y a une heure de trajet et deux voyages différents.
    const noms = searchOrigins('Paris', 10).map((place) => place.name);
    expect(noms).toContain('Paris');
    expect(noms).toContain('Paris-Orly');
    expect(noms).toContain('Paris-Charles-de-Gaulle');
    expect(noms).toContain('Paris-Beauvais');
  });

  it('porte le bon code sur chaque aéroport', () => {
    const orly = ORIGINS.find((place) => place.name === 'Paris-Orly');
    expect(orly?.iata?.[0]).toBe('ORY');
    // Le code de ville reste en second : c'est lui qu'interrogent les bases de
    // prix, et sans lui on perdrait la moitié des tarifs.
    expect(orly?.iata).toContain('PAR');
  });

  it('place chaque aéroport là où il est vraiment', () => {
    // Orly est au sud, Roissy au nord : si les deux étaient au même endroit,
    // l'erreur passerait inaperçue partout sauf sur la carte.
    const orly = ORIGINS.find((place) => place.name === 'Paris-Orly')!;
    const cdg = ORIGINS.find((place) => place.name === 'Paris-Charles-de-Gaulle')!;
    expect(orly.lat).toBeLessThan(cdg.lat);
  });

  it('ne rattache jamais une ville inconnue à un aéroport', () => {
    // « Partir de Colmar, vols au départ de Bâle » se comprend. « Vols au
    // départ de Bâle-Mulhouse » pour quelqu'un qui habite Colmar ne dit rien
    // de plus et sonne faux : on rattache à des villes.
    const colmar = nearestAirports({ lat: 48.0794, lng: 7.3585 });
    expect(colmar).toBeDefined();
    expect(colmar!.ville).not.toContain('-Mulhouse');
    for (const point of [
      { lat: 48.8566, lng: 2.3522 },
      { lat: 45.764, lng: 4.8357 },
      { lat: 50.6292, lng: 3.0573 },
    ]) {
      const proche = nearestAirports(point);
      expect(proche?.ville).not.toMatch(/-(Orly|Charles-de-Gaulle|Beauvais|Heathrow|Gatwick)$/u);
    }
  });

  it('n’a pas deux fois le même point de départ', () => {
    const noms = ORIGINS.map((place) => place.name);
    expect(new Set(noms).size).toBe(noms.length);
  });
});
