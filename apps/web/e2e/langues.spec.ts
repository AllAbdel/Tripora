import { expect, test } from '@playwright/test';
import { BALI, poser } from './tripora';

/**
 * Le multilingue, dans un vrai navigateur.
 *
 * Les tests unitaires vérifient les dictionnaires ; ils ne peuvent pas voir si
 * la page se retourne, ni si la langue tient d'un écran à l'autre. C'est ce
 * que font ces trois-là.
 */

/** Écrit la préférence comme le ferait le réglage, avant le premier rendu. */
async function reglerLaLangue(page: import('@playwright/test').Page, langue: string) {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.evaluate(
    (valeur) =>
      localStorage.setItem(
        'tripora.langue',
        JSON.stringify({ state: { preference: valeur }, version: 0 }),
      ),
    langue,
  );
}

test('la langue choisie s’applique à la navigation', async ({ page }) => {
  await reglerLaLangue(page, 'ja');
  await poser(page, [BALI], '/voyages');
  // « exact » parce que le bouton « トリップを作る » contient le même mot : sans
  // lui, le sélecteur attrape deux liens et Playwright refuse de choisir.
  await expect(page.getByRole('link', { name: 'トリップ', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'マイトリップ' })).toBeVisible();
});

test('l’arabe retourne la page, et le français y reste lisible', async ({ page }) => {
  await reglerLaLangue(page, 'ar');
  await poser(page, [BALI], '/voyages');

  // Le sens de lecture est posé sur la racine avant le premier rendu : sans
  // ça, la page sauterait d'un côté à l'autre sous les yeux.
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.locator('html')).toHaveAttribute('lang', 'ar');
  await expect(page.getByRole('link', { name: 'الرحلات' })).toBeVisible();

  // La traduction est partielle : des phrases françaises cohabitent avec
  // l'arabe. Elles doivent garder leur ponctuation du bon côté — sans
  // `unicode-bidi: plaintext`, « risqué pour un vrai voyage. » s'affichait
  // « .risqué pour un vrai voyage ».
  const bidi = await page.evaluate(() => {
    const paragraphe = [...document.querySelectorAll('p, div')].find((element) =>
      element.textContent?.includes('risqué pour un vrai voyage'),
    );
    return paragraphe ? getComputedStyle(paragraphe).unicodeBidi : null;
  });
  expect(bidi).toBe('plaintext');
});

test('la langue survit au changement d’écran', async ({ page }) => {
  await reglerLaLangue(page, 'de');
  await poser(page, [BALI], '/voyages');
  await expect(page.getByRole('heading', { name: 'Meine Trips' })).toBeVisible();

  await page.getByRole('link', { name: 'Profil' }).first().click();
  await expect(page.getByRole('link', { name: 'Karte' })).toBeVisible();
});
