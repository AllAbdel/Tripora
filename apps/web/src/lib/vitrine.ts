import { findDestination, type Destination } from '@tripora/core';

/**
 * Les destinations que l'accueil met en avant, selon le mois.
 *
 * Une liste choisie à la main plutôt qu'un classement : ce sont des villes que
 * tout le monde situe, réparties sur plusieurs continents et plusieurs
 * budgets, et qui ont toutes une page publique fournie (un test le vérifie).
 * Le mois fait le tri — on ne propose pas Bangkok en pleine mousson —, et la
 * règle « un pays à la fois » évite six villes d'Italie en mai.
 */
export const VITRINE: readonly string[] = [
  'lisbonne',
  'marrakech',
  'tokyo',
  'rome',
  'bali',
  'new-york',
  'barcelone',
  'istanbul',
  'bangkok',
  'athenes',
  'le-cap',
  'budapest',
  'mexico',
  'reykjavik',
  'madere',
  'kyoto',
  'la-havane',
  'prague',
  'cancun',
  'seville',
  'dubai',
  'edimbourg',
  'hanoi',
  'naples',
  'amsterdam',
  'phuket',
  'agadir',
  'tenerife',
  'porto',
  'cusco',
  // L'été : la plupart des villes du sud y sont trop chaudes.
  'copenhague',
  'montreal',
  'zanzibar',
  'cracovie',
  'berlin',
  'bergen',
];

/** `mois` de 1 à 12. */
export function destinationsDuMois(mois: number, combien = 6): Destination[] {
  const choisies: Destination[] = [];
  const pays = new Set<string>();
  for (const id of VITRINE) {
    const destination = findDestination(id);
    if (!destination || !destination.bestMonths.includes(mois)) continue;
    if (pays.has(destination.countryCode)) continue;
    pays.add(destination.countryCode);
    choisies.push(destination);
    if (choisies.length === combien) break;
  }
  return choisies;
}

/** Le budget sur place, lisible d'un coup d'œil : €, €€ ou €€€. */
export function niveauDePrix(destination: Pick<Destination, 'costIndex'>): '€' | '€€' | '€€€' {
  if (destination.costIndex < 0.75) return '€';
  if (destination.costIndex < 1.2) return '€€';
  return '€€€';
}
