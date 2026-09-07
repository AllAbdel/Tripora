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
  AED: 'dirham des Émirats',
  ALL: 'lek albanais',
  AMD: 'dram arménien',
  ARS: 'peso argentin',
  AZN: 'manat azerbaïdjanais',
  BAM: 'mark convertible',
  BTN: 'ngultrum bhoutanais',
  CVE: 'escudo cap-verdien',
  CLP: 'peso chilien',
  COP: 'peso colombien',
  CRC: 'colón costaricien',
  CUP: 'peso cubain',
  DOP: 'peso dominicain',
  DZD: 'dinar algérien',
  EGP: 'livre égyptienne',
  ETB: 'birr éthiopien',
  GEL: 'lari géorgien',
  GTQ: 'quetzal guatémaltèque',
  ANG: 'florin antillais',
  BBD: 'dollar barbadien',
  BWP: 'pula botswanais',
  BHD: 'dinar bahreïni',
  BOB: 'boliviano',
  BSD: 'dollar bahaméen',
  BZD: 'dollar bélizien',
  DJF: 'franc djiboutien',
  FJD: 'dollar fidjien',
  GHS: 'cedi ghanéen',
  HNL: 'lempira hondurien',
  KMF: 'franc comorien',
  KWD: 'dinar koweïtien',
  MOP: 'pataca de Macao',
  MWK: 'kwacha malawite',
  MZN: 'metical mozambicain',
  NIO: 'córdoba nicaraguayen',
  RWF: 'franc rwandais',
  UGX: 'shilling ougandais',
  VUV: 'vatu vanuatuan',
  WST: 'tala samoan',
  XPF: 'franc CFP',
  ZMW: 'kwacha zambien',
  JMD: 'dollar jamaïcain',
  JOD: 'dinar jordanien',
  KES: 'shilling kényan',
  KHR: 'riel cambodgien',
  KGS: 'som kirghize',
  KZT: 'tenge kazakh',
  LAK: 'kip laotien',
  LKR: 'roupie srilankaise',
  MAD: 'dirham marocain',
  MDL: 'leu moldave',
  MGA: 'ariary malgache',
  MKD: 'denar macédonien',
  MNT: 'tugrik mongol',
  MUR: 'roupie mauricienne',
  MVR: 'rufiyaa maldivienne',
  NAD: 'dollar namibien',
  NPR: 'roupie népalaise',
  OMR: 'rial omanais',
  PAB: 'balboa panaméen',
  PEN: 'sol péruvien',
  QAR: 'rial qatari',
  RSD: 'dinar serbe',
  SAR: 'rial saoudien',
  SCR: 'roupie seychelloise',
  STN: 'dobra santoméen',
  TOP: 'pa’anga tongien',
  TND: 'dinar tunisien',
  TWD: 'dollar taïwanais',
  TZS: 'shilling tanzanien',
  UAH: 'hryvnia ukrainienne',
  UYU: 'peso uruguayen',
  UZS: 'sum ouzbek',
  VND: 'dong vietnamien',
  XOF: 'franc CFA',
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
  AT: 'EUR', BE: 'EUR', BG: 'EUR', CY: 'EUR', DE: 'EUR', EE: 'EUR', ES: 'EUR',
  FI: 'EUR', FR: 'EUR', GR: 'EUR', HR: 'EUR', IE: 'EUR', IT: 'EUR', LT: 'EUR',
  LU: 'EUR', LV: 'EUR', ME: 'EUR', MT: 'EUR', NL: 'EUR', PT: 'EUR', SI: 'EUR',
  AD: 'EUR', GP: 'EUR', MC: 'EUR', MQ: 'EUR', RE: 'EUR', SK: 'EUR', SM: 'EUR',
  XK: 'EUR',
  // Collectivités du Pacifique : le franc CFP, indexé sur l'euro.
  NC: 'XPF', PF: 'XPF',
  // Hors zone euro, mais publiées par la BCE.
  AU: 'AUD', BR: 'BRL', CA: 'CAD', CH: 'CHF', CK: 'NZD', CN: 'CNY', CZ: 'CZK',
  DK: 'DKK', FO: 'DKK', GB: 'GBP', GG: 'GBP', GL: 'DKK', HK: 'HKD', IM: 'GBP',
  JE: 'GBP', LI: 'CHF', SJ: 'NOK', HU: 'HUF', ID: 'IDR', IL: 'ILS', IN: 'INR', IS: 'ISK',
  JP: 'JPY', KR: 'KRW', MX: 'MXN', MY: 'MYR', NO: 'NOK', NZ: 'NZD', PH: 'PHP',
  PL: 'PLN', RO: 'RON', SE: 'SEK', SG: 'SGD', TH: 'THB', TR: 'TRY', US: 'USD',
  ZA: 'ZAR',
  // Non publiées par la BCE : on les nomme quand même, pour pouvoir dire
  // précisément ce qu'on ne sait pas convertir.
  AE: 'AED', AL: 'ALL', BB: 'BBD', BH: 'BHD', BO: 'BOB', BS: 'BSD', BT: 'BTN',
  BW: 'BWP', DJ: 'DJF', HN: 'HNL', KM: 'KMF', MW: 'MWK', MZ: 'MZN', NI: 'NIO',
  PW: 'USD', ST: 'STN', TO: 'TOP', UG: 'UGX', VU: 'VUV', WS: 'WST', ZM: 'ZMW',
  BZ: 'BZD', CV: 'CVE', CW: 'ANG', FJ: 'FJD', GH: 'GHS', JM: 'JMD', KW: 'KWD',
  MG: 'MGA', MO: 'MOP', PR: 'USD', RW: 'RWF', SC: 'SCR', ZW: 'USD', AM: 'AMD', AR: 'ARS', AZ: 'AZN', BA: 'BAM', CL: 'CLP',
  CO: 'COP', CR: 'CRC', CU: 'CUP', DO: 'DOP', DZ: 'DZD', EC: 'USD', EG: 'EGP',
  ET: 'ETB', GE: 'GEL', GT: 'GTQ', JO: 'JOD', KE: 'KES', KH: 'KHR', KZ: 'KZT',
  LA: 'LAK', LK: 'LKR', MD: 'MDL', MK: 'MKD', MU: 'MUR', MV: 'MVR', NA: 'NAD',
  KG: 'KGS', MN: 'MNT', NP: 'NPR', OM: 'OMR', PA: 'PAB', PE: 'PEN', QA: 'QAR', RS: 'RSD', SA: 'SAR',
  SN: 'XOF', TN: 'TND', TW: 'TWD', TZ: 'TZS', UA: 'UAH', UY: 'UYU', UZ: 'UZS',
  VN: 'VND',
  MA: 'MAD',
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
