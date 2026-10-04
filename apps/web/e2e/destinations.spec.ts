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

  // Pas de compte, et pas de mur : la création s'ouvre directement, la
  // destination déjà choisie. Le compte ne sera proposé qu'à la fin.
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Avec qui partez-vous ?');
  await expect(page).toHaveURL(/\/voyages\/nouveau\?destination=bergen$/);

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
  await expect(page.getByRole('heading', { name: 'Confidentialité', level: 1 })).toBeVisible();
});

test('les robots trouvent le plan du site', async ({ request }) => {
  const robots = await (await request.get('/robots.txt')).text();
  expect(robots).toContain('Disallow: /voyages');
  const plan = await (await request.get('/sitemap.xml')).text();
  expect(plan).toContain('/destinations/bergen</loc>');
});

test('les pages par mois se lisent et mènent aux destinations', async ({ page }) => {
  await page.goto('/ou-partir-en/octobre');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Où partir en octobre ?');
  await page.getByRole('link', { name: 'novembre' }).click();
  await expect(page).toHaveURL(/\/ou-partir-en\/novembre$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Où partir en novembre ?');
  await page.locator('main a[href^="/destinations/"]').first().click();
  await expect(page).toHaveURL(/\/destinations\/[a-z0-9-]+$/);
  await expect(page.getByRole('heading', { name: 'Réserver sur place' })).toBeVisible();
});

test('la version anglaise se lit, renvoie au français et ouvre l’application en anglais', async ({
  page,
}) => {
  const plantages: string[] = [];
  page.on('pageerror', (erreur) => plantages.push(erreur.message));

  // Le lien « In English » de la page française mène à sa traduction.
  await page.goto('/destinations/bergen');
  await page.getByRole('link', { name: 'In English' }).click();
  await expect(page).toHaveURL(/\/en\/destinations\/bergen$/);
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Things to do in Bergen and the fjords');
  await expect(page.getByRole('heading', { name: 'When to go' })).toBeVisible();

  await page.getByRole('link', { name: 'Plan this trip' }).first().click();
  await expect(page).toHaveURL(/\/voyages\/nouveau\?destination=bergen&langue=en$/);
  // Un navigateur réglé en français, mais l'adresse demande l'anglais.
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Who are you traveling with?');
  const brouillon = await page.evaluate(
    () =>
      JSON.parse(localStorage.getItem('tripora.trip-draft') ?? '{}') as {
        state?: { destinationIds?: string[] };
      },
  );
  expect(brouillon.state?.destinationIds).toEqual(['bergen']);
  expect(plantages).toEqual([]);
});

test('les mois en anglais se suivent et mènent aux destinations anglaises', async ({ page }) => {
  await page.goto('/en/where-to-go-in/october');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Where to go in October?');
  await page.getByRole('link', { name: 'November', exact: true }).click();
  await expect(page).toHaveURL(/\/en\/where-to-go-in\/november$/);
  await page.locator('main a[href^="/en/destinations/"]').first().click();
  await expect(page).toHaveURL(/\/en\/destinations\/[a-z0-9-]+$/);
  await expect(page.getByRole('heading', { name: 'Book on the ground' })).toBeVisible();
});
