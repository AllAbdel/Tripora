/**
 * L'adresse des pages « Où partir en <mois> ? ».
 *
 * À part du générateur des pages publiques, parce que l'accueil de
 * l'application y renvoie aussi : l'importer depuis `pagesPubliques.ts`
 * ferait entrer dans l'application le catalogue d'activités et les normales
 * climatiques, que seul le build utilise.
 */

export const SLUGS_DES_MOIS = [
  'janvier',
  'fevrier',
  'mars',
  'avril',
  'mai',
  'juin',
  'juillet',
  'aout',
  'septembre',
  'octobre',
  'novembre',
  'decembre',
] as const;

/** `mois` de 1 (janvier) à 12. */
export function cheminDuMois(mois: number): string {
  return `/ou-partir-en/${SLUGS_DES_MOIS[mois - 1]}`;
}
