import { DESTINATIONS } from './destinations.js';
import { fold } from '../text.js';
import { haversineKm } from '../geo.js';
import type { GeoPoint, Place } from '../types.js';

/**
 * Les aéroports, quand la ville en a plusieurs.
 *
 * « Paris » suffit à un moteur de prix : le code de ville PAR couvre les
 * trois plateformes, et c'est bien ce qu'on veut interroger pour trouver le
 * moins cher. Mais ça ne suffit pas à quelqu'un qui part : entre Roissy et
 * Orly il y a une heure de RER, et pour un habitant du sud de Paris ce n'est
 * pas le même voyage. Il faut aussi pouvoir dire « je pars d'Orly ».
 *
 * Deux raisons de les nommer, donc :
 *
 *  - **choisir son aéroport**, et pas seulement sa ville ;
 *  - **apparier les trips ouverts.** Deux personnes qui publient « Paris →
 *    Bali » doivent se trouver ; deux personnes dont l'une part d'Orly et
 *    l'autre de Beauvais doivent le savoir avant de réserver.
 *
 * Les coordonnées sont celles de l'aéroport, pas celles de la ville : c'est
 * de là qu'on part, et c'est cette distance-là qui compte dans un trajet.
 */
const AEROPORTS: Place[] = [
  { name: 'Paris-Charles-de-Gaulle', country: 'France', lat: 49.0097, lng: 2.5479, iata: ['CDG', 'PAR'] },
  { name: 'Paris-Orly', country: 'France', lat: 48.7233, lng: 2.3794, iata: ['ORY', 'PAR'] },
  { name: 'Paris-Beauvais', country: 'France', lat: 49.4544, lng: 2.1128, iata: ['BVA'] },
  { name: 'Londres-Heathrow', country: 'Royaume-Uni', lat: 51.4700, lng: -0.4543, iata: ['LHR', 'LON'] },
  { name: 'Londres-Gatwick', country: 'Royaume-Uni', lat: 51.1537, lng: -0.1821, iata: ['LGW', 'LON'] },
  { name: 'Londres-Stansted', country: 'Royaume-Uni', lat: 51.8860, lng: 0.2389, iata: ['STN'] },
  { name: 'Milan-Malpensa', country: 'Italie', lat: 45.6301, lng: 8.7255, iata: ['MXP', 'MIL'] },
  { name: 'Milan-Bergame', country: 'Italie', lat: 45.6739, lng: 9.7042, iata: ['BGY'] },
  { name: 'Rome-Fiumicino', country: 'Italie', lat: 41.8003, lng: 12.2389, iata: ['FCO', 'ROM'] },
  { name: 'Rome-Ciampino', country: 'Italie', lat: 41.7994, lng: 12.5949, iata: ['CIA'] },
  { name: 'Bruxelles-Charleroi', country: 'Belgique', lat: 50.4592, lng: 4.4538, iata: ['CRL'] },
  { name: 'Genève-Aéroport', country: 'Suisse', lat: 46.2381, lng: 6.1090, iata: ['GVA'] },
  { name: 'Bâle-Mulhouse', country: 'France', lat: 47.5896, lng: 7.5299, iata: ['BSL', 'MLH'] },
  { name: 'Barcelone-El Prat', country: 'Espagne', lat: 41.2971, lng: 2.0785, iata: ['BCN'] },
  { name: 'Madrid-Barajas', country: 'Espagne', lat: 40.4719, lng: -3.5626, iata: ['MAD'] },
  { name: 'Lisbonne-Humberto-Delgado', country: 'Portugal', lat: 38.7742, lng: -9.1342, iata: ['LIS'] },
  { name: 'Amsterdam-Schiphol', country: 'Pays-Bas', lat: 52.3105, lng: 4.7683, iata: ['AMS'] },
  { name: 'Francfort-Main', country: 'Allemagne', lat: 50.0379, lng: 8.5622, iata: ['FRA'] },
  { name: 'Berlin-Brandebourg', country: 'Allemagne', lat: 52.3667, lng: 13.5033, iata: ['BER'] },
  { name: 'Munich-Franz-Josef-Strauss', country: 'Allemagne', lat: 48.3538, lng: 11.7861, iata: ['MUC'] },
];

/**
 * Points de départ proposés.
 *
 * Le calcul de distance a besoin de coordonnées : on ne peut donc pas accepter
 * n'importe quel texte libre tant que le géocodage n'est pas branché (phase 3).
 * En attendant, cette liste couvre les grandes villes françaises et les
 * capitales voisines, ce qui suffit très largement à un groupe d'amis, et elle
 * est complétée automatiquement par toutes les villes du catalogue.
 */
const FRANCE: Place[] = [
  { name: 'Paris', country: 'France', lat: 48.8566, lng: 2.3522, iata: ['PAR', 'CDG', 'ORY', 'BVA'] },
  { name: 'Marseille', country: 'France', lat: 43.2965, lng: 5.3698, iata: ['MRS'] },
  { name: 'Lyon', country: 'France', lat: 45.764, lng: 4.8357, iata: ['LYS'] },
  { name: 'Toulouse', country: 'France', lat: 43.6047, lng: 1.4442, iata: ['TLS'] },
  { name: 'Nice', country: 'France', lat: 43.7102, lng: 7.262, iata: ['NCE'] },
  { name: 'Nantes', country: 'France', lat: 47.2184, lng: -1.5536, iata: ['NTE'] },
  { name: 'Montpellier', country: 'France', lat: 43.6108, lng: 3.8767, iata: ['MPL'] },
  { name: 'Strasbourg', country: 'France', lat: 48.5734, lng: 7.7521, iata: ['SXB'] },
  { name: 'Bordeaux', country: 'France', lat: 44.8378, lng: -0.5792, iata: ['BOD'] },
  { name: 'Lille', country: 'France', lat: 50.6292, lng: 3.0573, iata: ['LIL', 'BRU'] },
  { name: 'Rennes', country: 'France', lat: 48.1173, lng: -1.6778, iata: ['RNS'] },
  { name: 'Toulon', country: 'France', lat: 43.1242, lng: 5.928, iata: ['TLN', 'MRS'] },
  { name: 'Grenoble', country: 'France', lat: 45.1885, lng: 5.7245, iata: ['GNB', 'LYS'] },
  { name: 'Dijon', country: 'France', lat: 47.322, lng: 5.0415, iata: ['LYS'] },
  { name: 'Angers', country: 'France', lat: 47.4784, lng: -0.5632, iata: ['NTE'] },
  { name: 'Nîmes', country: 'France', lat: 43.8367, lng: 4.3601, iata: ['FNI', 'MPL'] },
  { name: 'Clermont-Ferrand', country: 'France', lat: 45.7772, lng: 3.087, iata: ['CFE'] },
  { name: 'Tours', country: 'France', lat: 47.3941, lng: 0.6848, iata: ['TUF'] },
  { name: 'Limoges', country: 'France', lat: 45.8336, lng: 1.2611, iata: ['LIG'] },
  { name: 'Amiens', country: 'France', lat: 49.8941, lng: 2.2958, iata: ['CDG'] },
  { name: 'Reims', country: 'France', lat: 49.2583, lng: 4.0317, iata: ['CDG'] },
  { name: 'Rouen', country: 'France', lat: 49.4432, lng: 1.0993, iata: ['CDG'] },
  { name: 'Le Havre', country: 'France', lat: 49.4944, lng: 0.1079, iata: ['CDG'] },
  { name: 'Caen', country: 'France', lat: 49.1829, lng: -0.3707, iata: ['CFR', 'CDG'] },
  { name: 'Perpignan', country: 'France', lat: 42.6887, lng: 2.8948, iata: ['PGF'] },
  { name: 'Metz', country: 'France', lat: 49.1193, lng: 6.1757, iata: ['ETZ'] },
  { name: 'Nancy', country: 'France', lat: 48.6921, lng: 6.1844, iata: ['ETZ'] },
  { name: 'Mulhouse', country: 'France', lat: 47.7508, lng: 7.3359, iata: ['BSL'] },
  { name: 'Besançon', country: 'France', lat: 47.2378, lng: 6.0241, iata: ['BSL'] },
  { name: 'Orléans', country: 'France', lat: 47.9029, lng: 1.9093, iata: ['ORY'] },
  { name: 'Saint-Étienne', country: 'France', lat: 45.4397, lng: 4.3872, iata: ['LYS'] },
  { name: 'Avignon', country: 'France', lat: 43.9493, lng: 4.8055, iata: ['AVN', 'MRS'] },
  { name: 'Poitiers', country: 'France', lat: 46.5802, lng: 0.3404, iata: ['PIS'] },
  { name: 'La Rochelle', country: 'France', lat: 46.1603, lng: -1.1511, iata: ['LRH'] },
  { name: 'Biarritz', country: 'France', lat: 43.4832, lng: -1.5586, iata: ['BIQ'] },
  { name: 'Brest', country: 'France', lat: 48.3904, lng: -4.4861, iata: ['BES'] },
  { name: 'Ajaccio', country: 'France', lat: 41.9192, lng: 8.7386, iata: ['AJA'] },
];

const VOISINS: Place[] = [
  { name: 'Genève', country: 'Suisse', lat: 46.2044, lng: 6.1432, iata: ['GVA'] },
  { name: 'Luxembourg', country: 'Luxembourg', lat: 49.6116, lng: 6.1319, iata: ['LUX'] },
];

/** Villes et aéroports de départ, sans doublon, triés par ordre alphabétique français. */
export const ORIGINS: readonly Place[] = [
  ...FRANCE,
  ...VOISINS,
  ...AEROPORTS,
  // Une ville peut être à la fois un départ et une destination : Toulouse se
  // visite autant qu'on en part. La fiche écrite à la main fait foi — elle
  // porte les codes d'aéroport utiles au départ, pas seulement à l'arrivée.
  ...DESTINATIONS.filter(
    (destination) =>
      !FRANCE.some((city) => city.name === destination.name) &&
      !VOISINS.some((city) => city.name === destination.name) &&
      !AEROPORTS.some((airport) => airport.name === destination.name),
  ).map<Place>((destination) => ({
    name: destination.name,
    country: destination.country,
    lat: destination.lat,
    lng: destination.lng,
    iata: destination.iata,
  })),
].sort((a, b) => a.name.localeCompare(b.name, 'fr'));

/** Recherche tolérante aux accents et à la casse. */
export function searchOrigins(query: string, limit = 8): Place[] {
  const needle = fold(query);
  if (needle.length === 0) return ORIGINS.slice(0, limit);
  const matches = ORIGINS.filter((place) => fold(place.name).includes(needle));
  // Les villes dont le nom commence par la saisie remontent en premier.
  return matches
    .sort((a, b) => {
      const aStarts = fold(a.name).startsWith(needle) ? 0 : 1;
      const bStarts = fold(b.name).startsWith(needle) ? 0 : 1;
      return aStarts - bStarts || a.name.localeCompare(b.name, 'fr');
    })
    .slice(0, limit);
}


/** Ce qui dessert un point de départ trouvé ailleurs que dans cette liste. */
export interface AeroportsProches {
  iata: string[];
  /** La ville qui porte ces aéroports, pour pouvoir le dire. */
  ville: string;
  km: number;
}

/**
 * Les aéroports qui desservent un point quelconque.
 *
 * Une ville trouvée par géocodage n'a pas de code IATA, et sans code aucun
 * prix de vol ne peut être relevé : tout le classement retomberait sur des
 * estimations sans que personne comprenne pourquoi. On rattache donc le point
 * aux aéroports de la ville connue la plus proche.
 *
 * Ce n'est pas une approximation cachée : la ville de rattachement est
 * renvoyée pour être affichée. « Partir de Colmar, vols au départ de Bâle » se
 * vérifie ; « vols au départ de Colmar » serait faux.
 *
 * Au-delà du rayon, rien : mieux vaut pas de prix qu'un prix relevé à quatre
 * cents kilomètres de là où l'on est.
 */
export function nearestAirports(point: GeoPoint, maxKm = 150): AeroportsProches | undefined {
  let meilleure: AeroportsProches | undefined;

  for (const ville of ORIGINS) {
    if (!ville.iata || ville.iata.length === 0) continue;
    // On rattache à une ville, jamais à un aéroport : dire « vols au départ
    // de Paris-Orly » à quelqu'un qui habite Colmar n'aurait aucun sens, alors
    // que « vols au départ de Bâle » se comprend.
    if (AEROPORTS.some((aeroport) => aeroport.name === ville.name)) continue;
    const km = haversineKm(point, ville);
    if (km > maxKm) continue;
    if (!meilleure || km < meilleure.km) {
      meilleure = { iata: [...ville.iata], ville: ville.name, km: Math.round(km) };
    }
  }
  return meilleure;
}
