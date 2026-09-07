import { estimateTripCost, type CostInput } from './cost.js';
import { targetMonth } from './dates.js';
import { estimateTravelMinutes, haversineKm } from './geo.js';
import {
  PREFERENCE_AXES, AXIS_LABELS_FR, groupWeights, type PreferenceWeights,
} from './preferences.js';
import type { PricedValue } from './freshness.js';
import type {
  Destination,
  DestinationScore,
  MemberPreference,
  MonthlyClimate,
  ScoreFactor,
  TripConstraints,
} from './types.js';

/**
 * Poids des six facteurs dans la note finale. Ils sont exposés pour être
 * ajustables, mais leur somme doit rester égale à 1.
 */
export const DEFAULT_FACTOR_WEIGHTS = {
  price: 0.35,
  preferences: 0.3,
  climate: 0.1,
  travel: 0.1,
  activities: 0.1,
  equity: 0.05,
} as const;

export type FactorWeights = typeof DEFAULT_FACTOR_WEIGHTS;

/**
 * Pondération entre le bonheur moyen du groupe et celui de la personne la moins servie.
 * C'est le cœur de la promesse produit : un voyage ne doit pas être optimisé
 * pour son créateur, et personne ne doit subir la destination des autres.
 */
export const GROUP_MEAN_SHARE = 0.6;
export const GROUP_MIN_SHARE = 0.4;

const clamp = (value: number, min = 0, max = 100): number =>
  Math.min(max, Math.max(min, value));

/**
 * Satisfaction d'une personne pour une destination, entre 0 et 1.
 * Lecture : « parmi les choses qui comptent pour toi, combien cette ville en offre ? »
 */
export function memberSatisfaction(
  weights: PreferenceWeights,
  destination: Destination,
  avoid: readonly string[] = [],
): number {
  let weighted = 0;
  let totalWeight = 0;
  for (const axis of PREFERENCE_AXES) {
    const weight = weights[axis];
    if (weight <= 0) continue;
    weighted += weight * destination.tags[axis];
    totalWeight += weight;
  }
  // Personne sans préférence exprimée : neutre, ni contente ni déçue.
  let value = totalWeight === 0 ? 0.5 : weighted / totalWeight;

  // Un axe explicitement rejeté et très présent sur place pénalise la destination.
  for (const axis of avoid) {
    const presence = destination.tags[axis as keyof PreferenceWeights];
    if (typeof presence === 'number') value -= presence * 0.25;
  }
  return Math.min(1, Math.max(0, value));
}

/** Budget réellement contraignant : celui de la personne qui peut mettre le moins. */
export function bindingBudgetCents(
  members: readonly MemberPreference[],
  constraints: TripConstraints,
): number | null {
  const budgets = members
    .map((member) => member.budgetMaxCents)
    .filter((value): value is number => typeof value === 'number' && value > 0);
  if (budgets.length > 0) return Math.min(...budgets);
  return constraints.budgetPerPersonCents;
}

function priceFactor(
  totalCents: number,
  budgetCents: number | null,
  mode: TripConstraints['budgetMode'],
  cheapestCents: number | null,
): { score: number; reason: string } {
  if (mode === 'cheapest' && cheapestCents && cheapestCents > 0) {
    const ratio = cheapestCents / Math.max(1, totalCents);
    const score = clamp(ratio * 100);
    const overBudget = budgetCents !== null && totalCents > budgetCents;
    if (overBudget) {
      return { score: Math.min(score, 35), reason: 'Dépasse le budget le plus serré du groupe' };
    }
    return {
      score,
      reason:
        score >= 97
          ? 'Option la moins chère du lot'
          : `Environ ${Math.round(100 / ratio - 100)} % de plus que l'option la moins chère`,
    };
  }

  if (budgetCents === null || budgetCents <= 0) {
    return { score: 60, reason: 'Aucun budget renseigné, prix non comparé' };
  }

  const ratio = totalCents / budgetCents;
  if (ratio <= 0.6) {
    return { score: 100, reason: 'Nettement sous le budget du groupe' };
  }
  if (ratio <= 1) {
    return {
      score: clamp(100 - (ratio - 0.6) * 75),
      reason: `Tient dans le budget (${Math.round(ratio * 100)} % de l'enveloppe)`,
    };
  }
  if (ratio <= 1.3) {
    return {
      score: clamp(70 - (ratio - 1) * 233),
      reason: `Dépasse le budget d'environ ${Math.round((ratio - 1) * 100)} %`,
    };
  }
  return { score: 0, reason: 'Hors budget pour au moins une personne du groupe' };
}

/**
 * Fourchette de température de journée dans laquelle on visite une ville sans
 * y penser. En dessous, on se couvre ; au-dessus, on cherche l'ombre.
 */
const CONFORT_MIN_C = 17;
const CONFORT_MAX_C = 27;

function climateFactor(
  destination: Destination,
  month: number | undefined,
  climate: MonthlyClimate | undefined,
): { score: number; reason: string } {
  if (climate) {
    // On note le maximum de la journée, pas la moyenne jour/nuit : c'est en
    // plein après-midi qu'on marche dans la ville. Séville en juillet affiche
    // 29 °C de moyenne, ce qui paraît idéal, et 37 °C à 16 h, ce qui ne l'est
    // pas du tout.
    const jour = climate.avgHighC;
    let tempScore = 100;
    if (jour < CONFORT_MIN_C) {
      // Frais, on met un manteau et la ville reste visitable ; froid, les
      // journées dehors se raccourcissent d'elles-mêmes.
      const manque = CONFORT_MIN_C - jour;
      tempScore -= Math.min(manque, 7) * 4 + Math.max(0, manque - 7) * 5.5;
    } else if (jour > CONFORT_MAX_C) {
      // La chaleur, non : passé 33 °C, l'après-midi est perdu, et la pente
      // s'accentue.
      const exces = jour - CONFORT_MAX_C;
      tempScore -= Math.min(exces, 6) * 6 + Math.max(0, exces - 6) * 9;
    }
    // Nuits gelées : plus de terrasses, plus de soirées dehors.
    if (climate.avgLowC < 0) tempScore -= Math.min(10, -climate.avgLowC * 1.5);
    tempScore = clamp(tempScore);

    const rainScore = clamp(100 - climate.rainyDays * 6);
    // La pluie module la température, elle ne la rachète pas : aucun grand
    // soleil ne rend 41 °C agréables, alors qu'un mois pluvieux gâche un mois
    // par ailleurs parfait.
    const score = Math.round(tempScore * (0.7 + 0.3 * (rainScore / 100)));
    return {
      score,
      reason: `${Math.round(jour)} °C en journée, ${Math.round(climate.avgLowC)} °C la nuit, ${climate.rainyDays} jour${climate.rainyDays > 1 ? 's' : ''} de pluie dans le mois`,
    };
  }

  if (month === undefined) {
    return { score: 70, reason: 'Période non fixée, climat non départageant' };
  }
  if (destination.bestMonths.includes(month)) {
    return { score: 95, reason: 'Bonne période pour cette destination' };
  }
  const distance = Math.min(
    ...destination.bestMonths.map((best) => {
      const gap = Math.abs(best - month);
      return Math.min(gap, 12 - gap);
    }),
  );
  if (!Number.isFinite(distance)) {
    return { score: 70, reason: 'Saisonnalité inconnue' };
  }
  return {
    score: clamp(95 - distance * 18),
    reason: distance <= 1 ? 'Juste en dehors de la meilleure saison' : 'Hors saison idéale',
  };
}

function travelFactor(minutes: number): { score: number; reason: string } {
  const hours = minutes / 60;
  const score = clamp(100 - Math.max(0, hours - 2) * 8);
  const readable =
    hours < 1.5
      ? `${Math.round(minutes)} min de trajet`
      : `environ ${hours.toLocaleString('fr-FR', {
          maximumFractionDigits: hours < 10 ? 1 : 0,
        })} h de trajet porte à porte`;
  return { score, reason: readable.charAt(0).toUpperCase() + readable.slice(1) };
}

function activitiesFactor(
  destination: Destination,
  durationDays: number,
): { score: number; reason: string } {
  // Plus le séjour est long, plus il faut de matière pour ne pas tourner en rond.
  const demand = Math.min(1, 0.45 + durationDays * 0.07);
  const score = clamp((destination.poiRichness / demand) * 100);
  if (score >= 85) return { score, reason: `De quoi remplir ${durationDays} jours largement` };
  if (score >= 60) return { score, reason: `Assez d'activités pour ${durationDays} jours` };
  return { score, reason: `Offre limitée pour un séjour de ${durationDays} jours` };
}

function equityFactor(
  satisfactions: readonly number[],
): { score: number; reason: string } {
  if (satisfactions.length <= 1) {
    return { score: 100, reason: 'Un seul jeu de préférences à satisfaire' };
  }
  const min = Math.min(...satisfactions);
  const max = Math.max(...satisfactions);
  const spread = max - min;
  const score = clamp(100 - spread * 130);
  if (spread < 0.15) return { score, reason: 'Convient à tout le monde de la même façon' };
  if (spread < 0.35) return { score, reason: 'Convient à tous, un peu moins à une personne' };
  return { score, reason: 'Choix clivant : une personne y trouverait peu son compte' };
}

export interface ScoreContext {
  constraints: TripConstraints;
  members: readonly MemberPreference[];
  /** Prix de transport aller-retour par personne, déjà relevé ou estimé. */
  transport: PricedValue;
  accommodationPerNight?: PricedValue;
  climate?: MonthlyClimate;
  /** Coût total le moins cher parmi les candidates, pour le mode « le moins cher possible ». */
  cheapestTotalCents?: number | null;
  factorWeights?: FactorWeights;
}

/**
 * Note une destination pour un groupe donné.
 *
 * Entièrement déterministe : mêmes entrées, même sortie. L'IA n'intervient
 * jamais ici ; elle ne fait que reformuler `summary` et les `reason` produits.
 */
export function scoreDestination(
  destination: Destination,
  context: ScoreContext,
): DestinationScore {
  const { constraints, members } = context;
  const weights = context.factorWeights ?? DEFAULT_FACTOR_WEIGHTS;

  const costInput: CostInput = {
    destination,
    durationDays: constraints.durationDays,
    comfortLevel: constraints.comfortLevel,
    transport: context.transport,
    accommodationPerNight: context.accommodationPerNight,
  };
  const cost = estimateTripCost(costInput);

  const satisfactions = members.map((member) => ({
    userId: member.userId,
    value: memberSatisfaction(member.weights, destination, member.avoid ?? []),
  }));
  const values = satisfactions.map((s) => s.value);
  const mean = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0.5;
  const min = values.length > 0 ? Math.min(...values) : 0.5;
  const groupSatisfaction = GROUP_MEAN_SHARE * mean + GROUP_MIN_SHARE * min;

  const distanceKm = haversineKm(constraints.origin, destination);
  const travelMinutes = estimateTravelMinutes(distanceKm);

  const month = targetMonth(constraints);

  const price = priceFactor(
    cost.totalCents,
    bindingBudgetCents(members, constraints),
    constraints.budgetMode,
    context.cheapestTotalCents ?? null,
  );
  const climate = climateFactor(destination, month, context.climate);
  const travel = travelFactor(travelMinutes);
  const activities = activitiesFactor(destination, constraints.durationDays);
  const equity = equityFactor(values);

  const preferenceReason = describePreferenceMatch(destination, members);

  const factors: ScoreFactor[] = [
    { key: 'price', label: 'Budget', weight: weights.price, ...price },
    {
      key: 'preferences',
      label: 'Envies du groupe',
      weight: weights.preferences,
      score: Math.round(groupSatisfaction * 100),
      reason: preferenceReason,
    },
    { key: 'climate', label: 'Météo de saison', weight: weights.climate, ...climate },
    { key: 'travel', label: 'Trajet', weight: weights.travel, ...travel },
    { key: 'activities', label: 'Activités', weight: weights.activities, ...activities },
    { key: 'equity', label: 'Équité', weight: weights.equity, ...equity },
  ];

  const total = Math.round(
    factors.reduce((acc, factor) => acc + factor.score * factor.weight, 0),
  );

  return {
    destinationId: destination.id,
    total: clamp(total),
    factors,
    cost,
    memberSatisfaction: satisfactions,
    summary: buildSummary(destination, total, factors),
  };
}

function describePreferenceMatch(
  destination: Destination,
  members: readonly MemberPreference[],
): string {
  const envies = groupWeights(members);
  const fortes = PREFERENCE_AXES.filter((axis) => (envies[axis] ?? 0) >= 0.3)
    .sort((a, b) => envies[b]! - envies[a]!)
    .slice(0, 2);

  if (fortes.length === 0) return 'Aucune envie précise renseignée par le groupe';

  const parts = fortes.map((axis) => {
    const note = Math.round(destination.tags[axis] * 10);
    return `${AXIS_LABELS_FR[axis].toLowerCase()} ${note}/10`;
  });
  return `Sur vos priorités : ${parts.join(', ')}`;
}

/** Résumé factuel, toujours construit par le code : trois faits, aucune promesse. */
function buildSummary(
  destination: Destination,
  total: number,
  factors: readonly ScoreFactor[],
): string {
  const ranked = [...factors].sort((a, b) => b.score * b.weight - a.score * a.weight);
  const best = ranked.slice(0, 2).map((factor) => factor.reason.toLowerCase());
  const worst = ranked[ranked.length - 1];
  const caveat = worst && worst.score < 55 ? ` En revanche : ${worst.reason.toLowerCase()}.` : '';
  return `${destination.name} obtient ${total}/100 : ${best.join(', ')}.${caveat}`;
}

/** Note et classe un lot de destinations. Le tri est stable à note égale. */
export function rankDestinations(
  destinations: readonly Destination[],
  contextFor: (destination: Destination) => ScoreContext,
): DestinationScore[] {
  return destinations
    .map((destination) => scoreDestination(destination, contextFor(destination)))
    .sort((a, b) => b.total - a.total || a.destinationId.localeCompare(b.destinationId));
}
