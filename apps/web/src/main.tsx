import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import App from './App';
import { AuthProvider } from '@/lib/auth';
import { persister, queryClient } from '@/lib/cache';
import { applyTheme, useTheme, watchSystemTheme } from '@/stores/theme';
import './index.css';

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
