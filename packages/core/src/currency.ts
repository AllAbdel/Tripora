import type { Cents } from './money.js';

/**
 * Les devises, et la seule question qui compte : peut-on convertir honnêtement ?
 *
 * Tripora ne convertit qu'avec les taux de référence de la Banque centrale
 * européenne, servis par Frankfurter — gratuits, sans clé, sans quota. La BCE
 * publie une trentaine de devises, et pas une de plus. Trois de nos
 * destinations en sont absentes : Marrakech (dirham), Belgrade (dinar), Tirana
 * (lek). Pour celles-là on ne convertit pas et on le dit, plutôt que d'aller
 * chercher un taux ailleurs ou d'en inventer un — une dépense mal convertie se
 * paie en euros réels entre amis.
 *
 * La liste ci-dessous a été relevée sur l'API le 6 septembre 2026. Elle bouge
 * très lentement : le lev bulgare l'a quittée le 1er janvier 2026 quand la
 * Bulgarie est passée à l'euro, la kuna croate en 2023.
 */

export interface Currency {
  code: string;
  /** Nom en français, celui qu'on affiche dans une liste. */
  name: string;
  symbol: string;
}

/** Les devises que la BCE publie, plus l'euro qui leur sert de base. */
export const CURRENCIES: readonly Currency[] = [
  { code: 'EUR', name: 'euro', symbol: '€' },
  { code: 'AUD', name: 'dollar australien', symbol: '$' },
  { code: 'BRL', name: 'réal brésilien', symbol: 'R$' },
  { code: 'CAD', name: 'dollar canadien', symbol: '$' },
  { code: 'CHF', name: 'franc suisse', symbol: 'CHF' },
  { code: 'CNY', name: 'yuan chinois', symbol: '¥' },
  { code: 'CZK', name: 'couronne tchèque', symbol: 'Kč' },
  { code: 'DKK', name: 'couronne danoise', symbol: 'kr' },
  { code: 'GBP', name: 'livre sterling', symbol: '£' },
  { code: 'HKD', name: 'dollar de Hong Kong', symbol: '$' },
  { code: 'HUF', name: 'forint hongrois', symbol: 'Ft' },
  { code: 'IDR', name: 'roupie indonésienne', symbol: 'Rp' },
  { code: 'ILS', name: 'shekel israélien', symbol: '₪' },
  { code: 'INR', name: 'roupie indienne', symbol: '₹' },
  { code: 'ISK', name: 'couronne islandaise', symbol: 'kr' },
  { code: 'JPY', name: 'yen japonais', symbol: '¥' },
  { code: 'KRW', name: 'won sud-coréen', symbol: '₩' },
  { code: 'MXN', name: 'peso mexicain', symbol: '$' },
  { code: 'MYR', name: 'ringgit malaisien', symbol: 'RM' },
  { code: 'NOK', name: 'couronne norvégienne', symbol: 'kr' },
  { code: 'NZD', name: 'dollar néo-zélandais', symbol: '$' },
  { code: 'PHP', name: 'peso philippin', symbol: '₱' },
  { code: 'PLN', name: 'zloty polonais', symbol: 'zł' },
  { code: 'RON', name: 'leu roumain', symbol: 'lei' },
  { code: 'SEK', name: 'couronne suédoise', symbol: 'kr' },
  { code: 'SGD', name: 'dollar de Singapour', symbol: '$' },
  { code: 'THB', name: 'baht thaïlandais', symbol: '฿' },
  { code: 'TRY', name: 'livre turque', symbol: '₺' },
  { code: 'USD', name: 'dollar américain', symbol: '$' },
  { code: 'ZAR', name: 'rand sud-africain', symbol: 'R' },
];

const PAR_CODE = new Map(CURRENCIES.map((devise) => [devise.code, devise]));

/** Une devise que la BCE publie, donc que Tripora sait convertir. */
export function isConvertible(code: string): boolean {
  return PAR_CODE.has(code.toUpperCase());
}

export function currencyByCode(code: string): Currency | undefined {
  return PAR_CODE.get(code.toUpperCase());
}

/**
 * Les devises de nos destinations que la BCE ne publie pas.
 *
 * Elles sont nommées ici uniquement pour qu'on puisse dire précisément ce
 * qu'on ne sait pas convertir — « la BCE ne publie pas de taux pour le dirham
 * marocain » vaut mieux que « devise non prise en charge ».
 */
const NON_PUBLIEES: Readonly<Record<string, string>> = {
  ALL: 'lek albanais',
  MAD: 'dirham marocain',
  RSD: 'dinar serbe',
};

/** Le nom français d'une devise, publiée ou non. Le code, à défaut. */
export function currencyName(code: string): string {
  const majuscule = code.toUpperCase();
  return PAR_CODE.get(majuscule)?.name ?? NON_PUBLIEES[majuscule] ?? majuscule;
}

/**
 * La devise d'un pays, par son code ISO.
 *
 * Ne couvre que les pays du catalogue : c'est une table de correspondance pour
 * proposer la bonne devise par défaut, pas un atlas monétaire. Un pays absent
 * renvoie `undefined`, et l'écran s'en tient à l'euro.
 */
const DEVISE_PAR_PAYS: Readonly<Record<string, string>> = {
  // Zone euro — la Croatie depuis 2023, la Bulgarie depuis le 1er janvier 2026.
  AT: 'EUR', BE: 'EUR', BG: 'EUR', DE: 'EUR', EE: 'EUR', ES: 'EUR', FR: 'EUR',
  GR: 'EUR', HR: 'EUR', IE: 'EUR', IT: 'EUR', LT: 'EUR', LV: 'EUR', MT: 'EUR',
  NL: 'EUR', PT: 'EUR', SI: 'EUR',
  // Hors zone euro, mais publiées par la BCE.
  CH: 'CHF', CZ: 'CZK', DK: 'DKK', GB: 'GBP', HU: 'HUF', IS: 'ISK',
  NO: 'NOK', PL: 'PLN', RO: 'RON', SE: 'SEK', TR: 'TRY',
  // Non publiées par la BCE : on les nomme quand même, pour pouvoir dire
  // précisément ce qu'on ne sait pas convertir.
  AL: 'ALL', MA: 'MAD', RS: 'RSD',
};

export function currencyForCountry(countryCode: string): string | undefined {
  return DEVISE_PAR_PAYS[countryCode.toUpperCase()];
}

/**
 * Le tableau des taux tel qu'il arrive de la BCE, avec sa date.
 *
 * `date` n'est pas « aujourd'hui » : la BCE ne publie ni le week-end ni les
 * jours fériés. Un samedi, le taux affiché est celui de vendredi, et l'écran
 * doit montrer cette date-là. Une conversion datée est vérifiable ; une
 * conversion « du jour » qui date de trois jours ne l'est pas.
 */
export interface FxRates {
  /** Devise de référence, toujours EUR chez nous. */
  base: string;
  /** Jour de publication, au format ISO. */
  date: string;
  /** Combien d'unités de la devise vaut 1 euro. `{ PLN: 4.3148 }`. */
  rates: Readonly<Record<string, number>>;
}

/**
 * Convertit un montant en devise locale vers la devise de référence.
 *
 * Le taux entre sous la forme publiée — « combien de zlotys pour un euro » —
 * parce que c'est ce que la BCE donne et qu'inverser à la main est le genre de
 * détail qui produit des factures multipliées par vingt.
 */
export function toReferenceCents(cents: Cents, unitsPerReference: number): Cents {
  if (!Number.isFinite(unitsPerReference) || unitsPerReference <= 0) {
    throw new RangeError(`Taux de change invalide : ${unitsPerReference}`);
  }
  return Math.round(cents / unitsPerReference);
}

/**
 * Le taux à figer dans la dépense : combien d'euros vaut une unité locale.
 *
 * On le stocke plutôt que de le recalculer, pour qu'une dépense passée ne
 * change jamais de montant parce que la BCE a bougé depuis.
 */
export function referenceRate(unitsPerReference: number): number {
  if (!Number.isFinite(unitsPerReference) || unitsPerReference <= 0) {
    throw new RangeError(`Taux de change invalide : ${unitsPerReference}`);
  }
  return 1 / unitsPerReference;
}

/** « 1 € = 4,31 zł », la phrase qu'on montre pour que le taux soit vérifiable. */
export function describeRate(code: string, unitsPerReference: number): string {
  const devise = currencyByCode(code);
  const arrondi = unitsPerReference >= 100
    ? Math.round(unitsPerReference).toLocaleString('fr-FR')
    : unitsPerReference.toLocaleString('fr-FR', { maximumFractionDigits: 3 });
  return `1 € = ${arrondi} ${devise?.symbol ?? code}`;
}
