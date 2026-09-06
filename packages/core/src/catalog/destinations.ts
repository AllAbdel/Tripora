import { normalizeWeights, type PreferenceAxis } from '../preferences.js';
import type { Destination } from '../types.js';

/**
 * Catalogue local de destinations.
 *
 * Pourquoi un catalogue figé plutôt qu'une recherche en ligne : lancer une
 * suggestion ne doit consommer aucun quota. On part de ces villes, on les filtre
 * par distance, saison et budget, et on n'interroge les APIs de prix que pour la
 * poignée de candidates retenues.
 *
 * Les valeurs sont des **jugements assumés**, pas des mesures :
 *
 * - `tags` — à quel point la ville sert chaque envie, de 0 à 1. Une note de 0,9
 *   en gastronomie ne veut pas dire « la meilleure du monde » mais « c'est une
 *   vraie raison d'y aller ».
 * - `costIndex` — cherté de la vie sur place, 1 = moyenne européenne.
 *   0,5 ≈ Balkans, 1,9 ≈ Suisse. Multiplie les coûts journaliers de référence.
 * - `poiRichness` — de quoi tenir combien de jours sans tourner en rond.
 * - `bestMonths` — mois où le climat et l'affluence sont les plus agréables.
 *   Sert de repli quand les normales climatiques ne sont pas disponibles.
 *
 * Ces notes se corrigent : c'est un fichier, pas un modèle. Toute correction
 * profite immédiatement à tous les voyages.
 */
type Tags = Partial<Record<PreferenceAxis, number>>;

function make(
  id: string,
  name: string,
  country: string,
  countryCode: string,
  lat: number,
  lng: number,
  iata: string[],
  tags: Tags,
  costIndex: number,
  poiRichness: number,
  bestMonths: number[],
  timezone: string,
): Destination {
  return {
    id,
    name,
    country,
    countryCode,
    lat,
    lng,
    iata,
    tags: normalizeWeights(tags),
    costIndex,
    poiRichness,
    bestMonths,
    timezone,
  };
}

export const DESTINATIONS: readonly Destination[] = [
  // ---------------------------------------------------------------- Péninsule ibérique
  make('lisbonne', 'Lisbonne', 'Portugal', 'PT', 38.7223, -9.1393, ['LIS'],
    { culture: 0.8, nature: 0.5, food: 0.9, nightlife: 0.8, relax: 0.6, adventure: 0.4, shopping: 0.5, offbeat: 0.6 },
    0.8, 0.85, [4, 5, 6, 9, 10], 'Europe/Lisbon'),
  make('porto', 'Porto', 'Portugal', 'PT', 41.1579, -8.6291, ['OPO'],
    { culture: 0.8, nature: 0.45, food: 0.95, nightlife: 0.7, relax: 0.6, adventure: 0.35, shopping: 0.4, offbeat: 0.6 },
    0.7, 0.75, [4, 5, 6, 9, 10], 'Europe/Lisbon'),
  make('algarve', 'Faro et l’Algarve', 'Portugal', 'PT', 37.0194, -7.9304, ['FAO'],
    { culture: 0.35, nature: 0.9, food: 0.8, nightlife: 0.7, relax: 0.95, adventure: 0.7, shopping: 0.3, offbeat: 0.4 },
    0.75, 0.65, [4, 5, 6, 9, 10], 'Europe/Lisbon'),
  make('barcelone', 'Barcelone', 'Espagne', 'ES', 41.3874, 2.1686, ['BCN'],
    { culture: 0.85, nature: 0.5, food: 0.9, nightlife: 0.95, relax: 0.7, adventure: 0.5, shopping: 0.8, offbeat: 0.5 },
    1.0, 0.95, [4, 5, 6, 9, 10], 'Europe/Madrid'),
  make('madrid', 'Madrid', 'Espagne', 'ES', 40.4168, -3.7038, ['MAD'],
    { culture: 0.9, nature: 0.3, food: 0.9, nightlife: 0.9, relax: 0.4, adventure: 0.3, shopping: 0.8, offbeat: 0.5 },
    0.9, 0.9, [4, 5, 9, 10], 'Europe/Madrid'),
  make('seville', 'Séville', 'Espagne', 'ES', 37.3891, -5.9845, ['SVQ'],
    { culture: 0.95, nature: 0.3, food: 0.85, nightlife: 0.75, relax: 0.5, adventure: 0.3, shopping: 0.5, offbeat: 0.5 },
    0.8, 0.8, [3, 4, 5, 10, 11], 'Europe/Madrid'),
  make('grenade', 'Grenade', 'Espagne', 'ES', 37.1773, -3.5986, ['GRX', 'AGP'],
    { culture: 0.95, nature: 0.8, food: 0.85, nightlife: 0.7, relax: 0.6, adventure: 0.7, shopping: 0.4, offbeat: 0.7 },
    0.7, 0.75, [3, 4, 5, 10, 11], 'Europe/Madrid'),
  make('valence', 'Valence', 'Espagne', 'ES', 39.4699, -0.3763, ['VLC'],
    { culture: 0.7, nature: 0.6, food: 0.9, nightlife: 0.8, relax: 0.8, adventure: 0.5, shopping: 0.6, offbeat: 0.5 },
    0.8, 0.8, [4, 5, 6, 9, 10], 'Europe/Madrid'),
  make('bilbao', 'Bilbao', 'Espagne', 'ES', 43.263, -2.935, ['BIO'],
    { culture: 0.85, nature: 0.7, food: 1, nightlife: 0.7, relax: 0.5, adventure: 0.5, shopping: 0.5, offbeat: 0.6 },
    0.95, 0.7, [5, 6, 7, 9], 'Europe/Madrid'),
  make('majorque', 'Palma de Majorque', 'Espagne', 'ES', 39.5696, 2.6502, ['PMI'],
    { culture: 0.5, nature: 0.85, food: 0.7, nightlife: 0.7, relax: 0.95, adventure: 0.7, shopping: 0.5, offbeat: 0.4 },
    0.95, 0.75, [5, 6, 9, 10], 'Europe/Madrid'),
  make('tenerife', 'Tenerife', 'Espagne', 'ES', 28.2916, -16.6291, ['TFS', 'TFN'],
    { culture: 0.3, nature: 0.95, food: 0.65, nightlife: 0.7, relax: 0.95, adventure: 0.9, shopping: 0.4, offbeat: 0.5 },
    0.8, 0.7, [1, 2, 3, 4, 10, 11, 12], 'Atlantic/Canary'),

  // ------------------------------------------------------------------------- Italie
  make('rome', 'Rome', 'Italie', 'IT', 41.9028, 12.4964, ['FCO', 'CIA'],
    { culture: 1, nature: 0.3, food: 0.95, nightlife: 0.7, relax: 0.4, adventure: 0.3, shopping: 0.7, offbeat: 0.5 },
    1.0, 1.0, [4, 5, 9, 10], 'Europe/Rome'),
  make('naples', 'Naples', 'Italie', 'IT', 40.8518, 14.2681, ['NAP'],
    { culture: 0.9, nature: 0.7, food: 1, nightlife: 0.7, relax: 0.5, adventure: 0.6, shopping: 0.4, offbeat: 0.8 },
    0.8, 0.9, [4, 5, 6, 9, 10], 'Europe/Rome'),
  make('florence', 'Florence', 'Italie', 'IT', 43.7696, 11.2558, ['FLR', 'PSA'],
    { culture: 1, nature: 0.5, food: 0.9, nightlife: 0.5, relax: 0.5, adventure: 0.3, shopping: 0.7, offbeat: 0.4 },
    1.0, 0.85, [4, 5, 9, 10], 'Europe/Rome'),
  make('venise', 'Venise', 'Italie', 'IT', 45.4408, 12.3155, ['VCE', 'TSF'],
    { culture: 0.95, nature: 0.4, food: 0.8, nightlife: 0.4, relax: 0.6, adventure: 0.2, shopping: 0.6, offbeat: 0.6 },
    1.15, 0.8, [4, 5, 9, 10], 'Europe/Rome'),
  make('milan', 'Milan', 'Italie', 'IT', 45.4642, 9.19, ['MXP', 'LIN', 'BGY'],
    { culture: 0.75, nature: 0.3, food: 0.85, nightlife: 0.8, relax: 0.3, adventure: 0.2, shopping: 0.95, offbeat: 0.4 },
    1.1, 0.8, [4, 5, 6, 9, 10], 'Europe/Rome'),
  make('palerme', 'Palerme', 'Italie', 'IT', 38.1157, 13.3615, ['PMO'],
    { culture: 0.85, nature: 0.7, food: 0.95, nightlife: 0.6, relax: 0.6, adventure: 0.6, shopping: 0.4, offbeat: 0.8 },
    0.7, 0.8, [4, 5, 6, 9, 10], 'Europe/Rome'),

  // ------------------------------------------------------------ Europe centrale
  make('budapest', 'Budapest', 'Hongrie', 'HU', 47.4979, 19.0402, ['BUD'],
    { culture: 0.85, nature: 0.3, food: 0.8, nightlife: 0.95, relax: 0.8, adventure: 0.3, shopping: 0.5, offbeat: 0.8 },
    0.6, 0.9, [4, 5, 6, 9, 10], 'Europe/Budapest'),
  make('prague', 'Prague', 'Tchéquie', 'CZ', 50.0755, 14.4378, ['PRG'],
    { culture: 0.95, nature: 0.3, food: 0.75, nightlife: 0.9, relax: 0.5, adventure: 0.3, shopping: 0.6, offbeat: 0.6 },
    0.7, 0.9, [4, 5, 6, 9, 10], 'Europe/Prague'),
  make('cracovie', 'Cracovie', 'Pologne', 'PL', 50.0647, 19.945, ['KRK'],
    { culture: 0.95, nature: 0.4, food: 0.8, nightlife: 0.85, relax: 0.5, adventure: 0.4, shopping: 0.5, offbeat: 0.7 },
    0.55, 0.85, [5, 6, 7, 8, 9], 'Europe/Warsaw'),
  make('varsovie', 'Varsovie', 'Pologne', 'PL', 52.2297, 21.0122, ['WAW', 'WMI'],
    { culture: 0.8, nature: 0.3, food: 0.8, nightlife: 0.8, relax: 0.4, adventure: 0.3, shopping: 0.6, offbeat: 0.6 },
    0.55, 0.75, [5, 6, 7, 8, 9], 'Europe/Warsaw'),
  make('vienne', 'Vienne', 'Autriche', 'AT', 48.2082, 16.3738, ['VIE'],
    { culture: 1, nature: 0.4, food: 0.85, nightlife: 0.7, relax: 0.6, adventure: 0.3, shopping: 0.7, offbeat: 0.5 },
    1.05, 0.9, [4, 5, 6, 9, 10], 'Europe/Vienna'),
  make('ljubljana', 'Ljubljana', 'Slovénie', 'SI', 46.0569, 14.5058, ['LJU'],
    { culture: 0.7, nature: 0.9, food: 0.8, nightlife: 0.6, relax: 0.7, adventure: 0.85, shopping: 0.4, offbeat: 0.7 },
    0.8, 0.7, [5, 6, 9, 10], 'Europe/Ljubljana'),

  // ------------------------------------------------------------------- Balkans
  make('belgrade', 'Belgrade', 'Serbie', 'RS', 44.7866, 20.4489, ['BEG'],
    { culture: 0.6, nature: 0.3, food: 0.8, nightlife: 1, relax: 0.4, adventure: 0.3, shopping: 0.4, offbeat: 0.85 },
    0.5, 0.7, [5, 6, 9, 10], 'Europe/Belgrade'),
  make('sofia', 'Sofia', 'Bulgarie', 'BG', 42.6977, 23.3219, ['SOF'],
    { culture: 0.7, nature: 0.85, food: 0.75, nightlife: 0.7, relax: 0.5, adventure: 0.8, shopping: 0.4, offbeat: 0.8 },
    0.45, 0.7, [5, 6, 9, 10], 'Europe/Sofia'),
  make('bucarest', 'Bucarest', 'Roumanie', 'RO', 44.4268, 26.1025, ['OTP'],
    { culture: 0.7, nature: 0.4, food: 0.8, nightlife: 0.9, relax: 0.4, adventure: 0.4, shopping: 0.5, offbeat: 0.8 },
    0.5, 0.7, [5, 6, 9, 10], 'Europe/Bucharest'),
  make('tirana', 'Tirana', 'Albanie', 'AL', 41.3275, 19.8187, ['TIA'],
    { culture: 0.5, nature: 0.9, food: 0.8, nightlife: 0.7, relax: 0.7, adventure: 0.8, shopping: 0.3, offbeat: 0.95 },
    0.45, 0.6, [5, 6, 9, 10], 'Europe/Tirane'),
  make('split', 'Split', 'Croatie', 'HR', 43.5081, 16.4402, ['SPU'],
    { culture: 0.7, nature: 0.9, food: 0.8, nightlife: 0.7, relax: 0.9, adventure: 0.8, shopping: 0.3, offbeat: 0.5 },
    0.8, 0.8, [5, 6, 9, 10], 'Europe/Zagreb'),
  make('dubrovnik', 'Dubrovnik', 'Croatie', 'HR', 42.6507, 18.0944, ['DBV'],
    { culture: 0.85, nature: 0.85, food: 0.75, nightlife: 0.6, relax: 0.85, adventure: 0.7, shopping: 0.3, offbeat: 0.4 },
    1.0, 0.7, [5, 6, 9, 10], 'Europe/Zagreb'),
  make('athenes', 'Athènes', 'Grèce', 'GR', 37.9838, 23.7275, ['ATH'],
    { culture: 1, nature: 0.5, food: 0.85, nightlife: 0.8, relax: 0.5, adventure: 0.4, shopping: 0.5, offbeat: 0.6 },
    0.75, 0.85, [4, 5, 9, 10], 'Europe/Athens'),
  make('istanbul', 'Istanbul', 'Turquie', 'TR', 41.0082, 28.9784, ['IST', 'SAW'],
    { culture: 1, nature: 0.3, food: 0.95, nightlife: 0.8, relax: 0.5, adventure: 0.5, shopping: 0.9, offbeat: 0.85 },
    0.55, 0.95, [4, 5, 9, 10], 'Europe/Istanbul'),

  // ----------------------------------------------------------- Europe du Nord
  make('berlin', 'Berlin', 'Allemagne', 'DE', 52.52, 13.405, ['BER'],
    { culture: 0.9, nature: 0.4, food: 0.8, nightlife: 1, relax: 0.5, adventure: 0.3, shopping: 0.7, offbeat: 0.95 },
    0.95, 0.95, [5, 6, 7, 8, 9], 'Europe/Berlin'),
  make('munich', 'Munich', 'Allemagne', 'DE', 48.1351, 11.582, ['MUC'],
    { culture: 0.8, nature: 0.7, food: 0.85, nightlife: 0.75, relax: 0.5, adventure: 0.6, shopping: 0.7, offbeat: 0.4 },
    1.1, 0.8, [5, 6, 7, 9], 'Europe/Berlin'),
  make('hambourg', 'Hambourg', 'Allemagne', 'DE', 53.5511, 9.9937, ['HAM'],
    { culture: 0.75, nature: 0.5, food: 0.8, nightlife: 0.9, relax: 0.5, adventure: 0.4, shopping: 0.7, offbeat: 0.7 },
    1.05, 0.75, [5, 6, 7, 8], 'Europe/Berlin'),
  make('amsterdam', 'Amsterdam', 'Pays-Bas', 'NL', 52.3676, 4.9041, ['AMS'],
    { culture: 0.85, nature: 0.4, food: 0.75, nightlife: 0.9, relax: 0.5, adventure: 0.3, shopping: 0.7, offbeat: 0.8 },
    1.3, 0.9, [4, 5, 6, 9], 'Europe/Amsterdam'),
  make('bruxelles', 'Bruxelles', 'Belgique', 'BE', 50.8503, 4.3517, ['BRU', 'CRL'],
    { culture: 0.8, nature: 0.3, food: 0.9, nightlife: 0.7, relax: 0.4, adventure: 0.2, shopping: 0.6, offbeat: 0.7 },
    1.1, 0.75, [5, 6, 7, 9], 'Europe/Brussels'),
  make('copenhague', 'Copenhague', 'Danemark', 'DK', 55.6761, 12.5683, ['CPH'],
    { culture: 0.8, nature: 0.5, food: 0.95, nightlife: 0.8, relax: 0.6, adventure: 0.4, shopping: 0.7, offbeat: 0.7 },
    1.45, 0.8, [5, 6, 7, 8], 'Europe/Copenhagen'),
  make('stockholm', 'Stockholm', 'Suède', 'SE', 59.3293, 18.0686, ['ARN', 'NYO'],
    { culture: 0.8, nature: 0.8, food: 0.85, nightlife: 0.75, relax: 0.6, adventure: 0.6, shopping: 0.7, offbeat: 0.6 },
    1.35, 0.8, [6, 7, 8], 'Europe/Stockholm'),
  make('oslo', 'Oslo', 'Norvège', 'NO', 59.9139, 10.7522, ['OSL', 'TRF'],
    { culture: 0.65, nature: 1, food: 0.7, nightlife: 0.6, relax: 0.6, adventure: 0.95, shopping: 0.5, offbeat: 0.5 },
    1.6, 0.7, [6, 7, 8], 'Europe/Oslo'),
  make('reykjavik', 'Reykjavik', 'Islande', 'IS', 64.1466, -21.9426, ['KEF'],
    { culture: 0.5, nature: 1, food: 0.7, nightlife: 0.7, relax: 0.8, adventure: 1, shopping: 0.3, offbeat: 0.9 },
    1.7, 0.7, [6, 7, 8, 9], 'Atlantic/Reykjavik'),
  make('riga', 'Riga', 'Lettonie', 'LV', 56.9496, 24.1052, ['RIX'],
    { culture: 0.8, nature: 0.6, food: 0.75, nightlife: 0.85, relax: 0.5, adventure: 0.4, shopping: 0.5, offbeat: 0.75 },
    0.6, 0.7, [5, 6, 7, 8], 'Europe/Riga'),
  make('tallinn', 'Tallinn', 'Estonie', 'EE', 59.437, 24.7536, ['TLL'],
    { culture: 0.85, nature: 0.6, food: 0.8, nightlife: 0.7, relax: 0.6, adventure: 0.4, shopping: 0.5, offbeat: 0.75 },
    0.7, 0.7, [5, 6, 7, 8], 'Europe/Tallinn'),
  make('vilnius', 'Vilnius', 'Lituanie', 'LT', 54.6872, 25.2797, ['VNO'],
    { culture: 0.8, nature: 0.6, food: 0.75, nightlife: 0.7, relax: 0.5, adventure: 0.4, shopping: 0.4, offbeat: 0.8 },
    0.55, 0.65, [5, 6, 7, 8], 'Europe/Vilnius'),

  // ------------------------------------------------------------- Îles Britanniques
  make('londres', 'Londres', 'Royaume-Uni', 'GB', 51.5074, -0.1278, ['LHR', 'LGW', 'STN', 'LTN'],
    { culture: 1, nature: 0.3, food: 0.9, nightlife: 0.95, relax: 0.3, adventure: 0.3, shopping: 1, offbeat: 0.8 },
    1.35, 1.0, [5, 6, 7, 8, 9], 'Europe/London'),
  make('edimbourg', 'Édimbourg', 'Royaume-Uni', 'GB', 55.9533, -3.1883, ['EDI'],
    { culture: 0.95, nature: 0.85, food: 0.75, nightlife: 0.8, relax: 0.5, adventure: 0.8, shopping: 0.5, offbeat: 0.7 },
    1.2, 0.8, [5, 6, 7, 8, 9], 'Europe/London'),
  make('dublin', 'Dublin', 'Irlande', 'IE', 53.3498, -6.2603, ['DUB'],
    { culture: 0.75, nature: 0.8, food: 0.7, nightlife: 0.95, relax: 0.5, adventure: 0.7, shopping: 0.5, offbeat: 0.6 },
    1.2, 0.75, [5, 6, 7, 8, 9], 'Europe/Dublin'),

  // -------------------------------------------------------------------- France
  make('paris', 'Paris', 'France', 'FR', 48.8566, 2.3522, ['CDG', 'ORY', 'BVA'],
    { culture: 1, nature: 0.3, food: 0.95, nightlife: 0.8, relax: 0.4, adventure: 0.2, shopping: 0.95, offbeat: 0.6 },
    1.25, 1.0, [4, 5, 6, 9, 10], 'Europe/Paris'),
  make('marseille', 'Marseille', 'France', 'FR', 43.2965, 5.3698, ['MRS'],
    { culture: 0.7, nature: 0.85, food: 0.85, nightlife: 0.75, relax: 0.8, adventure: 0.8, shopping: 0.5, offbeat: 0.7 },
    0.95, 0.8, [5, 6, 9, 10], 'Europe/Paris'),
  make('nice', 'Nice', 'France', 'FR', 43.7102, 7.262, ['NCE'],
    { culture: 0.65, nature: 0.85, food: 0.85, nightlife: 0.7, relax: 0.95, adventure: 0.7, shopping: 0.6, offbeat: 0.4 },
    1.15, 0.75, [5, 6, 9, 10], 'Europe/Paris'),
  make('bordeaux', 'Bordeaux', 'France', 'FR', 44.8378, -0.5792, ['BOD'],
    { culture: 0.8, nature: 0.6, food: 0.95, nightlife: 0.7, relax: 0.7, adventure: 0.4, shopping: 0.6, offbeat: 0.5 },
    1.0, 0.75, [5, 6, 9, 10], 'Europe/Paris'),
  make('lyon', 'Lyon', 'France', 'FR', 45.764, 4.8357, ['LYS'],
    { culture: 0.8, nature: 0.6, food: 1, nightlife: 0.7, relax: 0.5, adventure: 0.5, shopping: 0.6, offbeat: 0.5 },
    1.0, 0.75, [5, 6, 9, 10], 'Europe/Paris'),
  make('chamonix', 'Chamonix et le Mont-Blanc', 'France', 'FR', 45.9237, 6.8694, ['GVA', 'GNB'],
    { culture: 0.3, nature: 1, food: 0.6, nightlife: 0.4, relax: 0.7, adventure: 1, shopping: 0.3, offbeat: 0.5 },
    1.3, 0.6, [1, 2, 3, 7, 8], 'Europe/Paris'),

  // ----------------------------------------------------- Méditerranée et au-delà
  make('malte', 'La Valette et Malte', 'Malte', 'MT', 35.8989, 14.5146, ['MLA'],
    { culture: 0.85, nature: 0.8, food: 0.75, nightlife: 0.7, relax: 0.9, adventure: 0.7, shopping: 0.4, offbeat: 0.6 },
    0.85, 0.7, [4, 5, 6, 9, 10], 'Europe/Malta'),
  make('marrakech', 'Marrakech', 'Maroc', 'MA', 31.6295, -7.9811, ['RAK'],
    { culture: 0.9, nature: 0.6, food: 0.85, nightlife: 0.6, relax: 0.8, adventure: 0.8, shopping: 0.95, offbeat: 0.9 },
    0.5, 0.85, [3, 4, 5, 10, 11], 'Africa/Casablanca'),
  make('zurich', 'Zurich', 'Suisse', 'CH', 47.3769, 8.5417, ['ZRH'],
    { culture: 0.7, nature: 0.9, food: 0.7, nightlife: 0.6, relax: 0.7, adventure: 0.85, shopping: 0.8, offbeat: 0.3 },
    1.9, 0.7, [5, 6, 7, 8, 9], 'Europe/Zurich'),
] as const;

/** Accès direct par identifiant, construit une seule fois. */
export const DESTINATIONS_BY_ID: ReadonlyMap<string, Destination> = new Map(
  DESTINATIONS.map((destination) => [destination.id, destination]),
);

export function findDestination(id: string): Destination | undefined {
  return DESTINATIONS_BY_ID.get(id);
}
