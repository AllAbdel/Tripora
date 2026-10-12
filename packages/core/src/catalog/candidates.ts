import { targetMonth } from '../dates.js';
import { haversineKm } from '../geo.js';
import { estimateTripCost } from '../cost.js';
import { continentDe } from '../continents.js';
import { DESTINATIONS } from './destinations.js';
import { estUnDepartPays } from './origins.js';
import type { Destination, TripConstraints } from '../types.js';

/**
 * Présélection des destinations à étudier.
 *
 * Étape volontairement grossière et gratuite : elle tourne en mémoire sur le
 * catalogue local, sans le moindre appel réseau. Son seul rôle est de ramener
 * une cinquantaine de villes à une vingtaine de candidates crédibles, pour
 * n'interroger les APIs de prix que sur celles-là. C'est ce filtre qui rend la
 * suggestion soutenable dans les quotas gratuits.
 *
 * Trois garde-fous contre la monotonie, ajoutés quand un départ « France »
 * ramenait toujours Bruxelles, Prague, Budapest et Berlin :
 *
 *  - **le groupe peut dire où chercher** (`regions`) : seuls ces continents
 *    sont étudiés, sans borne de distance ;
 *  - **pas plus de deux villes d'un même pays** parmi les candidates, tant
 *    qu'il en reste d'ailleurs ;
 *  - **partir de tout un pays, c'est partir à l'étranger** : ses propres villes
 *    ne sont pas proposées.
 */
export interface CandidateOptions {
  /** Nombre maximum de candidates renvoyées. Chacune coûtera un appel de prix. */
  limit?: number;
  /** Distance maximale à vol d'oiseau. Par défaut, déduite de la durée du séjour. */
  maxDistanceKm?: number;
  /** Identifiants à ne pas proposer (déjà vus, déjà rejetés). */
  exclude?: readonly string[];
  /** Au plus tant de villes d'un même pays, tant qu'il en reste d'ailleurs. */
  parPays?: number;
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
  const regions = new Set(constraints.regions ?? []);
  // Des continents choisis : la distance n'est plus une raison d'écarter.
  const maxDistance =
    options.maxDistanceKm ??
    (regions.size > 0 ? Number.POSITIVE_INFINITY : reasonableDistanceKm(constraints.durationDays));
  // Pour le tri, une échelle finie : à l'autre bout du monde, 20 000 km.
  const echelle = Number.isFinite(maxDistance) ? maxDistance : 20_000;
  const excluded = new Set(options.exclude ?? []);
  const month = targetMonth(constraints);
  const paysDeDepart = estUnDepartPays(constraints.origin) ? constraints.origin.country : undefined;

  const scored = catalog
    .filter((destination) => {
      if (excluded.has(destination.id)) return false;
      if (regions.size > 0) {
        const continent = continentDe(destination.countryCode);
        if (!continent || !regions.has(continent)) return false;
      }
      // Partir de tout un pays, c'est partir à l'étranger.
      if (paysDeDepart && destination.country === paysDeDepart) return false;
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
        haversineKm(constraints.origin, destination) / echelle +
        destination.costIndex * 0.4 -
        destination.poiRichness * 0.3,
    }))
    .sort((a, b) => a.rough - b.rough || a.destination.id.localeCompare(b.destination.id));

  return diversifier(
    scored.map((entry) => entry.destination),
    limit,
    options.parPays ?? 2,
  );
}

/**
 * Les `limit` premières, sans plus de `parPays` villes d'un même pays tant
 * qu'il en reste d'ailleurs ; s'il n'y a pas assez de pays, on complète dans
 * l'ordre. L'ordre de départ est conservé.
 */
export function diversifier<T extends { countryCode: string }>(
  rangees: readonly T[],
  limit: number,
  parPays: number,
): T[] {
  const retenues: T[] = [];
  const ecartees: T[] = [];
  const parCode = new Map<string, number>();
  for (const element of rangees) {
    if (retenues.length >= limit) break;
    const deja = parCode.get(element.countryCode) ?? 0;
    if (deja >= parPays) {
      ecartees.push(element);
      continue;
    }
    parCode.set(element.countryCode, deja + 1);
    retenues.push(element);
  }
  for (const element of ecartees) {
    if (retenues.length >= limit) break;
    retenues.push(element);
  }
  return retenues;
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
