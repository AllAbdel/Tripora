import { expect, test, type Page } from '@playwright/test';
import { poser } from './tripora';

/**
 * Plumio, la mascotte : il vit sur un écran vide, et ne bouge plus du tout
 * quand on a demandé moins de mouvement (design/mascotte/NOTES.md, « Tests utiles »).
 */

/** Les animations en cours sur Plumio. */
function animationsDePlumio(page: Page): Promise<number> {
  return page.evaluate(
    () =>
      document.getAnimations().filter((animation) => {
        const cible = (animation.effect as KeyframeEffect | null)?.target;
        return cible instanceof Element && cible.closest('.plumio') !== null;
      }).length,
  );
}

test('vit sur l’écran vide des voyages', async ({ page }) => {
  await poser(page, [], '/voyages');
  await expect(page.getByRole('heading', { name: 'Aucun trip pour l’instant' })).toBeVisible();
  await expect(page.locator('svg.plumio--attend')).toBeVisible();
  await expect.poll(() => animationsDePlumio(page)).toBeGreaterThan(0);
});

test('ne bouge plus quand on a demandé moins de mouvement', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await poser(page, [], '/voyages');
  await expect(page.locator('svg.plumio--attend')).toBeVisible();
  expect(await animationsDePlumio(page)).toBe(0);
});
