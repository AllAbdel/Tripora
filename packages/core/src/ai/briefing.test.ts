import { describe, expect, it } from 'vitest';
import { briefingLeaksNames, buildBriefing, CONSIGNE_ASSISTANT } from './briefing.js';
import { normalizeWeights } from '../preferences.js';
import { buildProposals } from '../proposals.js';
import type { MemberPreference, TripConstraints } from '../types.js';

const PARIS = { name: 'Paris', lat: 48.8566, lng: 2.3522, iata: ['PAR'] };

function constraints(overrides: Partial<TripConstraints> = {}): TripConstraints {
  return {
    participants: 3,
    origin: PARIS,
    durationDays: 5,
    dateMode: 'month',
    month: 10,
    budgetMode: 'max_per_person',
    budgetPerPersonCents: 60_000,
    comfortLevel: 'budget',
    groupType: 'friends',
    ...overrides,
  };
}

const MEMBRES: MemberPreference[] = [
  {
    userId: '3f9c1b7e-2a44-4f0b-9d21-8e6c5a0f1234',
    displayName: 'Abdelslam',
    weights: normalizeWeights({ food: 1, nightlife: 0.66 }),
    budgetMaxCents: 40_000,
  },
  {
    userId: 'a1b2c3d4-e5f6-4711-8899-aabbccddeeff',
    displayName: 'Camille',
    weights: normalizeWeights({ culture: 1 }),
    budgetMaxCents: 55_000,
  },
];

describe('dossier de faits pour l’assistant', () => {
  it('donne le cadre du voyage', () => {
    const dossier = buildBriefing({ constraints: constraints(), members: MEMBRES, scores: [] });
    expect(dossier).toContain('Départ de Paris');
    expect(dossier).toContain('3 personnes, 5 jours');
    expect(dossier).toContain('octobre');
  });

  it('met en avant le budget contraignant, pas la moyenne', () => {
    const dossier = buildBriefing({ constraints: constraints(), members: MEMBRES, scores: [] });
    // 400 € est le plus bas des deux : c'est lui qui décide.
    expect(dossier).toMatch(/Budget contraignant : 400\s?€/u);
    expect(dossier).toContain('c’est le plus bas du groupe');
  });

  it('dit franchement qu’aucun plafond n’est fixé', () => {
    const dossier = buildBriefing({
      constraints: constraints({ budgetMode: 'cheapest', budgetPerPersonCents: null }),
      members: [{ userId: 'x', weights: normalizeWeights({}), budgetMaxCents: null }],
      scores: [],
    });
    expect(dossier).toContain('aucun plafond');
  });

  it('anonymise les participants', () => {
    const dossier = buildBriefing({ constraints: constraints(), members: MEMBRES, scores: [] });
    expect(dossier).toContain('Participant A');
    expect(dossier).toContain('Participant B');
    expect(dossier).not.toContain('Abdelslam');
    expect(dossier).not.toContain('Camille');
    expect(dossier).not.toContain('3f9c1b7e');
  });

  it('résume les envies fortes sans lister les axes muets', () => {
    const dossier = buildBriefing({ constraints: constraints(), members: MEMBRES, scores: [] });
    expect(dossier).toContain('Gastronomie 10/10');
    expect(dossier).not.toContain('Shopping 0/10');
  });

  it('reprend le classement calculé, avec la fraîcheur du prix', () => {
    const result = buildProposals(constraints(), MEMBRES, { keep: 3 });
    const dossier = buildBriefing({
      constraints: constraints(),
      members: MEMBRES,
      scores: result.scores,
    });
    expect(dossier).toContain('## Le classement calculé');
    expect(dossier).toContain('transport estimé');
    expect(dossier).toContain(`1. ${result.scores[0]!.destinationId}`);
  });

  it('transmet ce qui manque au groupe', () => {
    const dossier = buildBriefing({
      constraints: constraints(),
      members: MEMBRES,
      scores: [],
      blockers: [{ label: 'Personne n’a voté', consequence: 'Rien n’est tranché.' }],
    });
    expect(dossier).toContain('Personne n’a voté');
  });
});

describe('garde-fou anti-fuite', () => {
  it('ne trouve rien dans un dossier correctement anonymisé', () => {
    const dossier = buildBriefing({ constraints: constraints(), members: MEMBRES, scores: [] });
    expect(briefingLeaksNames(dossier, MEMBRES)).toEqual([]);
  });

  it('repère un prénom qui aurait glissé', () => {
    // La promesse « aucun nom ne part » ne vaut que si quelque chose la vérifie.
    expect(briefingLeaksNames('Camille veut de la culture', MEMBRES)).toEqual(['Camille']);
  });

  it('ignore un nom trop court pour être significatif', () => {
    const court = [{ ...MEMBRES[0]!, displayName: 'Al' }];
    expect(briefingLeaksNames('Il y a plein de mots ici', court)).toEqual([]);
  });
});

describe('consigne de l’assistant', () => {
  it('interdit explicitement d’inventer et de décider', () => {
    expect(CONSIGNE_ASSISTANT).toContain('Tu n’utilises QUE les chiffres du dossier');
    expect(CONSIGNE_ASSISTANT).toContain('Tu ne décides pas à la place du groupe');
    expect(CONSIGNE_ASSISTANT).toContain('recommandes aucun restaurant');
  });
});
