import { expect, test } from '@playwright/test';

/**
 * La page qui rend la main à l'application mobile après la connexion Google.
 *
 * Supabase refusait `tripora://connexion`, absente de sa liste, et retombait
 * sur le site : la connexion partie de l'APK se terminait dans le navigateur.
 * Le retour passe maintenant par cette page du site, qui ne doit surtout pas
 * charger Tripora — le site, voyant un code sans sa preuve PKCE, relancerait
 * la connexion Google dans le navigateur, exactement le défaut d'avant.
 */

/**
 * Le téléphone des tests est un Pixel : la page tente aussitôt de rouvrir
 * l'application par une intention Android, que Chromium sans téléphone laisse
 * en suspens, et Playwright attend alors cette navigation-là, qui ne finit
 * jamais. On attend seulement que la page soit reçue ; les vérifications
 * attendent ensuite ce qu'elles ont besoin de voir.
 */
const DOCUMENT = { waitUntil: 'commit' } as const;

test('rend le code à l’application, sans charger le site', async ({ page }) => {
  await page.goto('/retour-app/?code=abc-123', DOCUMENT);

  await expect(page.getByRole('heading', { name: 'Connexion réussie' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Ouvrir Tripora' })).toHaveAttribute(
    'href',
    'tripora://connexion?code=abc-123',
  );
  // L'application web ne s'est pas montée : pas de racine React.
  await expect(page.locator('#root')).toHaveCount(0);
  // Le code a quitté la barre d'adresse et l'historique.
  await expect(page).toHaveURL(/\/retour-app\/$/);
});

test('rapporte un refus à l’application', async ({ page }) => {
  await page.goto(
    '/retour-app/?error=access_denied&error_description=Acc%C3%A8s+refus%C3%A9',
    DOCUMENT,
  );
  await expect(page.getByRole('heading', { name: 'Connexion refusée' })).toBeVisible();
  await expect(page.getByText('Accès refusé. Revenez dans Tripora pour réessayer.')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Ouvrir Tripora' })).toHaveAttribute(
    'href',
    /^tripora:\/\/connexion\?error=access_denied&error_description=/,
  );
});

test('ouverte sans rien, renvoie vers le site', async ({ page }) => {
  await page.goto('/retour-app/');
  await expect(page.getByRole('heading', { name: 'Rien à faire ici' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Aller sur Tripora' })).toHaveAttribute('href', '/');
});
