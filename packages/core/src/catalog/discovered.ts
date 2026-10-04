import { normalizeWeights } from '../preferences.js';
import type { Destination } from '../types.js';

/**
 * Les villes trouvées par géocodage, en mémoire pour la session.
 *
 * Le catalogue curé est figé et comparable : c'est ce qui permet de classer des
 * propositions. Il ne peut pas contenir toutes les villes du monde, et il n'a
 * pas à le faire — savoir qu'on part à Kyoto ne demande aucune note, juste des
 * coordonnées justes.
 *
 * Ces villes-là vivent donc à côté. `findDestination` les résout comme les
 * autres, pour que la carte, l'itinéraire et les lieux fonctionnent sans rien
 * savoir de leur origine. Mais elles portent `discovered`, et les fonctions qui
 * comparent — candidates, scoring, propositions — ne lisent que le catalogue :
 * une ville sans notes n'a rien à défendre dans un classement.
 *
 * Rien n'est inventé ici : `tags` reste vide, ce qui se lit « on ne sait pas ».
 * Mettre 0,5 partout se lirait « moyenne en tout », qui est une affirmation.
 */
const DECOUVERTES = new Map<string, Destination>();

/** Ce que le géocodage sait d'une ville, et rien de plus. */
export interface VilleGeocodee {
  id: string;
  name: string;
  country: string;
  countryCode: string;
  lat: number;
  lng: number;
}

export function makeDiscovered(ville: VilleGeocodee): Destination {
  return {
    id: ville.id,
    name: ville.name,
    country: ville.country,
    countryCode: ville.countryCode,
    lat: ville.lat,
    lng: ville.lng,
    // Sans code IATA on n'affichera pas de prix de vol pour cette ville, ce qui
    // vaut mieux que d'en afficher un qui ne lui correspond pas.
    iata: [],
    tags: normalizeWeights({}),
    costIndex: 1,
    poiRichness: 0.5,
    bestMonths: [],
    discovered: true,
  };
}

export function rememberDestination(destination: Destination): void {
  DECOUVERTES.set(destination.id, destination);
}

export function findDiscovered(id: string): Destination | undefined {
  return DECOUVERTES.get(id);
}

/** Réinitialise le registre. Utile aux tests, qui doivent partir de rien. */
export function forgetDiscovered(): void {
  DECOUVERTES.clear();
}
