import type { Destination } from '@tripora/core';
import { supabase } from './supabase';

/**
 * La photo de couverture d'une destination.
 *
 * Un voyage sans image ressemble à un tableur. La photo vient de Wikipédia,
 * gratuitement et sans clé, et elle arrive avec ce qu'il faut pour la créditer :
 * les images de Commons sont librement réutilisables, presque jamais sans
 * condition. C'est pour ça que ce module transporte l'auteur et la licence, et
 * pas seulement une URL — une adresse seule inviterait à oublier la mention.
 *
 * Tout est lu défensivement : la réponse vient du réseau, et l'auteur d'une
 * photo est un texte écrit par un inconnu. Rien n'est jamais interprété comme
 * du balisage.
 */

export interface Couverture {
  url: string;
  auteur: string | null;
  licence: string | null;
  pageDuFichier: string;
  /** L'article dont vient l'image, pour situer la photo. */
  article: string;
}

function texte(valeur: unknown, max: number): string | null {
  return typeof valeur === 'string' && valeur.trim().length > 0
    ? valeur.trim().slice(0, max)
    : null;
}

/** Seules ces adresses servent une image : le reste n'est pas une couverture. */
function urlAcceptable(valeur: unknown): string | null {
  if (typeof valeur !== 'string') return null;
  try {
    const url = new URL(valeur);
    const hote = url.hostname.toLowerCase();
    const permis =
      url.protocol === 'https:' &&
      (hote === 'wikimedia.org' ||
        hote.endsWith('.wikimedia.org') ||
        hote.endsWith('.wikipedia.org'));
    return permis ? url.toString() : null;
  } catch {
    return null;
  }
}

/**
 * Lecture de la réponse, exportée pour être testée.
 *
 * C'est la frontière entre une réponse réseau et l'écran. L'URL est vérifiée
 * plutôt que crue : une adresse arbitraire posée dans un `<img>` ferait de
 * chaque ouverture de voyage une requête vers un serveur tiers, ce qui est
 * exactement ce que Tripora promet de ne pas faire.
 */
export function lireCouverture(donnees: unknown): Couverture | null {
  if (typeof donnees !== 'object' || donnees === null) return null;
  const brut = (donnees as { couverture?: unknown }).couverture;
  if (typeof brut !== 'object' || brut === null) return null;

  const source = brut as Record<string, unknown>;
  const url = urlAcceptable(source['url']);
  if (!url) return null;

  return {
    url,
    auteur: texte(source['auteur'], 120),
    licence: texte(source['licence'], 60),
    pageDuFichier: urlAcceptable(source['pageDuFichier']) ?? 'https://commons.wikimedia.org',
    article: texte(source['article'], 120) ?? '',
  };
}

export async function chargerCouverture(
  destination: Destination,
): Promise<Couverture | null> {
  if (!supabase) return null;
  try {
    const { data, error } = await supabase.functions.invoke('cover', {
      body: {
        destinationId: destination.id,
        name: destination.name,
        country: destination.country,
      },
    });
    if (error || !data) return null;
    return lireCouverture(data);
  } catch {
    return null;
  }
}
