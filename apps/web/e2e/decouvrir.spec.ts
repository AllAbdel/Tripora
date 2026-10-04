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
