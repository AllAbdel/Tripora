import { describe, expect, it } from 'vitest';
import { fillItinerary, soldeDuLieu, type SlotToFill } from './fill.js';
import type { Poi } from './places.js';

/**
 * Ce que le groupe a dit des lieux, et ce que le remplissage en fait.
 *
 * Coordonnées lisboètes réelles : Gulbenkian et l'Azulejo sont à trois
 * kilomètres l'un de l'autre, les Hiéronymites à sept du premier. Ce sont ces
 * distances qui rendent le test honnête — la règle doit l'emporter sur la
 * proximité, sinon elle ne sert à rien.
 */
function lieu(id: string, name: string, lat: number, lng: number, extras: Partial<Poi> = {}): Poi {
  return { id, name, axis: 'culture', lat, lng, category: 'musee', label: 'Musée', ...extras };
}

const GULBENKIAN = lieu('m1', 'Musée Gulbenkian', 38.7376, -9.1537, { extract: 'Un musée.' });
const ARTE_MODERNA = lieu('m4', 'Centre d’art moderne', 38.7380, -9.1545);
const AZULEJO = lieu('m2', 'Musée national de l’Azulejo', 38.725, -9.1147);
const JERONIMOS = lieu('m3', 'Monastère des Hiéronymites', 38.6979, -9.2065);

const MATIN: SlotToFill = { dayIndex: 1, position: 1, axis: 'culture' };
const APRES: SlotToFill = { dayIndex: 1, position: 2, axis: 'culture' };

describe('les envies du groupe dans le remplissage', () => {
  it('ne propose jamais un lieu que le groupe refuse', () => {
    // Gulbenkian est le mieux classé — il a une fiche — mais trois personnes
    // sur quatre n'en veulent pas.
    const remplis = fillItinerary({
      slots: [MATIN],
      places: [GULBENKIAN, AZULEJO],
      avis: { m1: { pour: 1, contre: 3 } },
    });
    expect(remplis[0]!.poi.id).toBe('m2');
  });

  it('pose d’abord ce que le groupe réclame, même moins bien classé', () => {
    const remplis = fillItinerary({
      slots: [MATIN],
      places: [GULBENKIAN, JERONIMOS],
      avis: { m3: { pour: 2, contre: 0 } },
    });
    expect(remplis[0]!.poi.id).toBe('m3');
    expect(remplis[0]!.reason).toContain('2 personnes du groupe en ont envie');
  });

  it('préfère un lieu réclamé à un lieu voisin', () => {
    // Le centre d'art moderne est à cent mètres de Gulbenkian ; les
    // Hiéronymites sont à sept kilomètres, mais le groupe les veut.
    const remplis = fillItinerary({
      slots: [MATIN, APRES],
      places: [GULBENKIAN, ARTE_MODERNA, JERONIMOS],
      avis: { m1: { pour: 3, contre: 0 }, m3: { pour: 1, contre: 0 } },
    });
    expect(remplis.map((rempli) => rempli.poi.id)).toEqual(['m1', 'm3']);
  });

  it('entre deux lieux également réclamés, reprend le plus proche', () => {
    const remplis = fillItinerary({
      slots: [MATIN, APRES],
      places: [GULBENKIAN, JERONIMOS, ARTE_MODERNA],
      avis: {
        m1: { pour: 2, contre: 0 },
        m3: { pour: 1, contre: 0 },
        m4: { pour: 1, contre: 0 },
      },
    });
    expect(remplis.map((rempli) => rempli.poi.id)).toEqual(['m1', 'm4']);
  });

  it('ne dit pas « en ont envie » quand personne ne l’a dit', () => {
    const remplis = fillItinerary({ slots: [MATIN], places: [GULBENKIAN] });
    expect(remplis[0]!.reason).not.toContain('envie');
    const seul = fillItinerary({
      slots: [MATIN],
      places: [GULBENKIAN],
      avis: { m1: { pour: 1, contre: 0 } },
    });
    expect(seul[0]!.reason).toContain('Quelqu’un du groupe en a envie');
  });

  it('laisse un lieu à égalité dans la liste, sans le mettre en avant', () => {
    expect(soldeDuLieu({ pour: 2, contre: 2 })).toBe(0);
    const remplis = fillItinerary({
      slots: [MATIN],
      places: [GULBENKIAN],
      avis: { m1: { pour: 2, contre: 2 } },
    });
    expect(remplis[0]!.poi.id).toBe('m1');
    expect(remplis[0]!.reason).not.toContain('envie');
  });
});
