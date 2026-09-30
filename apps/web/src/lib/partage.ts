import {
  estUnRaccourciDeCarte,
  lieuDuLienDeCarte,
  premierLien,
  type GeoPoint,
} from '@tripora/core';
import { supabase } from './supabase';
import { chercherAdresses } from './geocode';

/** Un lieu trouvé dans un lien, proposé comme épingle. */
export interface LieuPropose {
  nom: string;
  lat: number | null;
  lng: number | null;
  adresse: string | null;
}

export type SourceDePartage = 'carte' | 'tiktok' | 'youtube' | 'instagram' | 'web' | 'texte';

export interface LectureDuPartage {
  source: SourceDePartage;
  /** L'adresse d'origine, gardée sur l'épingle pour retrouver la vidéo. */
  lien: string | null;
  titre: string | null;
  lieux: LieuPropose[];
  /** Cités mais pas situés : à chercher à la main. */
  nonSitues: string[];
  /** Vrai quand aucun modèle n'a lu le texte : seuls les lieux évidents sont là. */
  sansIA: boolean;
}

export class LectureImpossible extends Error {
  constructor(public readonly raison: 'lien' | 'lecture' | 'quota' | 'hors-ligne' | 'serveur') {
    super(raison);
    this.name = 'LectureImpossible';
  }
}

export const LIBELLES_DES_SOURCES: Record<SourceDePartage, string> = {
  carte: 'une carte',
  tiktok: 'TikTok',
  youtube: 'YouTube',
  instagram: 'Instagram',
  web: 'une page web',
  texte: 'un texte',
};

/**
 * Ce que la personne a partagé, à partir des paramètres reçus.
 *
 * Android et le partage du navigateur ne rangent pas le lien au même endroit :
 * tantôt dans `url`, tantôt au milieu du texte (« Regarde ça
 * https://vm.tiktok.com/… »). On prend le premier lien trouvé, où qu'il soit.
 */
export function ceQuiEstPartage(parametres: URLSearchParams): { lien: string | null; texte: string } {
  const lien = parametres.get('lien')?.trim() || null;
  const texte = [parametres.get('titre'), parametres.get('texte')]
    .filter((partie): partie is string => Boolean(partie?.trim()))
    .join('\n')
    .slice(0, 3000);
  const trouve = lien ?? premierLienDe(texte);
  return { lien: trouve, texte };
}

function premierLienDe(texte: string): string | null {
  const fragment = premierLien(texte);
  return fragment?.kind === 'link' ? fragment.url : null;
}

/**
 * Lire un lien partagé : une carte se lit ici, le reste passe par le serveur.
 *
 * Une fiche Google Maps porte ses coordonnées dans l'adresse — pas besoin du
 * réseau. Un raccourci (`maps.app.goo.gl`) doit d'abord être suivi, et une
 * vidéo ou une page lue : c'est le serveur qui s'en charge, parce que le
 * navigateur n'a pas le droit d'aller lire une page d'un autre site.
 */
export async function lireLePartage({
  lien,
  texte,
  pres,
  destination,
}: {
  lien: string | null;
  texte: string;
  pres: GeoPoint | null;
  destination: string | null;
}): Promise<LectureDuPartage> {
  if (lien && !estUnRaccourciDeCarte(lien)) {
    const carte = await depuisUneCarte(lien);
    if (carte) return carte;
  }

  // Ni lien ni carte : un nom de lieu tapé ou partagé tel quel.
  if (!lien) {
    const nom = texte.trim().split('\n')[0]?.slice(0, 120) ?? '';
    if (nom.length < 3) throw new LectureImpossible('lien');
    const [trouve] = await chercherAdresses(nom);
    return {
      source: 'texte',
      lien: null,
      titre: null,
      lieux: [
        trouve
          ? { nom, lat: trouve.lat, lng: trouve.lng, adresse: trouve.address || null }
          : { nom, lat: null, lng: null, adresse: null },
      ],
      nonSitues: [],
      sansIA: true,
    };
  }

  if (!supabase) throw new LectureImpossible('serveur');
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    throw new LectureImpossible('hors-ligne');
  }

  const { data, error } = await supabase.functions.invoke('lire-un-lien', {
    body: {
      lien,
      texte,
      ...(pres ? { pres: { lat: pres.lat, lng: pres.lng } } : {}),
      ...(destination ? { destination } : {}),
    },
  });
  if (error || !data) throw new LectureImpossible('lecture');
  const reponse = data as {
    ok?: boolean;
    raison?: 'lien' | 'lecture' | 'quota';
    source?: SourceDePartage;
    urlFinale?: string;
    titre?: string | null;
    lieux?: { nom: string; lat: number; lng: number; adresse: string | null }[];
    nonSitues?: string[];
    sansIA?: boolean;
  };
  if (!reponse.ok) throw new LectureImpossible(reponse.raison ?? 'lecture');

  // Un raccourci de carte suivi par le serveur : on lit l'adresse d'arrivée ici.
  if (reponse.source === 'carte' && reponse.urlFinale) {
    const carte = await depuisUneCarte(reponse.urlFinale, lien);
    if (carte) return carte;
    throw new LectureImpossible('lecture');
  }

  return {
    source: reponse.source ?? 'web',
    lien,
    titre: reponse.titre ?? null,
    lieux: (reponse.lieux ?? []).map((lieu) => ({
      nom: lieu.nom,
      lat: lieu.lat,
      lng: lieu.lng,
      adresse: lieu.adresse,
    })),
    nonSitues: reponse.nonSitues ?? [],
    sansIA: reponse.sansIA ?? true,
  };
}

async function depuisUneCarte(adresse: string, lienDOrigine = adresse): Promise<LectureDuPartage | null> {
  const lieu = lieuDuLienDeCarte(adresse);
  if (!lieu) return null;
  let { lat, lng } = lieu;
  let adresseLisible: string | null = null;
  if ((lat === null || lng === null) && lieu.recherche) {
    const [trouve] = await chercherAdresses(lieu.recherche);
    if (trouve) {
      lat = trouve.lat;
      lng = trouve.lng;
      adresseLisible = trouve.address || null;
    }
  }
  return {
    source: 'carte',
    lien: lienDOrigine,
    titre: null,
    lieux: [{ nom: lieu.nom ?? 'Lieu partagé', lat, lng, adresse: adresseLisible }],
    nonSitues: [],
    sansIA: true,
  };
}

/** Ce qu'on dit quand la lecture échoue, et quoi faire. */
export function messageDeLecture(cause: unknown): string {
  const raison = cause instanceof LectureImpossible ? cause.raison : 'lecture';
  switch (raison) {
    case 'lien':
      return 'Ce n’est pas un lien que Tripora sait ouvrir. Collez l’adresse complète, commençant par https://.';
    case 'quota':
      return 'Tripora a lu beaucoup de liens aujourd’hui. Réessayez demain, ou cherchez le lieu à la main.';
    case 'hors-ligne':
      return 'Pas de réseau : le lien sera lisible une fois reconnecté.';
    case 'serveur':
      return 'Lire un lien demande un serveur, et cette version de Tripora n’en a pas.';
    default:
      return 'Impossible de lire ce lien (page privée, ou site qui refuse les robots). Cherchez le lieu à la main.';
  }
}
