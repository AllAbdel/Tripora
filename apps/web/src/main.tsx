import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import { QueryClient } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';
import App from './App';
import { AuthProvider } from '@/lib/auth';
import { applyTheme, useTheme, watchSystemTheme } from '@/stores/theme';
import './index.css';

/**
 * Réglages de cache pensés pour un usage en déplacement : on privilégie
 * l'affichage immédiat de ce qu'on a déjà, et on évite de relancer des requêtes
 * (donc de consommer du quota) au moindre retour sur l'onglet.
 */
const queryClient = new QueryClient({
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
const persister = createSyncStoragePersister({
  storage: typeof window === 'undefined' ? undefined : window.localStorage,
  key: 'tripora.cache',
  // Une écriture par seconde au plus : inutile de sérialiser à chaque frappe.
  throttleTime: 1000,
});

applyTheme(useTheme.getState().preference);
watchSystemTheme();

const container = document.getElementById('root');
if (!container) throw new Error('Élément racine introuvable');

createRoot(container).render(
  <StrictMode>
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister,
        // Au-delà d'une semaine, ce qu'on a gardé ne décrit plus le voyage :
        // les prix ont bougé, les autres ont voté. Mieux vaut repartir de zéro.
        maxAge: 7 * 24 * 60 * 60 * 1000,
        // La version change avec le format du cache : une mise à jour de
        // Tripora ne doit pas relire des données qu'elle ne comprend plus.
        buster: 'v1',
      }}
    >
      <AuthProvider>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </AuthProvider>
    </PersistQueryClientProvider>
  </StrictMode>,
);
