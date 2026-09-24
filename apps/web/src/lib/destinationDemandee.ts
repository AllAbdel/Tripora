import { findDestination } from '@tripora/core';
import { useTripDraft } from '@/stores/tripDraft';

/**
 * « Organiser ce voyage », depuis une page publique du carnet.
 *
 * Le bouton mène à `/voyages/nouveau?destination=bergen`. La destination entre
 * aussitôt dans le brouillon du voyage, qui est gardé sur l'appareil : elle y
 * est encore après la connexion, alors que l'adresse, elle, ne survit pas à
 * l'aller-retour chez Google (le retour se fait toujours sur /voyages).
 *
 * Pour quelqu'un qui n'est pas encore connecté, on note aussi qu'une création
 * attend : l'accueil l'y renverra une fois la connexion faite, au lieu de le
 * laisser chercher le bouton.
 */

const CREATION_EN_ATTENTE = 'tripora.creer-apres-connexion';

export function retenirLaDestinationDemandee(
  recherche: string,
  { apresConnexion }: { apresConnexion: boolean },
): boolean {
  const id = new URLSearchParams(recherche).get('destination');
  const destination = id ? findDestination(id) : undefined;
  if (!destination) return false;
  useTripDraft.getState().patch({ destinationMode: 'fixed', destinationIds: [destination.id] });
  if (apresConnexion) {
    try {
      sessionStorage.setItem(CREATION_EN_ATTENTE, destination.id);
    } catch {
      // Stockage refusé : la destination reste dans le brouillon, il faudra
      // seulement ouvrir la création soi-même.
    }
  }
  return true;
}

/** Vrai une seule fois, si une création attendait la connexion. */
export function prendreLaCreationEnAttente(): boolean {
  try {
    const attente = sessionStorage.getItem(CREATION_EN_ATTENTE);
    sessionStorage.removeItem(CREATION_EN_ATTENTE);
    return attente !== null;
  } catch {
    return false;
  }
}
