import { haversineKm } from './geo.js';
import type { PricedValue } from './freshness.js';
import type { GeoPoint, TransportMode } from './types.js';

/**
 * Estimation du transport, en attendant les prix relevés.
 *
 * Tant qu'aucune source de prix n'est branchée, Tripora doit quand même savoir
 * comparer deux destinations. Ces modèles donnent un ordre de grandeur crédible
 * pour l'Europe, et **tout ce qu'ils produisent est marqué « indicatif »** :
 * jamais un prix estimé ne sera présenté comme un prix constaté.
 *
 * Dès qu'une source réelle répond (cache Aviasales), elle remplace l'estimation
 * pour le vol, et l'étiquette devient « prix vu le … ».
 *
 * Ordres de grandeur retenus, aller-retour par personne :
 *   avion  : 40 € de base + 5,5 c/km — 500 km ≈ 67 €, 2 000 km ≈ 150 €
 *   train  : 17 c/km                 — 500 km ≈ 85 €, 1 000 km ≈ 170 €
 *   bus    : 9 c/km                  — 500 km ≈ 45 €, 1 500 km ≈ 135 €
 *   voiture: carburant et péages partagés entre les occupants
 */

export interface TransportEstimate {
  mode: TransportMode;
  price: PricedValue;
  durationMin: number;
  /** Pourquoi ce mode est proposé, ou pourquoi il ne l'est pas. */
  note: string;
}

const PLANE_BASE_CENTS = 4000;
const PLANE_PER_KM_CENTS = 5.5;
const TRAIN_PER_KM_CENTS = 17;
const BUS_PER_KM_CENTS = 9;
/** Consommation et péages moyens, par kilomètre et par véhicule. */
const CAR_PER_KM_CENTS = 14;

/** Détour moyen d'une route par rapport à la ligne droite. */
const ROAD_DETOUR = 1.25;

const estimated = (cents: number): PricedValue => ({
  cents: Math.round(cents),
  source: 'estimated',
});

/**
 * Options de transport plausibles entre deux points, de la moins chère à la
 * plus chère. Le nombre de participants ne change que la voiture, qui se
 * partage.
 */
export function estimateTransportOptions(
  origin: GeoPoint,
  destination: GeoPoint,
  participants = 1,
): TransportEstimate[] {
  const direct = haversineKm(origin, destination);
  const road = direct * ROAD_DETOUR;
  const options: TransportEstimate[] = [];

  if (direct >= 300) {
    options.push({
      mode: 'plane',
      price: estimated(PLANE_BASE_CENTS + direct * PLANE_PER_KM_CENTS),
      durationMin: Math.round(120 + (direct / 750) * 60 + 120),
      note: 'Vol aller-retour, transferts aéroport compris',
    });
  }

  if (road <= 1600) {
    options.push({
      mode: 'train',
      price: estimated(road * TRAIN_PER_KM_CENTS),
      durationMin: Math.round((road / 130) * 60 * 2),
      note: 'Train aller-retour, de centre-ville à centre-ville',
    });
  }

  if (road <= 2000) {
    options.push({
      mode: 'bus',
      price: estimated(road * BUS_PER_KM_CENTS),
      durationMin: Math.round((road / 65) * 60 * 2),
      note: 'Bus aller-retour : le moins cher, le plus long',
    });
  }

  if (road <= 2000 && participants >= 1) {
    // Une voiture pour quatre revient à un quart du carburant chacun.
    const occupants = Math.min(5, Math.max(1, participants));
    options.push({
      mode: 'car',
      price: estimated((road * 2 * CAR_PER_KM_CENTS) / occupants),
      durationMin: Math.round((road / 90) * 60 * 2),
      note:
        occupants > 1
          ? `Voiture partagée à ${occupants}, carburant et péages estimés`
          : 'Voiture seul, carburant et péages estimés',
    });
  }

  return options.sort((a, b) => (a.price.cents ?? 0) - (b.price.cents ?? 0));
}

/** L'option la moins chère, celle qui sert de référence au budget. */
export function cheapestTransport(
  origin: GeoPoint,
  destination: GeoPoint,
  participants = 1,
): TransportEstimate | null {
  return estimateTransportOptions(origin, destination, participants)[0] ?? null;
}

/** L'option au meilleur compromis temps/prix, souvent la plus raisonnable. */
export function bestValueTransport(
  origin: GeoPoint,
  destination: GeoPoint,
  participants = 1,
): TransportEstimate | null {
  const options = estimateTransportOptions(origin, destination, participants);
  if (options.length === 0) return null;
  // On paie chaque heure gagnée : 8 € l'heure, ce qui départage un bus à 55 €
  // en 8 h d'un train à 95 € en 5 h sans favoriser systématiquement l'avion.
  const HOUR_VALUE_CENTS = 800;
  return [...options].sort(
    (a, b) =>
      (a.price.cents ?? 0) + (a.durationMin / 60) * HOUR_VALUE_CENTS -
      ((b.price.cents ?? 0) + (b.durationMin / 60) * HOUR_VALUE_CENTS),
  )[0]!;
}

export const TRANSPORT_LABELS_FR: Record<TransportMode, string> = {
  plane: 'Avion',
  train: 'Train',
  bus: 'Bus',
  car: 'Voiture',
  ferry: 'Ferry',
};
