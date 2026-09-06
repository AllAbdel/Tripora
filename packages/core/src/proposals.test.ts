import { describe, expect, it } from 'vitest';
import { buildProposals, summariseProposals } from './proposals.js';
import {
  bestValueTransport,
  cheapestTransport,
  estimateTransportOptions,
} from './transport.js';
import { normalizeWeights } from './preferences.js';
import { findDestination } from './catalog/destinations.js';
import { climateFor } from './catalog/climate.js';
import { scoreDestination, type ScoreContext } from './scoring.js';
import type { MemberPreference, TripConstraints } from './types.js';

const PARIS = { name: 'Paris', lat: 48.8566, lng: 2.3522 };
const BRUXELLES = { lat: 50.8503, lng: 4.3517 };
const ATHENES = { lat: 37.9838, lng: 23.7275 };

function constraints(overrides: Partial<TripConstraints> = {}): TripConstraints {
  return {
    participants: 4,
    origin: PARIS,
    durationDays: 4,
    dateMode: 'month',
    month: 6,
    budgetMode: 'max_per_person',
    budgetPerPersonCents: 60_000,
    comfortLevel: 'budget',
    groupType: 'friends',
    ...overrides,
  };
}

function member(id: string, weights: Record<string, number>, budget: number | null = null): MemberPreference {
  return { userId: id, weights: normalizeWeights(weights), budgetMaxCents: budget };
}

describe('estimation du transport', () => {
  it('ne propose pas l’avion pour deux villes voisines', () => {
    const modes = estimateTransportOptions(PARIS, BRUXELLES).map((o) => o.mode);
    expect(modes).not.toContain('plane');
    expect(modes).toContain('train');
    expect(modes).toContain('bus');
  });

  it('ne propose que l’avion quand la route n’a plus de sens', () => {
    const modes = estimateTransportOptions(PARIS, { lat: 64.1466, lng: -21.9426 }).map((o) => o.mode);
    expect(modes).toEqual(['plane']);
  });

  it('classe du moins cher au plus cher', () => {
    const options = estimateTransportOptions(PARIS, ATHENES, 4);
    const prices = options.map((o) => o.price.cents ?? 0);
    expect([...prices].sort((a, b) => a - b)).toEqual(prices);
  });

  it('marque toujours ses prix comme indicatifs', () => {
    for (const option of estimateTransportOptions(PARIS, ATHENES)) {
      expect(option.price.source).toBe('estimated');
    }
  });

  it('partage le coût de la voiture entre les occupants', () => {
    const seul = estimateTransportOptions(PARIS, BRUXELLES, 1).find((o) => o.mode === 'car');
    const aQuatre = estimateTransportOptions(PARIS, BRUXELLES, 4).find((o) => o.mode === 'car');
    expect(aQuatre!.price.cents).toBeLessThan(seul!.price.cents!);
    expect(aQuatre!.note).toContain('à 4');
  });

  it('distingue le moins cher du meilleur compromis temps/prix', () => {
    // Paris–Bruxelles : le bus est le moins cher, le train vaut ses heures.
    const cheap = cheapestTransport(PARIS, BRUXELLES, 1);
    const value = bestValueTransport(PARIS, BRUXELLES, 1);
    expect(cheap!.mode).toBe('bus');
    expect(value!.mode).toBe('train');
    expect(value!.durationMin).toBeLessThan(cheap!.durationMin);
    expect(value!.price.cents).toBeGreaterThan(cheap!.price.cents!);
  });

  it('laisse gagner l’avion quand il est réellement moins cher que la route', () => {
    // Paris–Barcelone : à cette distance, le vol low cost passe devant le bus.
    expect(cheapestTransport(PARIS, { lat: 41.3874, lng: 2.1686 }, 1)!.mode).toBe('plane');
  });
});

describe('construction des propositions', () => {
  const groupe = [
    member('a', { food: 1, nightlife: 0.66 }, 60_000),
    member('b', { culture: 1, food: 0.66 }, 45_000),
  ];

  it('produit des propositions notées et classées, sans aucune clé d’API', () => {
    const result = buildProposals(constraints(), groupe);
    expect(result.scores.length).toBeGreaterThan(0);
    expect(result.examined).toBeGreaterThanOrEqual(result.scores.length);
    const totals = result.scores.map((s) => s.total);
    expect([...totals].sort((a, b) => b - a)).toEqual(totals);
  });

  it('annonce clairement que tout est indicatif sans source de prix', () => {
    const result = buildProposals(constraints(), groupe);
    expect(result.allEstimated).toBe(true);
    for (const score of result.scores) {
      expect(score.cost.transportSource).toBe('estimated');
    }
    expect(summariseProposals(result)).toContain('indicatifs');
  });

  it('utilise un prix relevé dès qu’une source en fournit un', () => {
    const releve = {
      cents: 8_900,
      source: 'observed' as const,
      provider: 'Aviasales',
      fetchedAt: new Date().toISOString(),
    };
    const result = buildProposals(constraints(), groupe, {
      sources: { transportPrice: (d) => (d.id === 'lisbonne' ? releve : undefined) },
      limit: 40,
      keep: 40,
    });
    const lisbonne = result.scores.find((s) => s.destinationId === 'lisbonne');
    expect(lisbonne?.cost.transportCents).toBe(8_900);
    expect(lisbonne?.cost.transportSource).toBe('observed');
    expect(lisbonne?.cost.transportProvider).toBe('Aviasales');
    expect(result.allEstimated).toBe(false);
  });

  it('tient compte du budget le plus serré du groupe, pas de celui du créateur', () => {
    const large = buildProposals(constraints(), [member('a', { food: 1 }, 150_000)], { keep: 40 });
    const contraint = buildProposals(
      constraints(),
      [member('a', { food: 1 }, 150_000), member('b', { food: 1 }, 30_000)],
      { keep: 40 },
    );
    const noteLarge = large.scores[0]!.factors.find((f) => f.key === 'price')!.score;
    const noteContrainte = contraint.scores[0]!.factors.find((f) => f.key === 'price')!.score;
    expect(noteContrainte).toBeLessThanOrEqual(noteLarge);
  });

  it('utilise le climat relevé plutôt que la saisonnalité approchée', () => {
    const result = buildProposals(constraints(), groupe, {
      sources: {
        climate: () => ({ month: 6, avgHighC: 45, avgLowC: 38, rainyDays: 0 }),
      },
      keep: 3,
    });
    for (const score of result.scores) {
      // 41 °C de moyenne : la note climat doit s'effondrer, sans que
      // l'absence de pluie ne vienne la racheter.
      expect(score.factors.find((f) => f.key === 'climate')!.score).toBe(0);
    }
  });

  it('note le climat sur les normales embarquées, sans source injectée', () => {
    const result = buildProposals(constraints({ month: 7 }), groupe, { keep: 6 });
    for (const score of result.scores) {
      const climat = score.factors.find((f) => f.key === 'climate')!;
      // Sans normales, on retomberait sur `bestMonths` et ses phrases toutes
      // faites. Avec elles, la raison affiche des degrés et des jours de pluie.
      expect(climat.reason, score.destinationId).toMatch(/°C en journée, -?\d+ °C la nuit, \d+ jours? de pluie/);
    }
  });

  it('préfère Séville en mai qu’en juillet, parce qu’il y fait 37 °C', () => {
    const noteEn = (mois: number): number => {
      const context: ScoreContext = {
        constraints: constraints({ month: mois }),
        members: groupe,
        transport: { cents: 12_000, source: 'estimated' },
        climate: climateFor('seville', mois)!,
      };
      return scoreDestination(findDestination('seville')!, context).factors.find(
        (f) => f.key === 'climate',
      )!.score;
    };
    expect(noteEn(5)).toBeGreaterThan(70);
    expect(noteEn(7)).toBeLessThan(30);
  });

  it('laisse le climat de côté quand la période n’est pas fixée', () => {
    const result = buildProposals(
      { ...constraints(), month: undefined, dateMode: 'window' as const },
      groupe,
      { keep: 3 },
    );
    for (const score of result.scores) {
      expect(score.factors.find((f) => f.key === 'climate')!.reason).toContain(
        'Période non fixée',
      );
    }
  });

  it('laisse une source injectée passer devant les normales embarquées', () => {
    const result = buildProposals(constraints({ month: 7 }), groupe, {
      sources: { climate: () => ({ month: 7, avgHighC: 21, avgLowC: 21, rainyDays: 0 }) },
      keep: 3,
    });
    for (const score of result.scores) {
      expect(score.factors.find((f) => f.key === 'climate')!.score).toBe(100);
    }
  });

  it('dit franchement quand rien ne correspond', () => {
    const result = buildProposals(constraints({ budgetPerPersonCents: 1000 }), groupe);
    expect(result.scores).toHaveLength(0);
    expect(summariseProposals(result)).toContain('Aucune destination');
  });

  it('reste déterministe pour un même groupe', () => {
    expect(buildProposals(constraints(), groupe)).toEqual(buildProposals(constraints(), groupe));
  });

  it('propose des villes réellement présentes au catalogue', () => {
    for (const score of buildProposals(constraints(), groupe).scores) {
      expect(findDestination(score.destinationId), score.destinationId).toBeDefined();
    }
  });
});
