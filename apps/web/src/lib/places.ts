import { classifyPoi, type Destination, type Poi } from '@tripora/core';
import { supabase } from './supabase';

/**
 * Les lieux réels d'une destination.
 *
 * La fonction serveur ramène la matière brute d'OpenStreetMap ; c'est ici
 * qu'elle devient une liste utilisable, en passant par `classifyPoi` du
 * moteur — le même classement testé, appliqué au même endroit pour tout le
 * monde. Ce que la règle ne reconnaît pas est écarté sans bruit : mieux vaut
 * une liste courte et juste qu'une liste longue et fausse.
 *
 * Tout échec est silencieux, comme pour les prix : sans lieux, l'itinéraire
 * garde sa structure et le champ de saisie libre reste là. Une panne de
 * fournisseur ne doit jamais vider un écran.
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
  if (!supabase) return VIDE;

  try {
    const { data, error } = await supabase.functions.invoke('places', {
      body: { destinationId: destination.id, lat: destination.lat, lng: destination.lng },
    });
    if (error || !data) return VIDE;
    return lireLieux(data);
  } catch {
    return VIDE;
  }
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
