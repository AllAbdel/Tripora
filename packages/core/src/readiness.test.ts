import { describe, expect, it } from 'vitest';
import { hasAnswered, tripReadiness } from './readiness.js';
import { normalizeWeights } from './preferences.js';
import type { MemberPreference, TripConstraints } from './types.js';

function constraints(overrides: Partial<TripConstraints> = {}): TripConstraints {
  return {
    participants: 4,
    origin: { name: 'Paris', lat: 48.8566, lng: 2.3522 },
    durationDays: 4,
    dateMode: 'month',
    month: 10,
    budgetMode: 'max_per_person',
    budgetPerPersonCents: 50_000,
    comfortLevel: 'budget',
    groupType: 'friends',
    ...overrides,
  };
}

function membre(id: string, repondu = true, budget: number | null = 40_000): MemberPreference {
  return {
    userId: id,
    // Les deux passent par normalizeWeights, comme les vraies données.
    weights: normalizeWeights(repondu ? { culture: 1 } : {}),
    budgetMaxCents: budget,
  };
}

const COMPLET = [membre('a'), membre('b'), membre('c'), membre('d')];

function genres(readiness: ReturnType<typeof tripReadiness>): string[] {
  return readiness.blockers.map((blocage) => blocage.kind);
}

describe('a-t-on répondu ?', () => {
  it('reconnaît une envie exprimée', () => {
    expect(hasAnswered({ food: 1 })).toBe(true);
    expect(hasAnswered({ culture: 0.33 })).toBe(true);
  });

  it('ne se laisse pas berner par des préférences normalisées', () => {
    // Piège réel : `normalizeWeights` remplit les huit axes à zéro. Tester la
    // présence des clés dirait que tout le monde a répondu, y compris ceux qui
    // n'ont jamais ouvert l'écran.
    expect(hasAnswered({})).toBe(false);
    expect(hasAnswered(normalizeWeights({}))).toBe(false);
    expect(hasAnswered(normalizeWeights({ food: 1 }))).toBe(true);
  });
});

describe('ce qui bloque le groupe', () => {
  it('compte les absents sans en faire un blocage', () => {
    const etat = tripReadiness({ constraints: constraints(), members: [membre('a')] });
    const absents = etat.blockers.find((blocage) => blocage.kind === 'members')!;
    expect(absents.label).toBe('3 personnes n’ont pas encore rejoint');
    expect(absents.blocking).toBe(false);
  });

  it('accorde le singulier', () => {
    const etat = tripReadiness({
      constraints: constraints({ participants: 2 }),
      members: [membre('a')],
    });
    expect(etat.blockers.find((blocage) => blocage.kind === 'members')?.label).toContain(
      'Une personne',
    );
  });

  it('traite les envies manquantes comme un vrai blocage', () => {
    const etat = tripReadiness({
      constraints: constraints(),
      members: [membre('a'), membre('b', false), membre('c'), membre('d')],
    });
    const envies = etat.blockers.find((blocage) => blocage.kind === 'preferences')!;
    expect(envies.blocking).toBe(true);
    expect(envies.consequence).toContain('équité');
    expect(etat.readyToDecide).toBe(false);
  });

  it('ne réclame pas de budget quand le groupe cherche le moins cher', () => {
    const sansBudget = COMPLET.map((m) => ({ ...m, budgetMaxCents: null }));
    expect(
      genres(tripReadiness({ constraints: constraints(), members: sansBudget })),
    ).toContain('budget');
    expect(
      genres(
        tripReadiness({
          constraints: constraints({ budgetMode: 'cheapest' }),
          members: sansBudget,
        }),
      ),
    ).not.toContain('budget');
  });

  it('bloque quand aucune période n’est fixée', () => {
    const etat = tripReadiness({
      constraints: { ...constraints(), month: undefined, dateMode: 'window' },
      members: COMPLET,
    });
    const periode = etat.blockers.find((blocage) => blocage.kind === 'period')!;
    expect(periode.blocking).toBe(true);
    expect(periode.consequence).toContain('météo');
  });

  it('met les vrais blocages en premier', () => {
    const etat = tripReadiness({
      constraints: constraints(),
      members: [membre('a'), membre('b', false)],
    });
    // Les absents (non bloquant) ne doivent pas passer devant les envies
    // manquantes (bloquant).
    expect(etat.blockers[0]?.blocking).toBe(true);
  });

  it('distingue « personne n’a voté » de « il en manque »', () => {
    const aucun = tripReadiness({ constraints: constraints(), members: COMPLET, votes: 0 });
    expect(aucun.blockers.find((b) => b.kind === 'vote')?.blocking).toBe(true);

    const partiel = tripReadiness({ constraints: constraints(), members: COMPLET, votes: 3 });
    const vote = partiel.blockers.find((b) => b.kind === 'vote')!;
    expect(vote.blocking).toBe(false);
    expect(vote.label).toBe('Une personne n’a pas voté');
  });

  it('ne dit plus rien du vote une fois la destination arrêtée', () => {
    const etat = tripReadiness({
      constraints: constraints(),
      members: COMPLET,
      votes: 4,
      locked: true,
    });
    expect(etat.blockers).toEqual([]);
    expect(etat.readyToDecide).toBe(true);
    expect(etat.progress).toBe(100);
  });

  it('avance la barre à chaque jalon franchi', () => {
    const rien = tripReadiness({ constraints: constraints(), members: [] });
    expect(rien.progress).toBe(0);

    const reunis = tripReadiness({ constraints: constraints(), members: COMPLET });
    expect(reunis.progress).toBe(50);

    const votants = tripReadiness({ constraints: constraints(), members: COMPLET, votes: 2 });
    expect(votants.progress).toBe(75);
  });

  it('ne nomme jamais personne', () => {
    // La pression sociale n'est pas une fonctionnalité : on compte, on
    // n'accuse pas.
    const etat = tripReadiness({
      constraints: constraints(),
      members: [membre('camille'), membre('dominique', false)],
    });
    for (const blocage of etat.blockers) {
      expect(`${blocage.label} ${blocage.consequence}`).not.toContain('dominique');
    }
  });
});
