import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig, devices } from '@playwright/test';

/**
 * Les tests de bout en bout : l'application construite, dans un vrai
 * navigateur, sur un écran de téléphone.
 *
 * Ils existent parce que les tests unitaires n'ont rien vu. Cinq défauts
 * livrés le même jour — une page blanche à la deuxième ouverture, un
 * glissement sans effet à la souris, un voyage sans sa destination sur
 * l'accueil — passaient tous devant cinq cent trente tests au vert. Aucun
 * n'était détectable autrement qu'en ouvrant l'application.
 *
 * Le mode local (sans serveur) est celui qu'on teste : il ne dépend d'aucun
 * réseau, ne touche à aucune vraie donnée, ne consomme aucun quota, et
 * traverse exactement les écrans où ces défauts vivaient.
 */

const PORT = 4173;

/**
 * Où trouver Chromium quand Playwright ne le sait pas.
 *
 * Un environnement de développement fourni avec un Chromium complet fait
 * échouer le lancement, parce que Playwright cherche une version précise du
 * « headless shell » qui n'est pas celle installée. On lui donne le chemin
 * quand on en connaît un, et on le laisse se débrouiller sinon — c'est le cas
 * de l'intégration continue, qui installe le sien.
 */
function chromiumLocal(): { executablePath: string } | Record<string, never> {
  const candidats = [
    process.env['CHROMIUM_PATH'],
    process.env['PLAYWRIGHT_BROWSERS_PATH']
      ? resolve(process.env['PLAYWRIGHT_BROWSERS_PATH'], 'chromium')
      : null,
  ];
  for (const chemin of candidats) {
    if (chemin && existsSync(chemin)) return { executablePath: chemin };
  }
  return {};
}

export default defineConfig({
  testDir: './e2e',
  // Un test de bout en bout qui passe une fois sur deux ne dit rien. Aucune
  // reprise : s'il échoue, c'est qu'il y a quelque chose à regarder.
  retries: 0,
  fullyParallel: true,
  forbidOnly: Boolean(process.env['CI']),
  reporter: process.env['CI'] ? [['github'], ['list']] : [['list']],
  timeout: 30_000,
  expect: { timeout: 8_000 },

  use: {
    baseURL: `http://localhost:${PORT}`,
    // Une langue fixée, sinon les tests lisent l'application dans la langue du
    // navigateur qui les exécute — « en-US » par défaut. Ils ont commencé à
    // échouer le jour du multilingue en cherchant « Mes trips » sur un écran
    // qui affichait « My trips », ce qui était exactement le comportement
    // attendu. Le sens de lecture de droite à gauche a son propre test.
    locale: 'fr-FR',
    // La trace d'un échec vaut mieux qu'une capture : on rejoue le test clic
    // par clic, avec le réseau et la console.
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'téléphone',
      use: { ...devices['Pixel 7'], launchOptions: chromiumLocal() },
    },
  ],

  webServer: {
    // Construit sans serveur configuré : l'application bascule en mode local,
    // et les voyages vivent dans le navigateur du test.
    command:
      'VITE_SUPABASE_URL= VITE_SUPABASE_ANON_KEY= vite build --outDir dist-e2e --emptyOutDir' +
      ' && node e2e/serveur.mjs',
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env['CI'],
    timeout: 180_000,
    stdout: 'ignore',
    stderr: 'pipe',
  },
});
