/**
 * L'adresse des pages « Où partir en <mois> ? », en français et en anglais.
 *
 * À part du générateur des pages publiques, parce que l'accueil de
 * l'application y renvoie aussi : l'importer depuis `pagesPubliques.ts`
 * ferait entrer dans l'application le catalogue d'activités et les normales
 * climatiques, que seul le build utilise.
 */

import type { Langue } from '../i18n/langues';

/** Les langues des pages publiques : le français, et l'anglais sous `/en/`. */
export type LangueDesPages = 'fr' | 'en';

/** Les pages publiques à montrer à qui lit l'application dans `langue`. */
export function langueDesPages(langue: Langue): LangueDesPages {
  return langue === 'en' ? 'en' : 'fr';
}

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

export const SLUGS_DES_MOIS_EN = [
  'january',
  'february',
  'march',
  'april',
  'may',
  'june',
  'july',
  'august',
  'september',
  'october',
  'november',
  'december',
] as const;

/** `mois` de 1 (janvier) à 12. */
export function cheminDuMois(mois: number, langue: LangueDesPages = 'fr'): string {
  return langue === 'en'
    ? `/en/where-to-go-in/${SLUGS_DES_MOIS_EN[mois - 1]}`
    : `/ou-partir-en/${SLUGS_DES_MOIS[mois - 1]}`;
}

/** Le sommaire des destinations. */
export function cheminDuSommaire(langue: LangueDesPages = 'fr'): string {
  return langue === 'en' ? '/en/destinations' : '/destinations';
}
