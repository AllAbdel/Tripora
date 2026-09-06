import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
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

applyTheme(useTheme.getState().preference);
watchSystemTheme();

const container = document.getElementById('root');
if (!container) throw new Error('Élément racine introuvable');

createRoot(container).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  </StrictMode>,
);
