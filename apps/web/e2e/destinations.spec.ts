import { expect, test } from '@playwright/test';

/**
 * Les pages publiques du carnet, telles qu'un moteur de recherche et un
 * visiteur les trouvent : du HTML servi tel quel, sous la vraie politique de
 * sécurité, puis le chemin vers l'application.
 */

test('une page de destination se lit sans compte et mène à la création du voyage', async ({
  page,
}) => {
  const plantages: string[] = [];
  page.on('pageerror', (erreur) => plantages.push(erreur.message));

  await page.goto('/destinations/bergen');
  await expect(page).toHaveTitle(/^Bergen et les fjords : que faire \?/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Bergen et les fjords : que faire ?');
  await expect(page.getByRole('heading', { name: 'Les activités' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Quand partir ?' })).toBeVisible();
  // La feuille de style est bien servie : sans elle, la barre ne colle pas.
  await expect(page.locator('.barre')).toHaveCSS('position', 'sticky');

  await page.getByRole('link', { name: 'Organiser ce voyage' }).first().click();
  await expect(page).toHaveURL(/\/voyages\/nouveau\?destination=bergen$/);

  // Pas encore de compte : l'écran de connexion, puis la création reprend.
  await page.getByRole('button', { name: /Découvrir en mode local/ }).click();
  await expect(page).toHaveURL(/\/voyages\/nouveau$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Avec qui partez-vous ?');

  const brouillon = await page.evaluate(
    () =>
      JSON.parse(localStorage.getItem('tripora.trip-draft') ?? '{}') as {
        state?: { destinationMode?: string; destinationIds?: string[] };
      },
  );
  expect(brouillon.state?.destinationMode).toBe('fixed');
  expect(brouillon.state?.destinationIds).toEqual(['bergen']);
  expect(plantages).toEqual([]);
});

test('le sommaire mène à chaque destination, et la confidentialité se lit sans compte', async ({
  page,
}) => {
  await page.goto('/destinations');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Où partir ?');
  await page.getByRole('link', { name: 'Lisbonne', exact: true }).click();
  await expect(page).toHaveURL(/\/destinations\/lisbonne$/);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Lisbonne');

  await page.getByRole('link', { name: 'Confidentialité' }).click();
  await expect(page.getByRole('heading', { name: 'Confidentialité et mentions légales' })).toBeVisible();
});

test('les robots trouvent le plan du site', async ({ request }) => {
  const robots = await (await request.get('/robots.txt')).text();
  expect(robots).toContain('Disallow: /voyages');
  const plan = await (await request.get('/sitemap.xml')).text();
  expect(plan).toContain('/destinations/bergen</loc>');
});
