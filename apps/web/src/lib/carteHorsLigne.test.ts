import { describe, expect, it } from 'vitest';
import { depuisLeProtocole, poidsAnnonce, versLeProtocole } from './carteHorsLigne';

describe('la carte gardée sur l’appareil', () => {
  it('ne détourne que les adresses du serveur de cartes, et sait revenir en arrière', () => {
    const tuile = 'https://tiles.openfreemap.org/planet/20260927_080001_pt/14/7776/6277.pbf';
    const detournee = versLeProtocole(tuile);
    expect(detournee).toBe('tripora-carte://tiles.openfreemap.org/planet/20260927_080001_pt/14/7776/6277.pbf');
    expect(depuisLeProtocole(detournee!)).toBe(tuile);
    // Les photos, le serveur de Tripora : jamais.
    expect(versLeProtocole('https://upload.wikimedia.org/a.jpg')).toBeNull();
    expect(versLeProtocole('https://eelvllvgnsohznconfpt.supabase.co/rest/v1/trips')).toBeNull();
  });

  it('annonce un poids raisonnable pour une ville', () => {
    const poids = poidsAnnonce({ id: 'lisbonne', name: 'Lisbonne', lat: 38.7223, lng: -9.1393 });
    expect(poids).toBeGreaterThanOrEqual(5 * 1024 * 1024);
    expect(poids).toBeLessThanOrEqual(30 * 1024 * 1024);
  });
});
