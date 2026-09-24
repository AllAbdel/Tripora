import { DESTINATIONS } from './destinations.js';

/**
 * Infos pratiques par pays : les prises, la tension, les numéros d'urgence, le
 * côté de la route.
 *
 * Ce qu'on cherche la veille du départ, ou pire, sur place : « il faut un
 * adaptateur ? », « c'est quoi le numéro des secours ici ? », « on roule à
 * gauche ? ». Tout est là, sans réseau.
 *
 * Sources : les types de prise de la Commission électrotechnique
 * internationale (« World Plugs »), croisés avec Wikidata (P2853) ; les numéros
 * d'urgence et le côté de conduite, croisés avec Wikidata (P2852, P1622).
 * Wikidata se trompe parfois — des prises australiennes en Ouzbékistan — et
 * c'est la liste de la CEI qui tranche.
 *
 * Un numéro d'urgence absent n'est pas un oubli : pour quelques pays, les
 * sources ne concordent pas, et un faux numéro de secours serait pire que pas
 * de numéro du tout. L'écran renvoie alors aux conseils officiels.
 */

export type Cote = 'droite' | 'gauche';

export interface NumeroDUrgence {
  /** `null` : le numéro général, qui répond à tout. */
  service: 'police' | 'ambulance' | 'pompiers' | 'police touristique' | null;
  numero: string;
}

export interface InfosPratiques {
  /** Les types de prise, en lettres : « C », « F ». */
  prises: readonly string[];
  /** « 230 », « 120 », « 127 ou 220 ». */
  tension: string;
  urgences: readonly NumeroDUrgence[];
  conduite: Cote;
}

/**
 * [prises, tension, urgences, conduite]
 *
 * Urgences : les numéros séparés par des espaces ; un numéro seul est le
 * numéro général, sinon une lettre dit le service — P police, A ambulance,
 * F pompiers, T police touristique. `null` : sources discordantes.
 */
type Ligne = readonly [prises: string, tension: string, urgences: string | null, conduite: 'd' | 'g'];

const LIGNES: Readonly<Record<string, Ligne>> = {
  // ------------------------------------------------------------- Europe --
  AD: ['CF', '230', '112', 'd'],
  AL: ['CF', '230', '112 P129 A127 F128', 'd'],
  AT: ['CF', '230', '112', 'd'],
  BA: ['CF', '230', '112 P122 A124 F123', 'd'],
  BE: ['CE', '230', '112', 'd'],
  BG: ['CF', '230', '112', 'd'],
  BY: ['CF', '230', 'P102 A103 F101', 'd'],
  CH: ['CJ', '230', '112 P117 A144 F118', 'd'],
  CY: ['G', '230', '112', 'g'],
  CZ: ['CE', '230', '112', 'd'],
  DE: ['CF', '230', '112 P110', 'd'],
  DK: ['CEFK', '230', '112', 'd'],
  EE: ['CF', '230', '112', 'd'],
  ES: ['CF', '230', '112', 'd'],
  FI: ['CF', '230', '112', 'd'],
  FO: ['CEFK', '230', '112', 'd'],
  FR: ['CE', '230', '112 A15 P17 F18', 'd'],
  GB: ['G', '230', '999 112', 'g'],
  GG: ['G', '230', '999 112', 'g'],
  GI: ['G', '230', '112 999', 'd'],
  GR: ['CF', '230', '112 P100 A166 F199', 'd'],
  HR: ['CF', '230', '112', 'd'],
  HU: ['CF', '230', '112', 'd'],
  IE: ['G', '230', '112 999', 'g'],
  IM: ['G', '230', '999 112', 'g'],
  IS: ['CF', '230', '112', 'd'],
  IT: ['CFL', '230', '112', 'd'],
  JE: ['G', '230', '999 112', 'g'],
  LI: ['CJ', '230', '112', 'd'],
  LT: ['CF', '230', '112', 'd'],
  LU: ['CF', '230', '112', 'd'],
  LV: ['CF', '230', '112', 'd'],
  MC: ['CDEF', '230', '112', 'd'],
  MD: ['CF', '230', '112', 'd'],
  ME: ['CF', '230', '112 P122 A124 F123', 'd'],
  MK: ['CF', '230', '112 P192 A194 F193', 'd'],
  MT: ['G', '230', '112', 'g'],
  NL: ['CF', '230', '112', 'd'],
  NO: ['CF', '230', 'P112 A113 F110', 'd'],
  PL: ['CE', '230', '112', 'd'],
  PT: ['CF', '230', '112', 'd'],
  RO: ['CF', '230', '112', 'd'],
  RS: ['CF', '230', 'P192 A194 F193', 'd'],
  RU: ['CF', '230', '112', 'd'],
  SE: ['CF', '230', '112', 'd'],
  SI: ['CF', '230', '112 P113', 'd'],
  SJ: ['CF', '230', '112', 'd'],
  SK: ['CE', '230', '112', 'd'],
  SM: ['CFL', '230', '112 P113 A118 F115', 'd'],
  TR: ['CF', '230', '112', 'd'],
  UA: ['CF', '230', '112', 'd'],
  VA: ['CFL', '230', '112', 'd'],
  XK: ['CF', '230', '112', 'd'],

  // ------------------------------------------- Moyen-Orient et Caucase --
  AE: ['CDG', '230', 'P999 A998 F997', 'd'],
  AM: ['CF', '230', '112', 'd'],
  AZ: ['CF', '220', '112', 'd'],
  BH: ['G', '230', '999', 'd'],
  GE: ['CF', '220', '112', 'd'],
  IL: ['CH', '230', 'P100 A101 F102', 'd'],
  JO: ['BCDFGJ', '230', '911', 'd'],
  KW: ['CG', '240', '112', 'd'],
  LB: ['ABCDG', '230', 'P112 A140 F175', 'd'],
  OM: ['CG', '240', '9999', 'd'],
  QA: ['DG', '240', '999', 'd'],
  SA: ['ABG', '230', '911', 'd'],

  // --------------------------------------------------------------- Asie --
  BD: ['ACDGK', '220', '999', 'g'],
  BN: ['G', '240', 'P993 A991 F995', 'g'],
  BT: ['CDGM', '230', 'P113 A112 F110', 'g'],
  CN: ['ACI', '220', 'P110 A120 F119', 'd'],
  HK: ['G', '220', '999', 'g'],
  ID: ['CF', '230', '112 P110 A118', 'g'],
  IN: ['CDM', '230', '112', 'g'],
  JP: ['AB', '100', 'P110 A119 F119', 'g'],
  KG: ['CF', '220', '112', 'd'],
  KH: ['ACG', '230', 'P117 A119 F118', 'd'],
  KR: ['CF', '220', 'P112 A119 F119', 'd'],
  KZ: ['CF', '220', '112', 'd'],
  LA: ['ABCEF', '230', 'P191 A195 F190', 'd'],
  LK: ['DGM', '230', 'P119 A1990 F110', 'g'],
  MM: ['CDFG', '230', 'P199 A192 F191', 'd'],
  MN: ['CE', '230', 'P102 A103 F101', 'd'],
  MO: ['DGM', '220', '999', 'g'],
  MV: ['CDGJKL', '230', 'P119 A102 F118', 'g'],
  MY: ['G', '240', '999', 'g'],
  NP: ['CDM', '230', 'P100 A102 F101', 'g'],
  PH: ['ABC', '220', '911', 'd'],
  SG: ['G', '230', 'P999 A995 F995', 'g'],
  TH: ['ABCO', '230', 'P191 T1155 A1669 F199', 'g'],
  TJ: ['CF', '220', 'P102 A103 F101', 'd'],
  TL: ['CEFI', '220', '112', 'g'],
  TM: ['BCF', '220', 'P102 A103 F101', 'd'],
  TW: ['AB', '110', 'P110 A119 F119', 'd'],
  UZ: ['CF', '220', 'P102 A103 F101', 'd'],
  VN: ['ACD', '220', 'P113 A115 F114', 'd'],

  // ------------------------------------------------------------ Afrique --
  BJ: ['CE', '220', 'P117 F118', 'd'],
  BW: ['DGM', '230', 'P999 A997 F998', 'g'],
  CI: ['CE', '230', 'P111 A185 F180', 'd'],
  CM: ['CE', '220', null, 'd'],
  CV: ['CF', '230', 'P132 A130 F131', 'd'],
  DJ: ['CE', '220', 'P17 F18', 'd'],
  DZ: ['CF', '230', 'P17 A14 F14', 'd'],
  EG: ['CF', '220', 'P122 A123 F180', 'd'],
  ET: ['CEFL', '220', 'P991 A907 F939', 'd'],
  GA: ['C', '220', null, 'd'],
  GH: ['DG', '230', 'P191 A193 F192', 'd'],
  GM: ['G', '230', 'P117 A116 F118', 'd'],
  KE: ['G', '240', '999 112', 'g'],
  KM: ['CE', '220', null, 'd'],
  LS: ['M', '220', null, 'g'],
  MA: ['CE', '220', 'P19 A15 F15', 'd'],
  MG: ['CDEJK', '220', 'P117 A124 F118', 'd'],
  MU: ['CG', '230', 'P999 A114 F995', 'g'],
  MW: ['G', '230', null, 'g'],
  MZ: ['CFM', '220', 'P119 A117 F198', 'g'],
  NA: ['DM', '220', 'P10111', 'g'],
  RE: ['CE', '230', '112 A15 P17 F18', 'd'],
  RW: ['CJ', '230', '112', 'd'],
  SC: ['G', '240', '999', 'g'],
  SN: ['CDEK', '230', 'P17 F18', 'd'],
  ST: ['CF', '220', '112', 'd'],
  SZ: ['M', '230', '999', 'g'],
  TG: ['C', '220', 'P117 F118', 'd'],
  TN: ['CE', '230', 'P197 A190 F198', 'd'],
  TZ: ['DG', '230', '112', 'g'],
  UG: ['G', '240', '999 112', 'g'],
  YT: ['CE', '230', '112 A15 P17 F18', 'd'],
  ZA: ['CDMN', '230', '112 P10111 A10177', 'g'],
  ZM: ['CDG', '230', '999', 'g'],
  ZW: ['DG', '220', '999', 'g'],

  // --------------------------------------------------------- Amériques --
  AG: ['AB', '230', '911', 'g'],
  AI: ['AB', '110', '911', 'g'],
  AR: ['CI', '220', 'P911 A107 F100', 'd'],
  AW: ['ABF', '127', '911', 'd'],
  BB: ['AB', '115', 'P211 A511 F311', 'g'],
  BL: ['CE', '230', '112', 'd'],
  BM: ['AB', '120', '911', 'g'],
  BO: ['AC', '230', 'P110 A118 F119', 'd'],
  BR: ['CN', '127 ou 220', 'P190 A192 F193', 'd'],
  BS: ['AB', '120', '911', 'g'],
  BZ: ['ABG', '110 ou 220', '911', 'd'],
  CA: ['AB', '120', '911', 'd'],
  CL: ['CL', '220', 'P133 A131 F132', 'd'],
  CO: ['AB', '110', '123', 'd'],
  CR: ['AB', '120', '911', 'd'],
  CU: ['ABCL', '110 ou 220', 'P106 A104 F105', 'd'],
  CW: ['AB', '127', '911', 'd'],
  DM: ['DG', '230', '999', 'g'],
  DO: ['AB', '120', '911', 'd'],
  EC: ['AB', '120', '911', 'd'],
  GD: ['G', '230', '911', 'g'],
  GF: ['CDE', '220', '112 A15 P17 F18', 'd'],
  GL: ['CEFK', '230', '112', 'd'],
  GP: ['CDE', '230', '112 A15 P17 F18', 'd'],
  GT: ['AB', '120', 'P110 A128 F123', 'd'],
  GY: ['ABDG', '240', 'P911 A913 F912', 'g'],
  HN: ['AB', '120', '911', 'd'],
  HT: ['AB', '110', null, 'd'],
  JM: ['AB', '110', 'P119 A110 F110', 'g'],
  KN: ['ABDG', '230', '911', 'g'],
  KY: ['AB', '120', '911', 'g'],
  LC: ['G', '240', '911 999', 'g'],
  MQ: ['CDE', '230', '112 A15 P17 F18', 'd'],
  MX: ['AB', '127', '911', 'd'],
  NI: ['AB', '120', 'P118 A128 F115', 'd'],
  PA: ['AB', '120', '911', 'd'],
  PE: ['ABC', '220', 'P105 F116', 'd'],
  PM: ['CE', '230', '112', 'd'],
  PR: ['AB', '120', '911', 'd'],
  PY: ['C', '220', '911', 'd'],
  SR: ['CF', '127', '115', 'g'],
  SV: ['AB', '120', '911', 'd'],
  TC: ['AB', '120', '911', 'g'],
  TT: ['AB', '115', 'P999 A811 F990', 'g'],
  US: ['AB', '120', '911', 'd'],
  UY: ['CFIL', '220', '911', 'd'],
  VC: ['ACEGIK', '230', '911', 'g'],
  VE: ['AB', '120', '911', 'd'],
  VG: ['AB', '110', '911', 'g'],

  // ------------------------------------------------------------ Océanie --
  AU: ['I', '230', '000 112', 'g'],
  CK: ['I', '240', null, 'g'],
  FJ: ['I', '240', '911', 'g'],
  FM: ['AB', '120', '911', 'd'],
  KI: ['I', '240', null, 'g'],
  NC: ['CE', '220', '112 P17 A15 F18', 'd'],
  NU: ['I', '230', null, 'g'],
  NZ: ['I', '230', '111', 'g'],
  PF: ['ABCE', '220', '112 P17 A15 F18', 'd'],
  PG: ['I', '240', null, 'g'],
  PW: ['AB', '120', '911', 'd'],
  SB: ['GI', '230', 'P999 A911 F988', 'g'],
  TO: ['I', '240', null, 'g'],
  VU: ['CGI', '220', null, 'd'],
  WF: ['CE', '220', 'P17 A15 F18', 'd'],
  WS: ['I', '230', null, 'g'],
};

const SERVICES: Readonly<Record<string, NumeroDUrgence['service']>> = {
  P: 'police',
  A: 'ambulance',
  F: 'pompiers',
  T: 'police touristique',
};

function lireUrgences(texte: string | null): NumeroDUrgence[] {
  if (!texte) return [];
  return texte.split(' ').map((jeton) => {
    const service = SERVICES[jeton.charAt(0)];
    return service ? { service, numero: jeton.slice(1) } : { service: null, numero: jeton };
  });
}

/** Les infos pratiques d'un pays, ou `undefined` s'il n'est pas couvert. */
export function infosPratiques(codePays: string | null | undefined): InfosPratiques | undefined {
  const ligne = codePays ? LIGNES[codePays.toUpperCase()] : undefined;
  if (!ligne) return undefined;
  const [prises, tension, urgences, conduite] = ligne;
  return {
    prises: [...prises],
    tension,
    urgences: lireUrgences(urgences),
    conduite: conduite === 'g' ? 'gauche' : 'droite',
  };
}

/** Les pays couverts, pour les tests. */
export function paysCouverts(): string[] {
  return Object.keys(LIGNES);
}

/**
 * Les prises où une fiche plate européenne (type C, celle des chargeurs)
 * entre sans adaptateur.
 */
const ACCEPTENT_LA_FICHE_PLATE = new Set(['C', 'E', 'F', 'H', 'J', 'K', 'L', 'N']);

export type BesoinDAdaptateur = 'aucun' | 'fiches-plates' | 'necessaire';

/**
 * Faut-il un adaptateur pour aller de tel pays à tel autre ?
 *
 * — `aucun` : les mêmes prises des deux côtés ;
 * — `fiches-plates` : les chargeurs à fiche plate (type C) passent, pas les
 *   fiches rondes épaisses à terre — c'est le cas d'un Français en Suisse ou
 *   en Italie ;
 * — `necessaire` : rien ne rentre, comme d'Europe au Royaume-Uni ou aux
 *   États-Unis.
 *
 * `undefined` quand un des deux pays n'est pas couvert : on ne devine pas.
 */
export function besoinDAdaptateur(
  depart: string | null | undefined,
  destination: string | null | undefined,
): BesoinDAdaptateur | undefined {
  const ici = infosPratiques(depart);
  const labas = infosPratiques(destination);
  if (!ici || !labas) return undefined;
  // Une prise de là-bas qui accepte une fiche d'ici autre que la fiche plate :
  // tout passe, y compris les appareils à terre. E et F ne font qu'une
  // famille : la fiche ronde à terre vendue en France comme en Allemagne
  // (CEE 7/7) entre dans les deux.
  const famille = (prise: string) => (prise === 'E' || prise === 'F' ? 'EF' : prise);
  const laBas = new Set(labas.prises.map(famille));
  const communes = ici.prises.filter((prise) => prise !== 'C' && laBas.has(famille(prise)));
  if (communes.length > 0) return 'aucun';
  // Là où la seule fiche d'ici est la plate, qu'elle passe suffit.
  const platePasse = ici.prises.includes('C') && labas.prises.some((prise) => ACCEPTENT_LA_FICHE_PLATE.has(prise));
  if (platePasse) return ici.prises.every((prise) => prise === 'C') ? 'aucun' : 'fiches-plates';
  return 'necessaire';
}

/** 100 à 127 V : les appareils européens qui chauffent n'y fonctionnent pas. */
export function tensionBasse(tension: string): boolean {
  return /^1[0-2]\d\b/u.test(tension) && !/220|230|240/u.test(tension);
}

/**
 * Le code d'un pays d'après son nom, tel qu'il est écrit dans le catalogue
 * (« France », « Royaume-Uni ») : c'est ainsi que la ville de départ connaît
 * son pays.
 */
export function codeDuPays(nom: string | null | undefined): string | undefined {
  const cherche = nom?.trim().toLowerCase();
  if (!cherche) return undefined;
  return DESTINATIONS.find((destination) => destination.country.trim().toLowerCase() === cherche)?.countryCode;
}
