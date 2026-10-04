import { describe, expect, it } from 'vitest';
import { distinguishScores } from './distinction.js';
import { buildProposals } from './proposals.js';
import { normalizeWeights } from './preferences.js';
import type { DestinationScore, ScoreFactor, TripConstraints } from './types.js';

function facteur(
  key: ScoreFactor['key'],
  score: number,
  weight = 0.2,
): ScoreFactor {
  return { key, label: LABELS[key], score, weight, reason: 'peu importe' };
}

const LABELS: Record<ScoreFactor['key'], string> = {
  price: 'Budget',
  preferences: 'Envies du groupe',
  climate: 'Météo de saison',
  travel: 'Trajet',
  activities: 'Activités',
  equity: 'Équité',
};

function score(
  id: string,
  total: number,
  totalCents: number,
  facteurs: ScoreFactor[],
): DestinationScore {
  return {
    destinationId: id,
    total,
    factors: facteurs,
    cost: {
      totalCents,
      transportCents: totalCents,
      accommodationCents: 0,
      foodCents: 0,
      activitiesCents: 0,
      localTransportCents: 0,
      miscCents: 0,
      source: 'estimated',
      transportSource: 'estimated',
    },
    memberSatisfaction: [],
    summary: '',
  };
}

describe('ce qui distingue une destination', () => {
  it('nomme la moins chère', () => {
    const phrases = distinguishScores([
      score('naples', 92, 27_200, [facteur('climate', 80)]),
      score('rome', 91, 30_000, [facteur('climate', 80)]),
    ]);
    expect(phrases.get('naples')).toContain('La moins chère du lot');
  });

  it('chiffre l’écart pour la plus chère', () => {
    const phrases = distinguishScores([
      score('naples', 92, 24_500, [facteur('climate', 80)]),
      score('rome', 91, 30_000, [facteur('climate', 80)]),
    ]);
    expect(phrases.get('rome')).toMatch(/55\s?€ au-dessus/u);
  });

  it('ne signale pas un écart de prix négligeable', () => {
    const phrases = distinguishScores([
      score('naples', 92, 28_000, [facteur('climate', 80)]),
      score('rome', 91, 28_500, [facteur('climate', 80)]),
    ]);
    expect(phrases.get('rome') ?? '').not.toContain('au-dessus');
  });

  it('ne sert jamais deux fois le même argument', () => {
    // Trois destinations « plus chères que la moins chère », c'est zéro
    // information. Chaque raison va à celle pour qui elle frappe le plus.
    const phrases = distinguishScores([
      score('a', 92, 24_000, [facteur('climate', 80), facteur('travel', 70)]),
      score('b', 91, 30_000, [facteur('climate', 80), facteur('travel', 70)]),
      score('c', 90, 31_000, [facteur('climate', 80), facteur('travel', 70)]),
      score('d', 89, 32_000, [facteur('climate', 80), facteur('travel', 70)]),
    ]);
    const chers = [...phrases.values()].filter((phrase) => phrase.includes('au-dessus'));
    expect(chers).toHaveLength(1);
  });

  it('ne laisse aucune proposition sans phrase', () => {
    const phrases = distinguishScores([
      score('a', 92, 28_000, [facteur('climate', 80), facteur('travel', 70)]),
      score('b', 91, 28_000, [facteur('climate', 80), facteur('travel', 70)]),
      score('c', 90, 28_000, [facteur('climate', 80), facteur('travel', 70)]),
    ]);
    expect(phrases.size).toBe(3);
    for (const phrase of phrases.values()) expect(phrase.length).toBeGreaterThan(10);
  });

  it('décerne un superlatif seulement s’il est net', () => {
    // Deux points d'écart, c'est un tirage au sort déguisé : on se tait.
    const serre = distinguishScores([
      score('a', 92, 28_000, [facteur('climate', 82)]),
      score('b', 91, 28_000, [facteur('climate', 80)]),
    ]);
    // Elle peut dire qu'elle devance légèrement, mais pas se proclamer
    // « la mieux lotie » : deux points, c'est un tirage au sort déguisé.
    expect(serre.get('a') ?? '').not.toContain('mieux lotie');

    const net = distinguishScores([
      score('a', 92, 28_000, [facteur('climate', 95)]),
      score('b', 91, 28_000, [facteur('climate', 60)]),
    ]);
    expect(net.get('a')).toContain('météo');
  });

  it('dit franchement quand la tête ne mène à rien', () => {
    const phrases = distinguishScores([
      score('a', 91, 28_000, [facteur('climate', 80)]),
      score('b', 91, 28_000, [facteur('climate', 80)]),
    ]);
    expect(phrases.get('a')).toContain('d’un cheveu');
  });

  it('chiffre l’avance quand elle existe', () => {
    const phrases = distinguishScores([
      score('a', 92, 28_000, [facteur('climate', 80)]),
      score('b', 85, 28_000, [facteur('climate', 80)]),
    ]);
    expect(phrases.get('a')).toContain('En tête de 7 points');
  });

  it('signale la faiblesse la plus criante', () => {
    const phrases = distinguishScores([
      score('a', 90, 28_000, [facteur('climate', 80), facteur('travel', 30)]),
      score('b', 88, 28_000, [facteur('climate', 80), facteur('travel', 85)]),
    ]);
    expect(phrases.get('a')).toContain('trajet');
  });

  it('ne dit rien plutôt que de dire du vide', () => {
    // Une seule destination : il n'y a rien à comparer, donc rien à écrire.
    expect(distinguishScores([score('a', 90, 28_000, [facteur('climate', 80)])]).size).toBe(0);
    expect(distinguishScores([]).size).toBe(0);
  });

  it('ignore un facteur qui ne pèse rien', () => {
    const phrases = distinguishScores([
      score('a', 90, 28_000, [facteur('climate', 99, 0)]),
      score('b', 88, 28_000, [facteur('climate', 10, 0)]),
    ]);
    expect(phrases.get('a') ?? '').not.toContain('météo');
  });
});

describe('sur un vrai classement', () => {
  const constraints: TripConstraints = {
    participants: 3,
    origin: { name: 'Lyon', lat: 45.764, lng: 4.8357, iata: ['LYS'] },
    durationDays: 4,
    dateMode: 'month',
    month: 10,
    budgetMode: 'max_per_person',
    budgetPerPersonCents: 40_000,
    comfortLevel: 'budget',
    groupType: 'friends',
  };

  it('donne à chaque proposition une phrase qui lui est propre', () => {
    // C'est le vrai test : six villes méditerranéennes notées 90-92 doivent
    // quand même se distinguer, sinon le classement ne sert à rien.
    const result = buildProposals(constraints, [
      { userId: 'a', weights: normalizeWeights({ food: 1, culture: 0.66 }), budgetMaxCents: 40_000 },
    ], { keep: 6 });
    const phrases = distinguishScores(result.scores);

    // Chacune des six doit avoir sa phrase, et aucune ne doit répéter l'autre.
    expect(phrases.size).toBe(result.scores.length);
    expect(new Set(phrases.values()).size).toBe(phrases.size);
    for (const phrase of phrases.values()) {
      expect(phrase.length).toBeGreaterThan(10);
      expect(phrase.endsWith('.')).toBe(true);
    }
  });
});
