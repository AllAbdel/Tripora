/**
 * Le continent de chaque pays, par son code ISO 3166-1 alpha-2.
 *
 * Une convention de voyageur, pas de géographe : la Turquie, Chypre et la
 * Russie comptent pour l'Europe, le Caucase et le Moyen-Orient pour l'Asie,
 * l'Amérique centrale et les Caraïbes pour l'Amérique du Nord. Les
 * territoires d'outre-mer suivent leur géographie, pas leur capitale : la
 * Réunion est en Afrique, la Polynésie en Océanie.
 */

export type Continent =
  | 'europe'
  | 'afrique'
  | 'asie'
  | 'amerique-du-nord'
  | 'amerique-du-sud'
  | 'oceanie'
  | 'antarctique';

export const NOMS_DES_CONTINENTS: Readonly<Record<Continent, string>> = {
  europe: 'Europe',
  afrique: 'Afrique',
  asie: 'Asie',
  'amerique-du-nord': 'Amérique du Nord',
  'amerique-du-sud': 'Amérique du Sud',
  oceanie: 'Océanie',
  antarctique: 'Antarctique',
};

const PAYS: Readonly<Record<Continent, string>> = {
  europe:
    'AD AL AT AX BA BE BG BY CH CY CZ DE DK EE ES FI FO FR GB GG GI GR HR HU IE IM IS IT JE LI LT LU LV MC MD ME MK MT NL NO PL PT RO RS RU SE SI SJ SK SM TR UA VA XK',
  asie:
    'AE AF AM AZ BD BH BN BT CN GE HK ID IL IN IO IQ IR JO JP KG KH KP KR KW KZ LA LB LK MM MN MO MV MY NP OM PH PK PS QA SA SG SY TH TJ TL TM TW UZ VN YE',
  afrique:
    'AO BF BI BJ BW CD CF CG CI CM CV DJ DZ EG EH ER ET GA GH GM GN GQ GW KE KM LR LS LY MA MG ML MR MU MW MZ NA NE NG RE RW SC SD SH SL SN SO SS ST SZ TD TG TN TZ UG YT ZA ZM ZW',
  'amerique-du-nord':
    'AG AI AW BB BL BM BQ BS BZ CA CR CU CW DM DO GD GL GP GT HN HT JM KN KY LC MF MQ MS MX NI PA PM PR SV SX TC TT US VC VG VI',
  'amerique-du-sud': 'AR BO BR CL CO EC FK GF GY PE PY SR UY VE',
  oceanie: 'AS AU CK FJ FM GU KI MH MP NC NF NR NU NZ PF PG PN PW SB TK TO TV UM VU WF WS',
  antarctique: 'AQ BV GS HM TF',
};

const PAR_PAYS: ReadonlyMap<string, Continent> = new Map(
  (Object.entries(PAYS) as [Continent, string][]).flatMap(([continent, codes]) =>
    codes.split(' ').map((code) => [code, continent] as const),
  ),
);

/** Le continent d'un pays, ou `undefined` pour un code inconnu. */
export function continentDe(codePays: string | null | undefined): Continent | undefined {
  return codePays ? PAR_PAYS.get(codePays.toUpperCase()) : undefined;
}
