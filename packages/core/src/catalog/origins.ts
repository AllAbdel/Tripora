import { DESTINATIONS } from './destinations.js';
import type { Place } from '../types.js';

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
  { name: 'Paris', country: 'France', lat: 48.8566, lng: 2.3522, iata: ['CDG', 'ORY', 'BVA'] },
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

/** Villes de départ, sans doublon, triées par ordre alphabétique français. */
export const ORIGINS: readonly Place[] = [
  ...FRANCE,
  ...VOISINS,
  ...DESTINATIONS.filter(
    (destination) => !FRANCE.some((city) => city.name === destination.name),
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

function fold(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}
