import { beforeEach, describe, expect, it } from 'vitest';
import {
  findDiscovered,
  forgetDiscovered,
  makeDiscovered,
  rememberDestination,
} from './discovered.js';
import { findDestination, searchDestinations } from './destinations.js';
import { selectCandidates } from './candidates.js';

const KYOTO = {
  id: 'osm-r357794',
  name: 'Kyoto',
  country: 'Japon',
  countryCode: 'JP',
  lat: 35.0115754,
  lng: 135.7681441,
};

beforeEach(forgetDiscovered);

describe('villes découvertes', () => {
  it('n’invente aucune note', () => {
    const kyoto = makeDiscovered(KYOTO);
    // Zéro partout se lit « on ne sait pas ». Mettre 0,5 se lirait « moyenne en
    // tout », qui est une affirmation, et fausse.
    expect(Object.values(kyoto.tags).every((valeur) => valeur === 0)).toBe(true);
    expect(kyoto.discovered).toBe(true);
    // Sans code IATA, aucun prix de vol ne sera affiché pour cette ville —
    // mieux qu'un prix qui serait celui d'une autre.
    expect(kyoto.iata).toEqual([]);
  });

  it('se résout comme une destination du catalogue une fois retenue', () => {
    expect(findDestination(KYOTO.id)).toBeUndefined();
    rememberDestination(makeDiscovered(KYOTO));
    // C'est ce qui permet à la carte, à l'itinéraire et aux lieux de
    // fonctionner sans rien savoir de l'origine de la ville.
    expect(findDestination(KYOTO.id)?.name).toBe('Kyoto');
    expect(findDiscovered(KYOTO.id)?.lat).toBeCloseTo(35.0115754);
  });

  it('ne prend jamais la place d’une ville curée', () => {
    rememberDestination(makeDiscovered({ ...KYOTO, id: 'osm-r1', name: 'Faux Lisbonne' }));
    expect(findDestination('lisbonne')?.name).toBe('Lisbonne');
  });

  it('n’entre pas dans ce qui se compare', () => {
    rememberDestination(makeDiscovered(KYOTO));
    // Le classement des propositions et la recherche du catalogue ne lisent que
    // les villes notées : une ville sans notes n'a rien à y défendre.
    expect(searchDestinations('Kyoto', 30)).toEqual([]);
    const candidates = selectCandidates({
      participants: 2,
      origin: { name: 'Paris', lat: 48.8566, lng: 2.3522 },
      durationDays: 4,
      dateMode: 'month',
      month: 10,
      budgetMode: 'cheapest',
      budgetPerPersonCents: null,
      comfortLevel: 'budget',
      groupType: 'friends',
    });
    expect(candidates.some((entree) => entree.id === KYOTO.id)).toBe(false);
  });
});
