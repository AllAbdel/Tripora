import { classifyPoi, fold, type Destination, type Poi } from '@tripora/core';
import { supabase } from './supabase';

/**
 * Les lieux réels d'une destination.
 *
 * Deux sources, dans cet ordre.
 *
 * **Le catalogue d'activités d'abord**, parce qu'il est écrit à la main, qu'il
 * connaît la durée et le prix, et qu'il est là hors ligne. C'est lui qui fait
 * qu'un séjour à Bali parle du mont Batur et de Tanah Lot.
 *
 * **OpenStreetMap ensuite**, pour tout ce que le catalogue n'a pas : les six
 * cent quatre destinations ne seront jamais toutes écrites à la main, et OSM
 * connaît le musée du quartier que personne n'aurait pensé à citer. La
 * fonction serveur en ramène la matière brute ; c'est ici qu'elle devient une
 * liste utilisable, en passant par `classifyPoi` du moteur.
 *
 * L'ordre n'est pas cosmétique : c'est lui qui a manqué pendant deux
 * semaines. La fonction `places` échouait pour toutes les villes sauf
 * Lisbonne, en silence, et l'écran se contentait d'être vide. Avec le
 * catalogue en premier, une panne d'OpenStreetMap ne retire plus que le
 * complément.
 *
 * Tout échec reste silencieux, comme pour les prix : une panne de fournisseur
 * ne doit jamais vider un écran.
 */

export interface Lieux {
  liste: Poi[];
  /** Vrai quand la limite gratuite du jour est atteinte. */
  quotaExceeded: boolean;
}

const VIDE: Lieux = { liste: [], quotaExceeded: false };

interface LieuBrut {
  id?: unknown;
  name?: unknown;
  lat?: unknown;
  lng?: unknown;
  tags?: unknown;
  extract?: unknown;
  imageUrl?: unknown;
  externalUrl?: unknown;
  wikipedia?: unknown;
}

export async function chargerLieux(destination: Destination): Promise<Lieux> {
  // Chargé ici, à la première recherche de lieux, et pas au démarrage : le
  // catalogue pèse plus que tout le moteur réuni.
  const { poisDeLaDestination } = await import('@tripora/core/activites');
  const duCatalogue = poisDeLaDestination(destination.id) as Poi[];
  if (!supabase) return { liste: duCatalogue, quotaExceeded: false };

  try {
    const { data, error } = await supabase.functions.invoke('places', {
      body: { destinationId: destination.id, lat: destination.lat, lng: destination.lng },
    });
    if (error || !data) return { liste: duCatalogue, quotaExceeded: false };
    const osm = lireLieux(data);
    return { ...osm, liste: fusionner(duCatalogue, osm.liste) };
  } catch {
    return { liste: duCatalogue, quotaExceeded: false };
  }
}

/**
 * Le catalogue devant, OpenStreetMap derrière, sans doublon.
 *
 * Les deux sources se recoupent forcément : le Sensō-ji est dans le catalogue
 * et dans OSM. On écarte le doublon sur le nom plié — accents et casse en
 * moins — parce que les identifiants, eux, ne se ressemblent pas du tout.
 * C'est l'entrée du catalogue qu'on garde : elle porte une durée, un prix et
 * une phrase écrite pour être lue.
 */
export function fusionner(catalogue: readonly Poi[], osm: readonly Poi[]): Poi[] {
  const connus = new Set(catalogue.map((lieu) => fold(lieu.name)));
  return [...catalogue, ...osm.filter((lieu) => !connus.has(fold(lieu.name)))];
}

/**
 * Lecture défensive de la réponse.
 *
 * Exportée pour être testée : c'est la frontière entre des données venues
 * d'OpenStreetMap — donc écrites par n'importe qui — et l'écran.
 */
export function lireLieux(donnees: unknown): Lieux {
  if (typeof donnees !== 'object' || donnees === null) return VIDE;
  const source = donnees as { places?: unknown; quotaExceeded?: unknown };
  const quotaExceeded = source.quotaExceeded === true;
  if (!Array.isArray(source.places)) return { liste: [], quotaExceeded };

  const liste: Poi[] = [];
  for (const entree of source.places as LieuBrut[]) {
    const lieu = lireLieu(entree);
    if (lieu) liste.push(lieu);
  }
  return { liste, quotaExceeded };
}

function lireLieu(brut: LieuBrut): Poi | null {
  if (typeof brut.id !== 'string' || typeof brut.name !== 'string') return null;
  if (typeof brut.lat !== 'number' || typeof brut.lng !== 'number') return null;
  if (typeof brut.tags !== 'object' || brut.tags === null) return null;

  const classement = classifyPoi(brut.tags as Record<string, string>);
  if (!classement) return null;

  const nom = brut.name.trim();
  if (nom.length === 0) return null;

  return {
    id: brut.id,
    name: nom,
    lat: brut.lat,
    lng: brut.lng,
    ...classement,
    ...(typeof brut.wikipedia === 'string' ? { wikipedia: brut.wikipedia } : {}),
    ...(typeof brut.extract === 'string' ? { extract: brut.extract } : {}),
    ...(typeof brut.imageUrl === 'string' && brut.imageUrl.startsWith('https://')
      ? { imageUrl: brut.imageUrl }
      : {}),
    ...(typeof brut.externalUrl === 'string' && brut.externalUrl.startsWith('https://')
      ? { externalUrl: brut.externalUrl }
      : {}),
  };
}
