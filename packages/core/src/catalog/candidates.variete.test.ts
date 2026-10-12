import { describe, expect, it } from 'vitest';
import { continentDe } from '../continents.js';
import { buildProposals } from '../proposals.js';
import type { Continent } from '../continents.js';
import type { TripConstraints } from '../types.js';
import { diversifier, selectCandidates } from './candidates.js';
import { DESTINATIONS_BY_ID } from './destinations.js';
import { chercherDepartsPays, ORIGINS } from './origins.js';

const france = chercherDepartsPays('France')[0]!;
const paris = ORIGINS.find((place) => place.name === 'Paris')!;

function contraintes(valeurs: Partial<TripConstraints> = {}): TripConstraints {
  return {
    participants: 4,
    origin: france,
    durationDays: 7,
    dateMode: 'month',
    month: 6,
    budgetMode: 'max_per_person',
    budgetPerPersonCents: null,
    comfortLevel: 'mid',
    groupType: 'friends',
    ...valeurs,
  };
}

const continentDeLaVille = (id: string) => continentDe(DESTINATIONS_BY_ID.get(id)?.countryCode);

describe('des propositions qui changent', () => {
  it('ne cherche que sur les continents choisis, même loin pour un séjour court', () => {
    for (const regions of [['afrique'], ['asie'], ['amerique-du-sud', 'amerique-du-nord']] as Continent[][]) {
      const candidates = selectCandidates(contraintes({ durationDays: 4, regions }));
      expect(candidates.length).toBeGreaterThan(5);
      for (const destination of candidates) expect(regions).toContain(continentDe(destination.countryCode));
    }
  });

  it('partir de tout un pays, c’est partir à l’étranger', () => {
    const candidates = selectCandidates(contraintes());
    expect(candidates.some((destination) => destination.country === 'France')).toBe(false);
    // D'une ville, les voyages dans le pays restent possibles.
    expect(selectCandidates(contraintes({ origin: paris })).some((destination) => destination.country === 'France')).toBe(true);
  });

  it('pas plus de deux villes d’un même pays tant qu’il y en a d’ailleurs', () => {
    const candidates = selectCandidates(contraintes({ origin: paris }));
    const parPays = new Map<string, number>();
    for (const destination of candidates) parPays.set(destination.countryCode, (parPays.get(destination.countryCode) ?? 0) + 1);
    expect(Math.max(...parPays.values())).toBeLessThanOrEqual(2);
    // Faute d'autres pays, on complète dans l'ordre.
    const memePays = [1, 2, 3].map((n) => ({ id: `v${n}`, countryCode: 'FR' }));
    expect(diversifier(memePays, 3, 2).map((ville) => ville.id)).toEqual(['v1', 'v2', 'v3']);
  });

  it('« D’autres idées » : des destinations jamais vues', () => {
    const premieres = buildProposals(contraintes({ regions: ['afrique'] }), [], { limit: 20, keep: 8 });
    const vues = premieres.scores.map((score) => score.destinationId);
    expect(vues).toHaveLength(8);
    const suivantes = buildProposals(contraintes({ regions: ['afrique'] }), [], { limit: 20, keep: 8, exclude: vues });
    expect(suivantes.scores.length).toBeGreaterThan(0);
    for (const score of suivantes.scores) {
      expect(vues).not.toContain(score.destinationId);
      expect(continentDeLaVille(score.destinationId)).toBe('afrique');
    }
  });
});
