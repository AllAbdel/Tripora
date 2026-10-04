import { targetMonth } from '../dates.js';
import { haversineKm } from '../geo.js';
import { estimateTripCost } from '../cost.js';
import { DESTINATIONS } from './destinations.js';
import type { Destination, TripConstraints } from '../types.js';

/**
 * Présélection des destinations à étudier.
 *
 * Étape volontairement grossière et gratuite : elle tourne en mémoire sur le
 * catalogue local, sans le moindre appel réseau. Son seul rôle est de ramener
 * une cinquantaine de villes à une vingtaine de candidates crédibles, pour
 * n'interroger les APIs de prix que sur celles-là. C'est ce filtre qui rend la
 * suggestion soutenable dans les quotas gratuits.
 */
export interface CandidateOptions {
  /** Nombre maximum de candidates renvoyées. Chacune coûtera un appel de prix. */
  limit?: number;
  /** Distance maximale à vol d'oiseau. Par défaut, déduite de la durée du séjour. */
  maxDistanceKm?: number;
  /** Identifiants à ne pas proposer (déjà vus, déjà rejetés). */
  exclude?: readonly string[];
  catalog?: readonly Destination[];
}

/**
 * Distance raisonnable selon la durée : partir 2 jours à 3 000 km, c'est passer
 * son week-end dans les transports.
 */
export function reasonableDistanceKm(durationDays: number): number {
  if (durationDays <= 2) return 1200;
  if (durationDays <= 4) return 2500;
  if (durationDays <= 7) return 4000;
  return 8000;
}

/** Un mois est acceptable s'il est proche d'une bonne période (tolérance d'un mois). */
export function isReasonableSeason(destination: Destination, month: number | undefined): boolean {
  if (month === undefined || destination.bestMonths.length === 0) return true;
  return destination.bestMonths.some((best) => {
    const gap = Math.abs(best - month);
    return Math.min(gap, 12 - gap) <= 1;
  });
}

export function selectCandidates(
  constraints: TripConstraints,
  options: CandidateOptions = {},
): Destination[] {
  const catalog = options.catalog ?? DESTINATIONS;
  const limit = options.limit ?? 20;
  const maxDistance = options.maxDistanceKm ?? reasonableDistanceKm(constraints.durationDays);
  const excluded = new Set(options.exclude ?? []);
  const month = targetMonth(constraints);

  const scored = catalog
    .filter((destination) => {
      if (excluded.has(destination.id)) return false;
      // On ne propose pas la ville d'où l'on part.
      if (haversineKm(constraints.origin, destination) < 60) return false;
      if (haversineKm(constraints.origin, destination) > maxDistance) return false;
      if (!isReasonableSeason(destination, month)) return false;
      return affordableOnTheGround(destination, constraints);
    })
    .map((destination) => ({
      destination,
      // Tri provisoire : proche et abordable d'abord, le vrai score viendra
      // après, une fois les prix relevés.
      rough:
        haversineKm(constraints.origin, destination) / maxDistance +
        destination.costIndex * 0.4 -
        destination.poiRichness * 0.3,
    }))
    .sort((a, b) => a.rough - b.rough || a.destination.id.localeCompare(b.destination.id));

  return scored.slice(0, limit).map((entry) => entry.destination);
}

/**
 * Écarte les villes dont le seul coût sur place dépasse déjà le budget, sans
 * même compter le transport : inutile de dépenser un appel d'API pour elles.
 */
function affordableOnTheGround(
  destination: Destination,
  constraints: TripConstraints,
): boolean {
  if (constraints.budgetPerPersonCents === null) return true;
  const onTheGround = estimateTripCost({
    destination,
    durationDays: constraints.durationDays,
    comfortLevel: constraints.comfortLevel,
    transport: { cents: 0, source: 'estimated' },
  });
  return onTheGround.totalCents <= constraints.budgetPerPersonCents;
}
