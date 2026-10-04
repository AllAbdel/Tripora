import { formatterLeMontant } from './money.js';
import type { Cents } from './money.js';

/**
 * Les réglages régionaux : comment écrire un nombre, une date, une somme,
 * une température et une distance pour la personne qui lit.
 *
 * Tout ce qui s'affiche avec un chiffre passe par ici, plutôt que par un
 * `toLocaleString('fr-FR')` ou un « °C » écrit en dur : c'est ce qui permet
 * qu'un écran soit lisible à New York (« $1,450 », « 75 °F », « 6,200 mi »)
 * sans que le texte français autour change — la traduction au rendu
 * s'occupe des mots, ces fonctions des chiffres.
 *
 * Les réglages sont posés une fois par l'application (`reglerLaRegion`), au
 * démarrage puis à chaque changement dans le profil. Par défaut : le français
 * de France, l'euro, les degrés Celsius et les kilomètres — ce que les tests
 * et les fonctions serveur voient.
 *
 * Les données, elles, ne changent pas d'unité : les prix restent en centimes
 * d'euro, les températures en °C, les distances en km. On ne convertit qu'à
 * l'affichage.
 */

export type UniteDeTemperature = 'C' | 'F' | 'K';
export type UniteDeDistance = 'km' | 'mi';

export interface Region {
  /** Étiquette `Intl` des nombres et des dates : « fr-FR », « en-US ». */
  locale: string;
  /** La devise dans laquelle afficher les sommes en euros. */
  devise: string;
  temperature: UniteDeTemperature;
  distance: UniteDeDistance;
  /**
   * Combien d'unités de `devise` vaut un euro (taux BCE du jour). Sans taux,
   * les sommes restent en euros : mieux vaut l'euro qu'une conversion inventée.
   */
  tauxDeLaDevise: number | null;
}

export const REGION_PAR_DEFAUT: Readonly<Region> = {
  locale: 'fr-FR',
  devise: 'EUR',
  temperature: 'C',
  distance: 'km',
  tauxDeLaDevise: null,
};

let region: Region = { ...REGION_PAR_DEFAUT };

/** Pose les réglages (une partie suffit) ; le reste garde sa valeur. */
export function reglerLaRegion(partiel: Partial<Region>): void {
  region = { ...region, ...partiel };
}

/** Les réglages en cours. */
export function regionActive(): Readonly<Region> {
  return region;
}

/** L'étiquette `Intl` à donner à `toLocaleDateString`, `Intl.DateTimeFormat`… */
export function localeActive(): string {
  return region.locale;
}

const NOMBRES = new Map<string, Intl.NumberFormat>();

/** Un nombre, écrit dans la langue de la personne : « 1 234,5 », « 1,234.5 ». */
export function formatNombre(nombre: number, options: Intl.NumberFormatOptions = {}): string {
  const cle = `${region.locale}|${JSON.stringify(options)}`;
  let format = NOMBRES.get(cle);
  if (!format) {
    format = new Intl.NumberFormat(region.locale, options);
    NOMBRES.set(cle, format);
  }
  return format.format(nombre);
}

/** Une date, écrite dans la langue de la personne. */
export function formatDate(date: Date | string | number, options: Intl.DateTimeFormatOptions = {}): string {
  return new Date(date).toLocaleDateString(region.locale, options);
}

// ---------------------------------------------------------------------------
// Les sommes
// ---------------------------------------------------------------------------

export interface OptionsDeMontant {
  /** Arrondi à l'unité, pour les estimations. */
  hideCentimes?: boolean;
  /**
   * Garder la devise d'origine, même si la personne en préfère une autre :
   * une dépense réelle, un remboursement, ce qu'on tape dans un champ en
   * euros. Seules les estimations se convertissent.
   */
  sansConversion?: boolean;
  /** Forcer une langue (un texte destiné à un service, pas à l'écran). */
  locale?: string;
}

/**
 * Une somme, dans la devise et l'écriture de la personne.
 *
 * Une somme en euros s'affiche convertie quand la personne a choisi une autre
 * devise et que le taux du jour est connu, précédée de « ≈ » : c'est une
 * conversion au taux BCE, pas un prix relevé dans cette devise.
 */
export function formatMontant(cents: Cents, devise = 'EUR', options: OptionsDeMontant = {}): string {
  const locale = options.locale ?? region.locale;
  const convertir =
    devise === 'EUR' &&
    region.devise !== 'EUR' &&
    region.tauxDeLaDevise !== null &&
    !options.sansConversion &&
    options.locale === undefined;
  if (!convertir) return formatterLeMontant(cents, devise, locale, options.hideCentimes);
  const converti = Math.round(cents * region.tauxDeLaDevise!);
  return `≈ ${formatterLeMontant(converti, region.devise, locale, options.hideCentimes)}`;
}

/** Le nom historique de `formatMontant`, employé partout dans l'application. */
export const formatCents = formatMontant;

// ---------------------------------------------------------------------------
// Les sommes que la personne tape
// ---------------------------------------------------------------------------

/**
 * La devise dans laquelle la personne tape un budget : la sienne quand le taux
 * du jour est connu, l'euro sinon.
 *
 * Les budgets restent stockés en euros — c'est en euros que le groupe se
 * compare et que les prix sont relevés. Un Américain tape « 2000 » dans un
 * champ en dollars ; Tripora garde l'équivalent en euros au taux du jour.
 */
export function deviseDeSaisie(): string {
  return region.devise !== 'EUR' && region.tauxDeLaDevise !== null ? region.devise : 'EUR';
}

/** Une somme tapée dans la devise de saisie, en centimes d'euro, pour la stocker. */
export function saisieVersEuros(cents: Cents): Cents {
  return deviseDeSaisie() === 'EUR' ? cents : Math.round(cents / region.tauxDeLaDevise!);
}

/** Une somme stockée en centimes d'euro, dans la devise de saisie, pour préremplir un champ. */
export function eurosVersSaisie(cents: Cents): Cents {
  return deviseDeSaisie() === 'EUR' ? cents : Math.round(cents * region.tauxDeLaDevise!);
}

/**
 * Un raccourci de budget (« 400 € ») dans la devise de saisie, arrondi à un
 * montant qu'on taperait soi-même : 400 € deviennent 470 $, pas 468,24 $, et
 * 64 000 ¥ plutôt que 63 861 ¥. `cents` est ce qu'il faut stocker (en euros),
 * `libelle` ce qu'il faut afficher.
 */
export function raccourciDeBudget(centsEnEuros: Cents): { cents: Cents; libelle: string } {
  const devise = deviseDeSaisie();
  if (devise === 'EUR') {
    return { cents: centsEnEuros, libelle: formatMontant(centsEnEuros, 'EUR', { hideCentimes: true, sansConversion: true }) };
  }
  const unites = eurosVersSaisie(centsEnEuros) / 100;
  // Deux chiffres significatifs : 468 → 470, 63 861 → 64 000.
  const pas = 10 ** Math.max(0, Math.floor(Math.log10(Math.max(unites, 1))) - 1);
  const rond = Math.max(pas, Math.round(unites / pas) * pas);
  return {
    cents: saisieVersEuros(rond * 100),
    libelle: formatMontant(rond * 100, devise, { hideCentimes: true, sansConversion: true }),
  };
}

// ---------------------------------------------------------------------------
// Températures et distances
// ---------------------------------------------------------------------------

const SYMBOLES_DE_TEMPERATURE: Record<UniteDeTemperature, string> = { C: ' °C', F: ' °F', K: ' K' };

/** Une température donnée en °C, dans l'unité de la personne, arrondie au degré. */
export function convertirTemperature(celsius: number, unite = region.temperature): number {
  if (unite === 'F') return Math.round((celsius * 9) / 5 + 32);
  if (unite === 'K') return Math.round(celsius + 273.15);
  return Math.round(celsius);
}

/** « 24 °C », « 75 °F », « 297 K ». */
export function formatTemperature(celsius: number): string {
  return `${formatNombre(convertirTemperature(celsius))}${SYMBOLES_DE_TEMPERATURE[region.temperature]}`;
}

/** Un écart de température (une amplitude) : 10 °C d'écart font 18 °F, et 10 K. */
export function formatEcartDeTemperature(ecartCelsius: number): string {
  const ecart = region.temperature === 'F' ? (ecartCelsius * 9) / 5 : ecartCelsius;
  return `${formatNombre(Math.round(ecart))}${SYMBOLES_DE_TEMPERATURE[region.temperature]}`;
}

const KM_PAR_MILLE = 1.609344;

/** Une distance donnée en km, dans l'unité de la personne. */
export function convertirDistance(km: number, unite = region.distance): number {
  return unite === 'mi' ? km / KM_PAR_MILLE : km;
}

/** L'abréviation de l'unité de distance : « km » ou « mi ». */
export function uniteDeDistance(): UniteDeDistance {
  return region.distance;
}

/**
 * « 1 234 km », « 767 mi ». Arrondi au kilomètre (ou au mile) par défaut ;
 * `decimales` pour une courte distance à pied.
 */
export function formatDistance(km: number, decimales = 0): string {
  const valeur = convertirDistance(km);
  return `${formatNombre(valeur, { maximumFractionDigits: decimales, minimumFractionDigits: decimales })} ${region.distance}`;
}

/** Une taille de fichier en mégaoctets, au moins 1 : « 9 Mo », « 9 MB ». */
export function formatTaille(octets: number): string {
  return formatNombre(Math.max(1, Math.round(octets / (1024 * 1024))), { style: 'unit', unit: 'megabyte' });
}

// ---------------------------------------------------------------------------
// Les réglages par défaut d'une région
// ---------------------------------------------------------------------------

/** Les pays qui comptent en degrés Fahrenheit. */
const FAHRENHEIT = new Set(['US', 'BS', 'BZ', 'KY', 'PW', 'LR', 'FM', 'MH', 'PR', 'GU', 'VI', 'AS']);
/** Les pays qui comptent les distances routières en miles. */
const MILES = new Set(['US', 'GB', 'LR', 'MM', 'PR', 'GU', 'VI', 'AS']);

/** Les unités d'usage dans un pays (code ISO), pour le réglage « automatique ». */
export function unitesDuPays(pays: string | null | undefined): { temperature: UniteDeTemperature; distance: UniteDeDistance } {
  const code = pays?.toUpperCase() ?? '';
  return { temperature: FAHRENHEIT.has(code) ? 'F' : 'C', distance: MILES.has(code) ? 'mi' : 'km' };
}
