/**
 * Règle produit non négociable : un prix n'est jamais présenté comme exact
 * s'il ne vient pas d'une source datée. Trois états, et seulement trois.
 */

export type PriceSource =
  /** Prix relevé sur une source réelle (cache Aviasales, Hotellook, SerpApi…). */
  | 'observed'
  /** Estimation calculée par Tripora à partir de moyennes. */
  | 'estimated'
  /** Aucune donnée exploitable. */
  | 'unavailable';

export interface PricedValue {
  cents: number | null;
  source: PriceSource;
  /** Nom lisible de la source, affiché à l'utilisateur. */
  provider?: string;
  /** Date de relevé, en ISO. Obligatoire quand `source === 'observed'`. */
  fetchedAt?: string;
}

/**
 * Au-delà de cette ancienneté, un prix relevé redevient une simple estimation.
 *
 * Calibré à 14 jours après avoir vu de vraies données : le cache Aviasales
 * remonte des relevés vieux de plusieurs jours, ce qui est normal — c'est un
 * cache, pas une cotation en direct. Avec le seuil initial de 72 h, la plupart
 * des vrais prix basculaient en « indicatif », c'est-à-dire dans la même case
 * que nos propres estimations. C'était perdre de l'information, pas en gagner :
 * un prix observé il y a cinq jours reste une observation, et afficher sa date
 * dit tout ce qu'il faut savoir. Au-delà de deux semaines, en revanche, il ne
 * renseigne plus sur rien.
 */
export const OBSERVED_PRICE_MAX_AGE_HOURS = 14 * 24;

export function hoursSince(iso: string, now: Date = new Date()): number {
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return Number.POSITIVE_INFINITY;
  return (now.getTime() - then) / 3_600_000;
}

/**
 * Déclasse automatiquement un prix relevé devenu trop vieux.
 * Appelée avant tout affichage : l'UI n'a pas à connaître la règle.
 */
export function assessFreshness(value: PricedValue, now: Date = new Date()): PricedValue {
  if (value.cents === null) return { ...value, source: 'unavailable' };
  if (value.source !== 'observed') return value;
  if (!value.fetchedAt || hoursSince(value.fetchedAt, now) > OBSERVED_PRICE_MAX_AGE_HOURS) {
    return { ...value, source: 'estimated' };
  }
  return value;
}

/** Étiquette affichée sous chaque prix. Jamais de prix nu dans l'interface. */
export function freshnessLabel(value: PricedValue, now: Date = new Date()): string {
  const assessed = assessFreshness(value, now);
  switch (assessed.source) {
    case 'observed': {
      const quand = quandCelaAEteVu(assessed.fetchedAt!, now);
      return assessed.provider ? `Prix vu ${quand} (${assessed.provider})` : `Prix vu ${quand}`;
    }
    case 'estimated':
      return 'Prix indicatif';
    case 'unavailable':
      return 'Prix non disponible';
  }
}

/**
 * « Vu il y a 3 jours » se comprend d'un coup d'œil, là où une date brute
 * demande un calcul mental. On repasse à la date au-delà d'une semaine, où
 * le décompte en jours cesse d'être parlant.
 */
function quandCelaAEteVu(iso: string, now: Date): string {
  const heures = hoursSince(iso, now);
  if (heures < 24) return 'aujourd’hui';
  const jours = Math.floor(heures / 24);
  if (jours === 1) return 'hier';
  if (jours <= 7) return `il y a ${jours} jours`;
  return `le ${new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}`;
}

/** La source la plus faible d'un ensemble : un total est aussi fiable que son pire élément. */
export function weakestSource(sources: readonly PriceSource[]): PriceSource {
  if (sources.includes('unavailable')) return 'unavailable';
  if (sources.includes('estimated')) return 'estimated';
  return 'observed';
}
