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
  /**
   * Le site qui vendait à ce prix-là, quand la source le dit.
   *
   * Distinct de `provider` : Aviasales agrège, mais le tarif vient d'une
   * agence précise — Trip.com, Kiwi, une compagnie en direct. Sans cette
   * mention, « prix vu sur Aviasales » laisse croire qu'on achète là-bas.
   */
  reseller?: string;
  /**
   * Nombre de changements du trajet auquel ce prix correspond.
   *
   * `0` pour un direct, `undefined` quand la source ne le dit pas — ce qui
   * n'est pas la même chose, et l'écran doit pouvoir faire la différence
   * plutôt que d'annoncer un vol direct par défaut.
   */
  stops?: number;
  /** Dates du trajet relevé, en ISO. Un prix sans date ne se compare pas. */
  departAt?: string;
  returnAt?: string;
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

/** D'où vient ce prix, en une phrase qui nomme le site. */
export interface Provenance {
  /** « Relevé le 8 sept. sur Aviasales » — court, pour tenir sous un montant. */
  court: string;
  /** La phrase complète, revendeur et dates compris. */
  long: string;
  /** Vrai quand un vrai site a été consulté, faux pour une estimation maison. */
  releve: boolean;
}

/**
 * Dire d'où vient chaque prix, toujours, et nommer le site.
 *
 * `freshnessLabel` donne l'étiquette courte posée sous un montant. Celle-ci va
 * plus loin : un prix affiché engage, et « prix indicatif » ne dit pas qui a
 * estimé quoi. Un voyageur qui voit 420 € doit pouvoir savoir en une ligne si
 * quelqu'un vend à ce prix, ou si c'est Tripora qui l'a calculé.
 */
export function describeSource(value: PricedValue, now: Date = new Date()): Provenance {
  const assessed = assessFreshness(value, now);

  if (assessed.source === 'unavailable') {
    return {
      court: 'Prix non disponible',
      long: 'Aucune source n’a de prix pour ce trajet.',
      releve: false,
    };
  }

  if (assessed.source === 'estimated') {
    return {
      court: 'Estimation Tripora',
      long:
        'Estimation calculée par Tripora à partir de la distance et de moyennes ' +
        'de marché. Aucun site n’a été consulté pour ce montant.',
      releve: false,
    };
  }

  const site = assessed.provider ?? 'une source datée';
  const quand = quandCelaAEteVu(assessed.fetchedAt!, now);
  const revendeur = assessed.reseller ? `, vendu par ${assessed.reseller}` : '';
  const dates = decrireLesDates(assessed.departAt, assessed.returnAt);
  return {
    court: `Relevé ${quand} sur ${site}`,
    long: `Prix relevé ${quand} sur ${site}${revendeur}${dates}.`,
    releve: true,
  };
}

function decrireLesDates(depart: string | undefined, retour: string | undefined): string {
  const jour = (iso: string | undefined): string | null => {
    if (!iso) return null;
    const date = new Date(iso);
    return Number.isNaN(date.getTime())
      ? null
      : date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  };
  const aller = jour(depart);
  const rentree = jour(retour);
  if (aller && rentree) return `, pour un aller le ${aller} et un retour le ${rentree}`;
  if (aller) return `, pour un départ le ${aller}`;
  return '';
}

/** La source la plus faible d'un ensemble : un total est aussi fiable que son pire élément. */
export function weakestSource(sources: readonly PriceSource[]): PriceSource {
  if (sources.includes('unavailable')) return 'unavailable';
  if (sources.includes('estimated')) return 'estimated';
  return 'observed';
}
