import { describe, expect, it } from 'vitest';
import { climateFor, climateYear, hasClimate } from './climate.js';
import { DESTINATIONS } from './destinations.js';

describe('normales climatiques', () => {
  it('couvre les douze mois de chaque destination du catalogue', () => {
    for (const destination of DESTINATIONS) {
      expect(hasClimate(destination.id), destination.id).toBe(true);
      expect(climateYear(destination.id), destination.id).toHaveLength(12);
    }
  });

  it('refuse un mois hors calendrier et une ville inconnue', () => {
    expect(climateFor('lisbonne', 0)).toBeUndefined();
    expect(climateFor('lisbonne', 13)).toBeUndefined();
    expect(climateFor('atlantide', 7)).toBeUndefined();
    expect(hasClimate('atlantide')).toBe(false);
  });

  it('reste physiquement plausible partout', () => {
    for (const destination of DESTINATIONS) {
      for (const mois of climateYear(destination.id)) {
        const ou = `${destination.id} mois ${mois.month}`;
        expect(mois.avgLowC, ou).toBeLessThanOrEqual(mois.avgHighC);
        expect(mois.avgHighC, ou).toBeGreaterThan(-30);
        expect(mois.avgHighC, ou).toBeLessThan(50);
        expect(mois.rainyDays, ou).toBeGreaterThanOrEqual(0);
        expect(mois.rainyDays, ou).toBeLessThanOrEqual(31);
      }
    }
  });

  it('place l’été au bon endroit de l’année dans l’hémisphère nord', () => {
    // Tout le catalogue est au nord : juillet doit y être plus chaud que janvier.
    for (const destination of DESTINATIONS) {
      const janvier = climateFor(destination.id, 1)!;
      const juillet = climateFor(destination.id, 7)!;
      expect(juillet.avgHighC, destination.id).toBeGreaterThan(janvier.avgHighC);
    }
  });

  it('retrouve des faits connus, pas une saisonnalité devinée', () => {
    // Ces valeurs viennent des archives Open-Meteo 2023-2025. Elles servent de
    // témoin : si le fichier est régénéré de travers, ce test le voit.
    const sevilleJuillet = climateFor('seville', 7)!;
    expect(sevilleJuillet.avgHighC).toBeGreaterThan(34);
    expect(sevilleJuillet.rainyDays).toBeLessThanOrEqual(1);

    const reykjavikJanvier = climateFor('reykjavik', 1)!;
    expect(reykjavikJanvier.avgHighC).toBeLessThan(5);
    expect(reykjavikJanvier.rainyDays).toBeGreaterThan(10);

    const marrakechAout = climateFor('marrakech', 8)!;
    expect(marrakechAout.avgHighC).toBeGreaterThan(36);
  });
});
