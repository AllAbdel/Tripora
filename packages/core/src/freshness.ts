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

/** Au-delà de cette ancienneté, un prix relevé redevient une simple estimation. */
export const OBSERVED_PRICE_MAX_AGE_HOURS = 72;

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
      const date = new Date(assessed.fetchedAt!).toLocaleDateString('fr-FR', {
        day: 'numeric',
        month: 'short',
      });
      return assessed.provider
        ? `Prix vu le ${date} (${assessed.provider})`
        : `Prix vu le ${date}`;
    }
    case 'estimated':
      return 'Prix indicatif';
    case 'unavailable':
      return 'Prix non disponible';
  }
}

/** La source la plus faible d'un ensemble : un total est aussi fiable que son pire élément. */
export function weakestSource(sources: readonly PriceSource[]): PriceSource {
  if (sources.includes('unavailable')) return 'unavailable';
  if (sources.includes('estimated')) return 'estimated';
  return 'observed';
}
