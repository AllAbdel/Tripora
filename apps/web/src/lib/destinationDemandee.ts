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
 * Revenir sur la création une fois connecté, c'est l'affaire de la suite après
 * connexion (`suiteApresConnexion.ts`), commune à toutes les pages qui
 * demandent un compte.
 */
export function retenirLaDestinationDemandee(recherche: string): boolean {
  const id = new URLSearchParams(recherche).get('destination');
  const destination = id ? findDestination(id) : undefined;
  if (!destination) return false;
  useTripDraft.getState().patch({ destinationMode: 'fixed', destinationIds: [destination.id] });
  return true;
}
