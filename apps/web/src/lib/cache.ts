import { QueryClient } from '@tanstack/react-query';
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';

/**
 * Le cache des requêtes, dans son propre module.
 *
 * Il vivait dans le point d'entrée, ce qui le rendait inatteignable depuis le
 * reste de l'application : la déconnexion ne pouvait pas le vider sans créer
 * un cycle d'imports, et le compte suivant voyait s'afficher les voyages du
 * précédent le temps que les requêtes reviennent.
 */
/**
 * Réglages de cache pensés pour un usage en déplacement : on privilégie
 * l'affichage immédiat de ce qu'on a déjà, et on évite de relancer des requêtes
 * (donc de consommer du quota) au moindre retour sur l'onglet.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      gcTime: 24 * 60 * 60 * 1000,
      refetchOnWindowFocus: false,
      retry: (failureCount, error) => {
        const status = (error as { status?: number } | null)?.status;
        // Inutile d'insister sur un refus d'accès ou un quota épuisé.
        if (status === 401 || status === 403 || status === 404 || status === 429) return false;
        return failureCount < 2;
      },
    },
  },
});

/**
 * Le cache survit à la fermeture de l'onglet.
 *
 * Sans ça, ouvrir Tripora hors réseau — dans un avion, dans un métro, à
 * l'étranger sans forfait — donnait un écran qui tourne : le Service Worker
 * finissait par servir la réponse en cache, mais seulement après six secondes
 * d'attente réseau, et pour chaque requête. Avec le cache persisté, l'écran
 * s'affiche immédiatement avec ce qu'on savait, et se met à jour si le réseau
 * revient.
 *
 * `localStorage` et pas IndexedDB : quelques dizaines de kilo-octets suffisent
 * pour des voyages, l'écriture est synchrone donc rien ne se perd à la
 * fermeture, et un navigateur qui la refuse (navigation privée stricte)
 * retombe simplement sur l'ancien comportement.
 */
export const persister = createSyncStoragePersister({
  storage: typeof window === 'undefined' ? undefined : window.localStorage,
  key: 'tripora.cache',
  // Une écriture par seconde au plus : inutile de sérialiser à chaque frappe.
  throttleTime: 1000,
});

/** Oublie tout ce qui est en mémoire. Appelé à la déconnexion. */
export function viderLeCache(): void {
  queryClient.clear();
}
