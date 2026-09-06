import { describe, expect, it } from 'vitest';
import { estimateTripCost } from './cost.js';
import { normalizeWeights } from './preferences.js';
import { bindingBudgetCents, memberSatisfaction, rankDestinations, scoreDestination } from './scoring.js';
import type { Destination, MemberPreference, TripConstraints } from './types.js';

const PARIS = { name: 'Paris', lat: 48.8566, lng: 2.3522 };

function destination(overrides: Partial<Destination> & { id: string }): Destination {
  return {
    name: overrides.id,
    country: 'Test',
    countryCode: 'TS',
    lat: 47.4979,
    lng: 19.0402,
    iata: ['XXX'],
    tags: normalizeWeights({}),
    costIndex: 1,
    poiRichness: 0.8,
    bestMonths: [5, 6, 9],
    ...overrides,
  };
}

function constraints(overrides: Partial<TripConstraints> = {}): TripConstraints {
  return {
    participants: 4,
    origin: PARIS,
    durationDays: 4,
    dateMode: 'month',
    month: 9,
    budgetMode: 'max_per_person',
    budgetPerPersonCents: 50_000,
    comfortLevel: 'budget',
    groupType: 'friends',
    ...overrides,
  };
}

function member(userId: string, weights: Record<string, number>, budget: number | null = null): MemberPreference {
  return { userId, weights: normalizeWeights(weights), budgetMaxCents: budget };
}

/** Horodatage figé : les tests de déterminisme comparent des objets complets. */
const RELEVE_LE = '2026-09-06T09:00:00.000Z';

const observed = (cents: number) => ({
  cents,
  source: 'observed' as const,
  provider: 'Aviasales',
  fetchedAt: RELEVE_LE,
});

describe('satisfaction individuelle', () => {
  it('mesure ce que la destination offre parmi ce qui compte pour la personne', () => {
    const fete = destination({ id: 'fete', tags: normalizeWeights({ nightlife: 1, culture: 0.1 }) });
    expect(memberSatisfaction(normalizeWeights({ nightlife: 1 }), fete)).toBeCloseTo(1, 5);
    expect(memberSatisfaction(normalizeWeights({ culture: 1 }), fete)).toBeCloseTo(0.1, 5);
  });

  it('reste neutre quand la personne n’a rien exprimé', () => {
    const any = destination({ id: 'any', tags: normalizeWeights({ nightlife: 1 }) });
    expect(memberSatisfaction(normalizeWeights({}), any)).toBe(0.5);
  });

  it('pénalise un axe explicitement rejeté', () => {
    const musees = destination({ id: 'musees', tags: normalizeWeights({ culture: 1, food: 1 }) });
    const withAvoid = memberSatisfaction(normalizeWeights({ food: 1 }), musees, ['culture']);
    const without = memberSatisfaction(normalizeWeights({ food: 1 }), musees);
    expect(withAvoid).toBeLessThan(without);
  });
});

describe('budget contraignant', () => {
  it('retient le budget le plus bas du groupe, pas celui du créateur', () => {
    const members = [member('a', {}, 90_000), member('b', {}, 40_000), member('c', {}, 60_000)];
    expect(bindingBudgetCents(members, constraints())).toBe(40_000);
  });

  it('retombe sur le budget du voyage si personne n’a renseigné le sien', () => {
    expect(bindingBudgetCents([member('a', {})], constraints({ budgetPerPersonCents: 33_000 }))).toBe(33_000);
  });
});

describe('promesse produit : le groupe avant le créateur', () => {
  const fiesta = destination({
    id: 'fiesta',
    name: 'Fiesta',
    tags: normalizeWeights({ nightlife: 1, food: 0.5, culture: 0.1, nature: 0.1 }),
  });
  const equilibre = destination({
    id: 'equilibre',
    name: 'Équilibre',
    tags: normalizeWeights({ nightlife: 0.6, food: 0.6, culture: 0.6, nature: 0.6 }),
  });

  const groupe = [
    member('fetard1', { nightlife: 1 }),
    member('fetard2', { nightlife: 1 }),
    member('fetard3', { nightlife: 1 }),
    member('curieux', { culture: 1 }),
  ];

  // Même prix, même distance, même richesse : seules les envies départagent.
  const context = () => ({
    constraints: constraints(),
    members: groupe,
    transport: observed(10_000),
    cheapestTotalCents: null,
  });

  it('préfère le compromis à la destination qui laisse une personne de côté', () => {
    const scoreFiesta = scoreDestination(fiesta, context());
    const scoreEquilibre = scoreDestination(equilibre, context());

    const prefFiesta = scoreFiesta.factors.find((f) => f.key === 'preferences')!.score;
    const prefEquilibre = scoreEquilibre.factors.find((f) => f.key === 'preferences')!.score;

    // La moyenne brute favoriserait Fiesta (3 personnes sur 4 ravies)…
    const moyenneFiesta =
      scoreFiesta.memberSatisfaction.reduce((a, s) => a + s.value, 0) / groupe.length;
    const moyenneEquilibre =
      scoreEquilibre.memberSatisfaction.reduce((a, s) => a + s.value, 0) / groupe.length;
    expect(moyenneFiesta).toBeGreaterThan(moyenneEquilibre);

    // …mais l'agrégation équitable retient Équilibre.
    expect(prefEquilibre).toBeGreaterThan(prefFiesta);
    expect(scoreEquilibre.total).toBeGreaterThan(scoreFiesta.total);
  });

  it('signale explicitement un choix clivant', () => {
    const equite = scoreDestination(fiesta, context()).factors.find((f) => f.key === 'equity')!;
    expect(equite.score).toBeLessThan(50);
    expect(equite.reason).toMatch(/clivant/i);
  });
});

describe('raisonnement sur le coût total, pas sur le billet', () => {
  it('un vol plus cher vers une ville bon marché peut sortir gagnant', () => {
    const chere = destination({ id: 'chere', name: 'Ville chère', costIndex: 2 });
    const bonMarche = destination({ id: 'bon-marche', name: 'Ville bon marché', costIndex: 0.6 });

    const coutChere = estimateTripCost({
      destination: chere,
      durationDays: 4,
      comfortLevel: 'budget',
      transport: observed(8_000),
    });
    const coutBonMarche = estimateTripCost({
      destination: bonMarche,
      durationDays: 4,
      comfortLevel: 'budget',
      transport: observed(13_000),
    });

    expect(coutBonMarche.transportCents).toBeGreaterThan(coutChere.transportCents);
    expect(coutBonMarche.totalCents).toBeLessThan(coutChere.totalCents);
  });

  it('le total est exactement la somme de ses postes', () => {
    const cost = estimateTripCost({
      destination: destination({ id: 'x', costIndex: 1.15 }),
      durationDays: 5,
      comfortLevel: 'mid',
      transport: observed(12_345),
    });
    const somme =
      cost.transportCents +
      cost.accommodationCents +
      cost.foodCents +
      cost.activitiesCents +
      cost.localTransportCents +
      cost.miscCents;
    expect(cost.totalCents).toBe(somme);
  });

  it('sans prix de transport, le total reste calculé mais marqué non disponible', () => {
    const cost = estimateTripCost({
      destination: destination({ id: 'x' }),
      durationDays: 3,
      comfortLevel: 'budget',
      transport: { cents: null, source: 'unavailable' },
    });
    expect(cost.source).toBe('unavailable');
    expect(cost.totalCents).toBeGreaterThan(0);
  });
});

describe('notation complète', () => {
  const base = destination({ id: 'base', tags: normalizeWeights({ culture: 0.8, food: 0.8 }) });
  const members = [member('a', { culture: 1, food: 1 }, 50_000)];

  it('effondre la note quand le budget explose', () => {
    const dansLeBudget = scoreDestination(base, {
      constraints: constraints(),
      members,
      transport: observed(8_000),
    });
    const horsBudget = scoreDestination(base, {
      constraints: constraints(),
      members,
      transport: observed(120_000),
    });
    expect(horsBudget.factors.find((f) => f.key === 'price')!.score).toBe(0);
    expect(horsBudget.total).toBeLessThan(dansLeBudget.total);
  });

  it('produit une note bornée et un résumé factuel', () => {
    const score = scoreDestination(base, {
      constraints: constraints(),
      members,
      transport: observed(8_000),
    });
    expect(score.total).toBeGreaterThanOrEqual(0);
    expect(score.total).toBeLessThanOrEqual(100);
    expect(score.summary).toContain(`${score.total}/100`);
    expect(score.factors).toHaveLength(6);
    expect(score.factors.reduce((a, f) => a + f.weight, 0)).toBeCloseTo(1, 6);
  });

  it('est déterministe et trie de façon stable', () => {
    const lot = [
      destination({ id: 'b', tags: normalizeWeights({ culture: 0.5 }) }),
      destination({ id: 'a', tags: normalizeWeights({ culture: 0.5 }) }),
    ];
    const ctx = () => ({ constraints: constraints(), members, transport: observed(9_000) });
    const premier = rankDestinations(lot, ctx);
    const second = rankDestinations(lot, ctx);
    expect(premier).toEqual(second);
    expect(premier.map((s) => s.destinationId)).toEqual(['a', 'b']);
  });

  it('en mode « le moins cher possible », classe par rapport à l’option la plus basse', () => {
    const score = scoreDestination(base, {
      constraints: constraints({ budgetMode: 'cheapest', budgetPerPersonCents: null }),
      members: [member('a', { culture: 1 })],
      transport: observed(10_000),
      cheapestTotalCents: 30_000,
    });
    const prix = score.factors.find((f) => f.key === 'price')!;
    expect(prix.score).toBeGreaterThan(0);
    expect(prix.score).toBeLessThan(100);
  });
});
