import { describe, expect, it } from 'vitest';
import { awaitsPlace, fillItinerary, type SlotToFill } from './fill.js';
import type { Poi } from './places.js';

/** Coordonnées lisboètes réelles, pour que les distances veuillent dire quelque chose. */
function lieu(
  id: string,
  name: string,
  axis: Poi['axis'],
  lat: number,
  lng: number,
  extras: Partial<Poi> = {},
): Poi {
  return { id, name, axis, lat, lng, category: 'musee', label: 'Musée', ...extras };
}

const GULBENKIAN = lieu('m1', 'Musée Gulbenkian', 'culture', 38.7376, -9.1537, {
  extract: 'Un musée.',
});
const AZULEJO = lieu('m2', 'Musée national de l’Azulejo', 'culture', 38.7250, -9.1147);
const JERONIMOS = lieu('m3', 'Monastère des Hiéronymites', 'culture', 38.6979, -9.2065, {
  category: 'monument',
  label: 'Monument',
});
const EDOUARD_VII = lieu('p1', 'Parc Édouard-VII', 'nature', 38.7280, -9.1520, {
  category: 'parc',
  label: 'Parc',
});
const MONSANTO = lieu('p2', 'Parc de Monsanto', 'nature', 38.7300, -9.1950, {
  category: 'parc',
  label: 'Parc',
});

const CULTURE_MATIN: SlotToFill = { dayIndex: 1, position: 1, axis: 'culture' };
const CULTURE_APRES: SlotToFill = { dayIndex: 1, position: 2, axis: 'culture' };

describe('remplissage de l’itinéraire', () => {
  it('pose un vrai lieu sur un créneau', () => {
    const remplis = fillItinerary({
      slots: [CULTURE_MATIN],
      places: [GULBENKIAN, EDOUARD_VII],
    });
    expect(remplis).toHaveLength(1);
    expect(remplis[0]!.poi.name).toBe('Musée Gulbenkian');
    expect(remplis[0]!.dayIndex).toBe(1);
  });

  it('ne met jamais un musée sur un créneau nature', () => {
    // La règle la plus importante : un trou vaut mieux qu'un lieu à côté de la
    // plaque, parce que le créneau garde alors son titre neutre et honnête.
    const remplis = fillItinerary({
      slots: [{ dayIndex: 1, position: 1, axis: 'nature' }],
      places: [GULBENKIAN, AZULEJO],
    });
    expect(remplis).toEqual([]);
  });

  it('ne propose jamais deux fois le même lieu', () => {
    const remplis = fillItinerary({
      slots: [CULTURE_MATIN, CULTURE_APRES, { dayIndex: 2, position: 1, axis: 'culture' }],
      places: [GULBENKIAN, AZULEJO, JERONIMOS],
    });
    const ids = remplis.map((entree) => entree.poi.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('regroupe la journée autour du premier lieu', () => {
    // Gulbenkian ancre la matinée ; le parc Édouard-VII est à 1 km, Monsanto à
    // 4. C'est le proche qui doit sortir, même s'il compte moins pour le groupe.
    const remplis = fillItinerary({
      slots: [CULTURE_MATIN, { dayIndex: 1, position: 2, axis: 'nature' }],
      places: [GULBENKIAN, MONSANTO, EDOUARD_VII],
      weights: { culture: 1, nature: 0.4 },
    });
    expect(remplis[1]!.poi.name).toBe('Parc Édouard-VII');
    expect(remplis[1]!.reason).toContain('Musée Gulbenkian');
  });

  it('préfère le mieux classé quand rien n’est à portée de marche', () => {
    const remplis = fillItinerary({
      slots: [CULTURE_MATIN, { dayIndex: 1, position: 2, axis: 'nature' }],
      places: [GULBENKIAN, MONSANTO],
    });
    expect(remplis[1]!.poi.name).toBe('Parc de Monsanto');
    expect(remplis[1]!.reason).toContain('comptez un trajet');
  });

  it('suit les envies du groupe pour départager', () => {
    const remplis = fillItinerary({
      slots: [{ dayIndex: 1, position: 1, axis: 'nature' }],
      places: [MONSANTO, EDOUARD_VII],
      weights: { nature: 1 },
    });
    // À envie égale, c'est la richesse de la fiche puis le nom qui tranchent :
    // le classement doit être stable, pas aléatoire.
    expect(remplis[0]!.poi.name).toBe('Parc de Monsanto');
  });

  it('dit d’où vient chaque lieu', () => {
    const remplis = fillItinerary({ slots: [CULTURE_MATIN], places: [GULBENKIAN] });
    expect(remplis[0]!.reason).toContain('Wikipédia');
    const sansFiche = fillItinerary({ slots: [CULTURE_MATIN], places: [AZULEJO] });
    expect(sansFiche[0]!.reason).toContain('OpenStreetMap');
  });

  it('ne casse sur rien', () => {
    expect(fillItinerary({ slots: [], places: [GULBENKIAN] })).toEqual([]);
    expect(fillItinerary({ slots: [CULTURE_MATIN], places: [] })).toEqual([]);
  });

  it('traite les journées dans l’ordre, quel que soit celui des créneaux', () => {
    const remplis = fillItinerary({
      slots: [
        { dayIndex: 2, position: 1, axis: 'culture' },
        { dayIndex: 1, position: 2, axis: 'culture' },
        { dayIndex: 1, position: 1, axis: 'culture' },
      ],
      places: [GULBENKIAN, AZULEJO, JERONIMOS],
    });
    expect(remplis.map((entree) => [entree.dayIndex, entree.position])).toEqual([
      [1, 1],
      [1, 2],
      [2, 1],
    ]);
  });
});

describe('créneau encore libre', () => {
  it('reconnaît un titre neutre', () => {
    expect(awaitsPlace('Musées et monuments', 'culture')).toBe(true);
    expect(awaitsPlace('  Nature et grand air  ', 'nature')).toBe(true);
  });

  it('laisse tranquille ce que quelqu’un a écrit', () => {
    // Remplir un itinéraire ne doit jamais effacer le choix d'un participant.
    expect(awaitsPlace('Musée Gulbenkian', 'culture')).toBe(false);
    expect(awaitsPlace('Musées et monuments', 'nature')).toBe(false);
  });
});
