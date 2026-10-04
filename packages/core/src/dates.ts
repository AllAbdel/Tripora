import { MONTHS_FR } from './preferences.js';
import type { TripConstraints } from './types.js';

/**
 * Mois que vise le voyage, de 1 à 12, ou rien s'il n'est pas encore arrêté.
 *
 * Trois écrans et trois modules posaient la même question et la résolvaient
 * chacun de leur côté ; il suffisait qu'une des copies oublie `startDate` pour
 * qu'une destination soit notée sur un autre mois que celui affiché. Une seule
 * réponse, ici.
 */
export function targetMonth(constraints: TripConstraints): number | undefined {
  if (typeof constraints.month === 'number') return constraints.month;
  if (constraints.startDate) {
    const mois = new Date(constraints.startDate).getUTCMonth() + 1;
    return Number.isNaN(mois) ? undefined : mois;
  }
  if (constraints.windowStart) {
    const mois = new Date(constraints.windowStart).getUTCMonth() + 1;
    return Number.isNaN(mois) ? undefined : mois;
  }
  return undefined;
}

/** « juillet », pour une phrase ; vide si le mois n'est pas fixé. */
export function monthNameFr(month: number | undefined): string {
  if (month === undefined || month < 1 || month > 12) return '';
  return MONTHS_FR[month - 1]!;
}
