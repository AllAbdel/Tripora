import { describe, expect, it } from 'vitest';
import { climateFor, climateFromSeries, climateYear, hasClimate } from './climate.js';
import { DESTINATIONS } from './destinations.js';

describe('normales climatiques', () => {
  it('donne douze mois ou aucun, jamais une année à trous', () => {
    // Une année incomplète ferait dire n'importe quoi à la note de climat : le
    // mois manquant passerait pour « pas de données » sur une ville qui en a.
    for (const destination of DESTINATIONS) {
      const annee = climateYear(destination.id);
      expect(annee.length === 0 || annee.length === 12, destination.id).toBe(true);
      expect(hasClimate(destination.id), destination.id).toBe(annee.length === 12);
    }
  });

  it('garde des normales mesurées sur le noyau du catalogue', () => {
    // Ces chiffres viennent des archives Open-Meteo, ville par ville : ils ne
    // s'inventent pas, et le catalogue s'étend plus vite qu'on ne les relève.
    // Une ville sans normales retombe sur `bestMonths`, un jugement humain
    // assumé — la note de climat pèse 10 %, le reste du score est intact.
    const mesurees = DESTINATIONS.filter((destination) => hasClimate(destination.id));
    expect(mesurees.length).toBeGreaterThanOrEqual(55);
    for (const ville of ['lisbonne', 'seville', 'budapest', 'istanbul', 'reykjavik']) {
      expect(hasClimate(ville), ville).toBe(true);
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
    // Le catalogue descend sous l'équateur : la règle ne vaut qu'au nord, où
    // l'inverser signalerait des mois décalés à la saisie.
    const nord = DESTINATIONS.filter(
      (destination) => destination.lat > 0 && hasClimate(destination.id),
    );
    expect(nord.length).toBeGreaterThan(40);
    for (const destination of nord) {
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
  it('décode une série relevée ailleurs exactement comme les siennes', () => {
    // Le catalogue compte cinq cents villes ; leurs normales sont relevées côté
    // serveur et relues par l'application. Un second décodage finirait par
    // diverger d'un mois : c'est la même fonction qui sert aux deux.
    const serie = Array.from({ length: 36 }, (_, index) => index);
    expect(climateFromSeries(serie, 1)).toEqual({
      month: 1, avgHighC: 0, avgLowC: 1, rainyDays: 2,
    });
    expect(climateFromSeries(serie, 12)).toEqual({
      month: 12, avgHighC: 33, avgLowC: 34, rainyDays: 35,
    });
  });

  it('refuse une série absente, tronquée ou un mois hors calendrier', () => {
    const serie = Array.from({ length: 36 }, () => 10);
    expect(climateFromSeries(undefined, 6)).toBeUndefined();
    expect(climateFromSeries(serie, 0)).toBeUndefined();
    expect(climateFromSeries(serie, 13)).toBeUndefined();
    // Une série trop courte décalerait les mois sans prévenir : mieux vaut rien.
    expect(climateFromSeries([1, 2, 3], 12)).toBeUndefined();
  });
});
