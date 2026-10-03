import { paysDuPoint } from './catalog/origins.js';
import { haversineKm } from './geo.js';
import { DETOUR_ROUTIER } from './transport.js';
import type { GeoPoint, TransportMode } from './types.js';
import { formatNombre } from './regional.js';

/**
 * L'empreinte carbone d'un trajet, par personne, aller-retour.
 *
 * Même règle que pour les prix : un chiffre qu'on affiche doit dire d'où il
 * vient. Les facteurs sont ceux de l'ADEME, tels que publiés par Impact CO₂
 * (impactco2.fr, `src/data/categories/deplacement.ts`, relevés le 30/09/2026),
 * en kilogrammes d'équivalent CO₂ par kilomètre parcouru. Ils comptent la
 * fabrication du véhicule et de l'infrastructure, le carburant ou
 * l'électricité, et pour l'avion les traînées de condensation — qui pèsent
 * presque autant que le kérosène.
 *
 * Une exception, et elle compte : le TGV français est très sobre parce que
 * l'électricité française est peu carbonée. Ce chiffre ne vaut pas pour un
 * train allemand ou polonais. Hors de France, on retient la moyenne du rail
 * européen publiée par l'Agence européenne pour l'environnement (33 g par
 * passager-kilomètre) — moins flatteuse, plus honnête.
 */

/** Avion : le facteur décroît avec la distance, le décollage pesant moins sur un long vol. */
const AVION: readonly { jusquAKm: number; kgParKm: number }[] = [
  // Court-courrier : fabrication 0,000372 + combustion 0,1232 + traînées 0,101.
  { jusquAKm: 1000, kgParKm: 0.224572 },
  // Moyen-courrier : 0,000361 + 0,1013 + 0,083.
  { jusquAKm: 2000, kgParKm: 0.184661 },
  // Moyen-long courrier : 0,000294 + 0,0915 + 0,075.
  { jusquAKm: 5000, kgParKm: 0.166794 },
  // Long-courrier : 0,000294 + 0,0976 + 0,08.
  { jusquAKm: Number.POSITIVE_INFINITY, kgParKm: 0.177894 },
];

export const FACTEURS_CO2 = {
  /** TGV en France : fabrication 0,00063 + usage 0,0023. */
  trainFrance: 0.00293,
  /** Rail européen moyen (Agence européenne pour l'environnement). */
  trainEurope: 0.033,
  /** Autocar : fabrication 0,00442 + usage 0,03314. */
  autocar: 0.03756,
  /** Voiture thermique, **par véhicule** : usage 0,11056 + fabrication 0,03170. */
  voiture: 0.142253,
} as const;

/** L'objectif d'émissions par personne et par an à l'horizon 2050, selon l'ADEME. */
export const OBJECTIF_ANNUEL_KG = 2000;

export interface EmpreinteDuTrajet {
  mode: TransportMode;
  /** Kilogrammes d'équivalent CO₂, par personne, aller et retour. */
  kg: number;
  /** D'où vient le facteur, en une phrase courte. */
  source: string;
}

export interface OptionsDEmpreinte {
  /** Personnes qui partagent une voiture : l'empreinte du véhicule se divise. */
  participants?: number;
  /** Départ et arrivée en France : le facteur du TGV s'applique. */
  enFrance?: boolean;
}

/**
 * L'empreinte d'un mode de transport entre deux points.
 *
 * Les distances suivent celles des estimations de prix : à vol d'oiseau pour
 * l'avion, allongées du détour routier moyen pour le train, le car et la
 * voiture. Le ferry n'a pas de facteur publié ici : `null`, plutôt qu'un
 * chiffre inventé.
 */
export function empreinteDuTrajet(
  mode: TransportMode,
  depart: GeoPoint,
  arrivee: GeoPoint,
  { participants = 1, enFrance = false }: OptionsDEmpreinte = {},
): EmpreinteDuTrajet | null {
  const direct = haversineKm(depart, arrivee);
  const route = direct * DETOUR_ROUTIER;
  const allerRetour = (km: number, kgParKm: number) => arrondi(km * 2 * kgParKm);

  switch (mode) {
    case 'plane': {
      const facteur = AVION.find((tranche) => direct <= tranche.jusquAKm)!;
      return { mode, kg: allerRetour(direct, facteur.kgParKm), source: 'ADEME, traînées comprises' };
    }
    case 'train':
      return enFrance
        ? { mode, kg: allerRetour(route, FACTEURS_CO2.trainFrance), source: 'ADEME, TGV en France' }
        : {
            mode,
            kg: allerRetour(route, FACTEURS_CO2.trainEurope),
            source: 'Moyenne du rail européen (AEE)',
          };
    case 'bus':
      return { mode, kg: allerRetour(route, FACTEURS_CO2.autocar), source: 'ADEME, autocar' };
    case 'car': {
      // Au-delà de cinq, il faut une seconde voiture : le partage s'arrête là.
      const occupants = Math.min(5, Math.max(1, Math.round(participants)));
      return {
        mode,
        kg: allerRetour(route, FACTEURS_CO2.voiture / occupants),
        source:
          occupants > 1
            ? `ADEME, voiture thermique partagée à ${occupants}`
            : 'ADEME, voiture thermique, seul',
      };
    }
    case 'ferry':
      return null;
  }
}

/**
 * Départ et arrivée en France : le seul cas où le facteur du TGV s'applique.
 *
 * Le pays du départ est rarement écrit en toutes lettres (une ville venue de
 * la position de l'appareil n'en a pas) : on le déduit alors de la ville de
 * départ connue la plus proche.
 */
export function trajetEnFrance(
  depart: GeoPoint & { country?: string | undefined },
  arrivee: { countryCode?: string | undefined },
): boolean {
  return (depart.country ?? paysDuPoint(depart)) === 'France' && arrivee.countryCode === 'FR';
}

/** Un kilogramme près sous 100 kg, dix kilogrammes près au-delà : la précision réelle des facteurs. */
function arrondi(kg: number): number {
  if (kg < 1) return Math.round(kg * 10) / 10;
  if (kg < 100) return Math.round(kg);
  return Math.round(kg / 10) * 10;
}

/** « 2,9 kg », « 38 kg », « 1,2 t » : lisible sans calculer. */
export function kgLisibles(kg: number): string {
  if (kg >= 1000) {
    return `${formatNombre(kg / 1000, { maximumFractionDigits: 1 })} t`;
  }
  return `${formatNombre(kg, { maximumFractionDigits: 1 })} kg`;
}

/** La part de l'objectif annuel de 2 tonnes, en pourcentage entier. */
export function partDeLObjectif(kg: number): number {
  return Math.round((kg / OBJECTIF_ANNUEL_KG) * 100);
}

/**
 * La phrase qui compare, quand il y a matière à comparer.
 *
 * « En train plutôt qu'en avion : 250 kg de CO₂e de moins par personne. »
 * Rien quand l'écart est négligeable, ou quand l'avion n'est pas une option :
 * une comparaison qui ne change aucune décision n'a pas sa place à l'écran.
 */
export function phraseDeComparaison(empreintes: readonly EmpreinteDuTrajet[]): string | null {
  const avion = empreintes.find((empreinte) => empreinte.mode === 'plane');
  if (!avion) return null;
  const sol = empreintes
    .filter((empreinte) => empreinte.mode === 'train' || empreinte.mode === 'bus')
    .sort((a, b) => a.kg - b.kg)[0];
  if (!sol) return null;
  const ecart = avion.kg - sol.kg;
  if (ecart < 20) return null;
  const moyen = sol.mode === 'train' ? 'en train' : 'en car';
  const rapport = sol.kg > 0 ? Math.round(avion.kg / sol.kg) : null;
  const fois = rapport !== null && rapport >= 3 ? ` (${rapport} fois moins)` : '';
  return `${moyen.charAt(0).toUpperCase()}${moyen.slice(1)} plutôt qu’en avion : ${kgLisibles(arrondi(ecart))} de CO₂e de moins par personne${fois}.`;
}
