import { expect, test, type Page } from '@playwright/test';
import { BALI, poser } from './tripora';

/**
 * Découvrir : les idées une par une, qu'on garde d'un glissement.
 *
 * Le mode local fait juger « moi » seul, ce qui suffit à vérifier le geste,
 * le retour en arrière et le classement.
 */

function carte(page: Page) {
  return page.locator('[aria-roledescription="carte"]');
}

async function nomDeLaCarte(page: Page): Promise<string> {
  return (await carte(page).getAttribute('aria-label')) ?? '';
}

/** Glisser la carte à la souris, en petits pas, comme un doigt. */
async function glisserLaCarte(page: Page, dx: number, dy = 0) {
  const boite = (await carte(page).boundingBox())!;
  const x = boite.x + boite.width / 2;
  const y = boite.y + boite.height / 3;
  await page.mouse.move(x, y);
  await page.mouse.down();
  for (let pas = 1; pas <= 10; pas += 1) {
    await page.mouse.move(x + (dx * pas) / 10, y + (dy * pas) / 10);
    await page.waitForTimeout(16);
  }
  await page.mouse.up();
}

test('garder, passer, revenir, et le classement du groupe', async ({ page }) => {
  await poser(page, [BALI], '/voyages/v1/decouvrir');
  await expect(page.getByRole('heading', { name: 'Découvrir à Bali' })).toBeAttached();
  // Plein écran : pas d'onglets en bas.
  await expect(page.getByRole('navigation', { name: 'Navigation principale' })).toHaveCount(0);

  const premiere = await nomDeLaCarte(page);
  expect(premiere).not.toBe('');
  await page.screenshot({ path: 'test-results/decouvrir.png' });

  // Le bouton « J'y vais » fait partir la carte à droite.
  await page.getByRole('button', { name: 'J’y vais' }).click();
  await expect(carte(page)).not.toHaveAttribute('aria-label', premiere);
  const deuxieme = await nomDeLaCarte(page);

  // Revenir : la première réapparaît.
  await page.getByRole('button', { name: 'Revenir à la précédente' }).click();
  await expect(carte(page)).toHaveAttribute('aria-label', premiere);
  // La rejuger ramène à la suite du fil.
  await page.keyboard.press('ArrowRight');
  await expect(carte(page)).toHaveAttribute('aria-label', deuxieme);

  // Glisser à gauche à la souris : pas pour moi.
  await glisserLaCarte(page, -260);
  await expect(carte(page)).not.toHaveAttribute('aria-label', deuxieme);
  const troisieme = await nomDeLaCarte(page);

  // Tirer vers le bas : la précédente revient.
  await glisserLaCarte(page, 0, 260);
  await expect(carte(page)).toHaveAttribute('aria-label', deuxieme);
  await page.keyboard.press('ArrowLeft');
  await expect(carte(page)).toHaveAttribute('aria-label', troisieme);

  // Le classement : ce que j'ai gardé, compté sans dire qui.
  await page.getByRole('tab', { name: 'Classement' }).click();
  const classement = page.getByRole('listitem').filter({ hasText: premiere });
  await expect(classement).toContainText('Vous en avez envie');
  await expect(page.getByRole('listitem').filter({ hasText: deuxieme })).toHaveCount(0);
  await page.screenshot({ path: 'test-results/decouvrir-classement.png' });
});

test('« À faire » mène à Découvrir, et compte sans nommer', async ({ page }) => {
  await poser(page, [BALI], '/voyages/v1/a-faire');
  await page.getByRole('link', { name: /Découvrir en glissant/u }).click();
  await expect(page).toHaveURL(/\/voyages\/v1\/decouvrir$/u);
  const nom = await nomDeLaCarte(page);
  await page.getByRole('button', { name: 'J’y vais' }).click();
  await expect(carte(page)).not.toHaveAttribute('aria-label', nom);

  await page.getByRole('link', { name: 'Voir la liste complète' }).click();
  await expect(page).toHaveURL(/\/voyages\/v1\/a-faire$/u);
  await expect(page.getByRole('button', { name: `J’ai envie : ${nom}` })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByText('Vous en avez envie').first()).toBeVisible();
});

test('deux tapes sur la carte : j’y vais', async ({ page }) => {
  await poser(page, [BALI], '/voyages/v1/decouvrir');
  const nom = await nomDeLaCarte(page);
  await carte(page).dblclick({ position: { x: 150, y: 200 } });
  await expect(carte(page)).not.toHaveAttribute('aria-label', nom);
  await page.getByRole('tab', { name: 'Classement' }).click();
  await expect(page.getByRole('listitem').filter({ hasText: nom })).toContainText('Vous en avez envie');
});

/** Une image d'un pixel : de quoi répondre à la place de Wikimedia. */
const PIXEL = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
  'base64',
);

test('chaque idée a sa photo, servie depuis thumb.wikimedia.org, et son crédit', async ({ page }) => {
  // Les voyages d'abord : le réseau est coupé, puis Wikimedia simulé par-dessus
  // (la dernière règle posée l'emporte). Les réponses ont la forme réelle de
  // l'API : vignette sur thumb.wikimedia.org, au palier de 960 px.
  await poser(page, [BALI], '/voyages');
  const vignettes: string[] = [];
  const titres = (url: string) => (new URL(url).searchParams.get('titles') ?? '').split('|');
  await page.route(/^https:\/\/[a-z]+\.wikipedia\.org\/w\/api\.php/u, (route) =>
    route.fulfill({
      headers: { 'access-control-allow-origin': '*' },
      json: {
        query: {
          pages: Object.fromEntries(
            titres(route.request().url()).map((titre, i) => [
              String(i),
              {
                title: titre,
                pageimage: `Photo ${i}.jpg`,
                thumbnail: {
                  source: `https://thumb.wikimedia.org/wikipedia/commons/thumb/a/ab/Photo_${i}.jpg/960px-Photo_${i}.jpg?utm_source=fr.wikipedia.org&utm_campaign=api&utm_content=thumbnail`,
                  width: 640,
                  height: 480,
                },
              },
            ]),
          ),
        },
      },
    }),
  );
  await page.route(/^https:\/\/commons\.wikimedia\.org\/w\/api\.php/u, (route) =>
    route.fulfill({
      headers: { 'access-control-allow-origin': '*' },
      json: {
        query: {
          pages: Object.fromEntries(
            titres(route.request().url()).map((titre, i) => [
              String(i),
              {
                title: titre,
                imageinfo: [
                  {
                    extmetadata: {
                      Artist: { value: 'Une photographe' },
                      LicenseShortName: { value: 'CC BY-SA 4.0' },
                    },
                  },
                ],
              },
            ]),
          ),
        },
      },
    }),
  );
  await page.route(/^https:\/\/thumb\.wikimedia\.org\//u, (route) => {
    vignettes.push(route.request().url());
    return route.fulfill({ body: PIXEL, contentType: 'image/png' });
  });

  await page.goto('/voyages/v1/decouvrir', { waitUntil: 'networkidle' });
  const photo = carte(page).locator('img').first();
  await expect(photo).toBeVisible();
  await expect(photo).toHaveAttribute('src', /^https:\/\/thumb\.wikimedia\.org\/.+\/960px-/u);
  await expect(carte(page).getByText('Photo : Une photographe · CC BY-SA 4.0')).toBeVisible();

  // Le classement réduit ses vignettes à un palier de 250 px.
  const gardee = await nomDeLaCarte(page);
  await page.getByRole('button', { name: 'J’y vais' }).click();
  await page.getByRole('tab', { name: 'Classement' }).click();
  const ligne = page.getByRole('listitem').filter({ hasText: gardee });
  await expect(ligne.locator('img')).toHaveAttribute('src', /\/250px-Photo_/u);
  // Chargée en différé (loading="lazy") : on attend que la requête parte.
  await expect.poll(() => vignettes.some((adresse) => adresse.includes('/250px-'))).toBe(true);
});
