import { weakestSource, type PriceSource, type PricedValue } from './freshness.js';
import type { ComfortLevel, CostBreakdown, Destination } from './types.js';

/**
 * Coûts journaliers de référence, par personne, en centimes, pour une destination
 * d'indice de cherté 1 (moyenne européenne). Ces valeurs sont des **estimations
 * assumées** : elles ne sont jamais présentées comme des prix relevés.
 *
 * Sources : ordres de grandeur usuels pour l'Europe, révisables dans un seul endroit.
 */
export const DAILY_BASELINE_CENTS: Record<
  ComfortLevel,
  { accommodation: number; food: number; localTransport: number; activities: number }
> = {
  budget: { accommodation: 2500, food: 2000, localTransport: 500, activities: 1000 },
  mid: { accommodation: 5000, food: 3500, localTransport: 800, activities: 2000 },
  comfort: { accommodation: 10000, food: 6000, localTransport: 1500, activities: 3500 },
};

/** Marge pour les imprévus (souvenirs, pharmacie, bagage…). */
export const MISC_RATE = 0.07;

export interface CostInput {
  destination: Pick<Destination, 'costIndex'>;
  durationDays: number;
  comfortLevel: ComfortLevel;
  /** Aller-retour par personne. `null` quand aucune donnée n'est disponible. */
  transport: PricedValue;
  /** Hébergement relevé par personne et par nuit, s'il y en a un. Sinon on estime. */
  accommodationPerNight?: PricedValue;
}

/**
 * Calcule le coût **total** d'un voyage par personne.
 * C'est ce total, et non le prix du billet, qui sert à comparer deux destinations :
 * un vol plus cher vers une ville bon marché peut sortir gagnant.
 */
export function estimateTripCost(input: CostInput): CostBreakdown {
  const { destination, durationDays, comfortLevel } = input;
  const days = Math.max(1, Math.round(durationDays));
  const nights = Math.max(1, days - 1);
  const baseline = DAILY_BASELINE_CENTS[comfortLevel];
  const index = destination.costIndex;

  const accommodationObserved =
    input.accommodationPerNight && input.accommodationPerNight.cents !== null
      ? input.accommodationPerNight
      : null;

  const accommodationCents = accommodationObserved
    ? accommodationObserved.cents! * nights
    : Math.round(baseline.accommodation * index) * nights;

  const foodCents = Math.round(baseline.food * index) * days;
  const activitiesCents = Math.round(baseline.activities * index) * days;
  const localTransportCents = Math.round(baseline.localTransport * index) * days;
  const transportCents = input.transport.cents ?? 0;

  const subtotal =
    transportCents + accommodationCents + foodCents + activitiesCents + localTransportCents;
  const miscCents = Math.round(subtotal * MISC_RATE);

  const sources: PriceSource[] = [
    input.transport.cents === null ? 'unavailable' : input.transport.source,
    accommodationObserved ? accommodationObserved.source : 'estimated',
    'estimated', // nourriture, activités, transport local : toujours estimés
  ];

  return {
    transportCents,
    accommodationCents,
    foodCents,
    activitiesCents,
    localTransportCents,
    miscCents,
    totalCents: subtotal + miscCents,
    source: weakestSource(sources),
    transportSource: input.transport.cents === null ? 'unavailable' : input.transport.source,
    transportFetchedAt: input.transport.fetchedAt,
    transportProvider: input.transport.provider,
  };
}

/** Ventilation lisible pour l'interface, du poste le plus lourd au plus léger. */
export function costLines(
  cost: CostBreakdown,
): { key: string; label: string; cents: number }[] {
  return [
    { key: 'transport', label: 'Transport', cents: cost.transportCents },
    { key: 'accommodation', label: 'Hébergement', cents: cost.accommodationCents },
    { key: 'food', label: 'Nourriture', cents: cost.foodCents },
    { key: 'activities', label: 'Activités', cents: cost.activitiesCents },
    { key: 'localTransport', label: 'Transport sur place', cents: cost.localTransportCents },
    { key: 'misc', label: 'Divers', cents: cost.miscCents },
  ].sort((a, b) => b.cents - a.cents);
}
