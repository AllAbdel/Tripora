import { queryOptions } from '@tanstack/react-query';
import { classifyPoi, fold, type Destination, type Poi } from '@tripora/core';
import { lireLEtiquette } from './illustrations';
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
 * connaît le musée du quartier que personne n'aurait pensé à citer.
 *
 * OpenStreetMap passe par la base, pas par une fonction serveur : Overpass
 * refuse les adresses des Edge Functions, et l'ancienne fonction `places`
 * a échoué pour toutes les villes sauf Lisbonne pendant deux semaines. La
 * base, elle, sort par une autre adresse. Mais sa requête est asynchrone : au
 * premier appel pour une ville, elle répond « en attente », et c'est à
 * l'écran de rappeler quelques secondes plus tard — voir `requeteDesLieux`.
 *
 * Tout échec reste silencieux, comme pour les prix : une panne de fournisseur
 * ne doit jamais vider un écran.
 */

export interface Lieux {
  liste: Poi[];
  /** Vrai quand la limite gratuite du jour est atteinte. */
  quotaExceeded: boolean;
  /**
   * Vrai quand OpenStreetMap a été interrogé et n'a pas encore répondu. La
   * liste contient déjà le catalogue ; il faut rappeler pour le complément.
   */
  enAttente?: boolean;
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
    // Seul l'identifiant part : les coordonnées sont relues dans la base,
    // pour que personne ne fasse interroger Overpass sur l'endroit de son choix.
    const { data, error } = await supabase.rpc('lieux_osm', {
      p_destination_id: destination.id,
    });
    if (error || !data) return { liste: duCatalogue, quotaExceeded: false };
    const osm = lireLieux(data);
    return { ...osm, liste: fusionner(duCatalogue, osm.liste) };
  } catch {
    return { liste: duCatalogue, quotaExceeded: false };
  }
}

/** Assez pour laisser Overpass répondre, pas assez pour qu'on l'entende. */
const RAPPEL_MS = 4_000;
/**
 * Trente rappels, deux minutes : au-delà, la base tient la demande pour
 * perdue de toute façon. On arrête plutôt que de sonder dans le vide.
 */
const RAPPELS_MAX = 30;
const UN_JOUR_MS = 24 * 60 * 60 * 1000;

/**
 * La requête des lieux, identique pour les trois écrans qui s'en servent.
 *
 * Même clé, mêmes réglages : la carte, l'itinéraire et le sélecteur de lieux
 * partagent une seule réponse, et un seul cycle de rappels quand OpenStreetMap
 * est en attente. Une réponse en attente n'est jamais tenue pour fraîche —
 * sans quoi quitter l'écran avant l'arrivée des lieux les aurait fait
 * attendre vingt-quatre heures.
 */
export function requeteDesLieux(destination: Destination | null | undefined) {
  return queryOptions({
    queryKey: ['lieux', destination?.id],
    queryFn: () => chargerLieux(destination!),
    enabled: Boolean(destination),
    staleTime: (query) => (query.state.data?.enAttente ? 0 : UN_JOUR_MS),
    refetchInterval: (query) =>
      query.state.data?.enAttente && query.state.dataUpdateCount < RAPPELS_MAX ? RAPPEL_MS : false,
  });
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
  const source = donnees as { places?: unknown; quotaExceeded?: unknown; enAttente?: unknown };
  const quotaExceeded = source.quotaExceeded === true;
  const attente = source.enAttente === true ? { enAttente: true } : {};
  if (!Array.isArray(source.places)) return { liste: [], quotaExceeded, ...attente };

  const liste: Poi[] = [];
  for (const entree of source.places as LieuBrut[]) {
    const lieu = lireLieu(entree);
    if (lieu) liste.push(lieu);
  }
  return { liste, quotaExceeded, ...attente };
}

function lireLieu(brut: LieuBrut): Poi | null {
  if (typeof brut.id !== 'string' || typeof brut.name !== 'string') return null;
  if (typeof brut.lat !== 'number' || typeof brut.lng !== 'number') return null;
  if (typeof brut.tags !== 'object' || brut.tags === null) return null;

  const classement = classifyPoi(brut.tags as Record<string, string>);
  if (!classement) return null;

  const nom = brut.name.trim();
  if (nom.length === 0) return null;

  const wikipedia = articleDuLieu(brut.wikipedia, brut.tags as Record<string, unknown>);

  return {
    id: brut.id,
    name: nom,
    lat: brut.lat,
    lng: brut.lng,
    ...classement,
    ...(wikipedia ? { wikipedia } : {}),
    ...(typeof brut.extract === 'string' ? { extract: brut.extract } : {}),
    ...(typeof brut.imageUrl === 'string' && brut.imageUrl.startsWith('https://')
      ? { imageUrl: brut.imageUrl }
      : {}),
    ...(typeof brut.externalUrl === 'string' && brut.externalUrl.startsWith('https://')
      ? { externalUrl: brut.externalUrl }
      : {}),
  };
}

/**
 * L'article Wikipédia d'un lieu, toujours au format « langue:Titre ».
 *
 * Deux provenances, deux formats. L'ancienne fonction serveur rangeait le
 * titre français nu (« Tour de Belém ») ; OpenStreetMap donne l'étiquette de
 * la langue du pays (« pt:Torre de Belém »). Le format commun est celui du
 * carnet d'activités, que l'illustration sait lire.
 */
export function articleDuLieu(
  titreFrancais: unknown,
  tags: Record<string, unknown>,
): string | undefined {
  if (typeof titreFrancais === 'string' && titreFrancais.trim().length > 1) {
    const titre = titreFrancais.trim().slice(0, 200);
    return lireLEtiquette(titre) ? titre : `fr:${titre}`;
  }
  const etiquette = tags['wikipedia'];
  if (typeof etiquette === 'string' && lireLEtiquette(etiquette)) return etiquette.slice(0, 200);
  return undefined;
}
