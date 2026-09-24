import { dehydrate, QueryClient } from '@tanstack/react-query';
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
 * pour des voyages, et un navigateur qui le refuse (navigation privée stricte)
 * retombe simplement sur l'ancien comportement.
 */
const CLE_DU_CACHE = 'tripora.cache';

/**
 * La version du format rangé. À changer quand ce qu'on range change de forme :
 * une mise à jour de Tripora ne doit pas relire des données qu'elle ne
 * comprend plus.
 */
export const VERSION_DU_CACHE = 'v1';

export const persister = createSyncStoragePersister({
  storage: typeof window === 'undefined' ? undefined : window.localStorage,
  key: CLE_DU_CACHE,
  // Une écriture par seconde au plus : inutile de sérialiser à chaque frappe.
  throttleTime: 1000,
});

/**
 * Ranger le cache tout de suite, sans attendre la fin de la seconde.
 *
 * L'écriture limitée à une par seconde a un prix : elle part *après* le
 * dernier changement. Ce qu'on vient de faire — un « j'ai envie », un vote,
 * une dépense — n'est rangé qu'une seconde plus tard. Qu'on recharge la page,
 * ou que le téléphone ferme l'application, dans cette seconde-là, et c'est
 * l'état d'avant qui revient au prochain lancement. Il est alors tenu pour
 * frais une minute entière : l'itinéraire se remplissait sans l'envie qu'on
 * venait d'exprimer.
 *
 * On range donc tout, immédiatement, quand la page s'en va ou passe à
 * l'arrière-plan — sur un téléphone, c'est souvent le dernier signe de vie
 * avant que le système ne ferme l'application. Même format que la
 * sauvegarde ordinaire, pour que la restauration n'y voie aucune différence.
 */
export function sauverLeCacheMaintenant(): void {
  try {
    window.localStorage.setItem(
      CLE_DU_CACHE,
      JSON.stringify({
        buster: VERSION_DU_CACHE,
        timestamp: Date.now(),
        clientState: dehydrate(queryClient),
      }),
    );
  } catch {
    // Stockage plein ou refusé : la sauvegarde ordinaire fera ce qu'elle peut.
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', sauverLeCacheMaintenant);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') sauverLeCacheMaintenant();
  });
}

/** Oublie tout ce qui est en mémoire. Appelé à la déconnexion. */
export function viderLeCache(): void {
  queryClient.clear();
}
