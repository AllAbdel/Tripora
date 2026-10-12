import { expect, test, type Page } from '@playwright/test';
import { BALI, poser } from './tripora';

/**
 * Les bruitages de Plumio, dans un vrai navigateur.
 *
 * Avant tout geste de la personne, le navigateur refuse le son : Plumio n'ouvre
 * alors aucun contexte audio (ce serait un avertissement dans la console à
 * chaque visite). Dès le premier appui, ses gestes se font entendre — sauf si
 * on a coupé ses bruitages dans le profil.
 */
test.use({ storageState: { cookies: [], origins: [] } });

declare global {
  interface Window {
    __bruitages: { contextes: number; sons: number };
  }
}

/**
 * Compte les contextes audio ouverts et les sons fabriqués.
 *
 * Et rend à `navigator.userActivation` son sens ordinaire : piloté par
 * Playwright, Chromium tient chaque page pour déjà touchée dès son
 * ouverture, ce qu'aucun visiteur ne fait.
 */
async function ecouter(page: Page) {
  await page.addInitScript(() => {
    let touchee = false;
    for (const nom of ['pointerdown', 'keydown']) {
      window.addEventListener(nom, () => (touchee = true), { capture: true });
    }
    Object.defineProperty(Navigator.prototype, 'userActivation', {
      configurable: true,
      get: () => ({ hasBeenActive: touchee, isActive: touchee }),
    });
    const compte = { contextes: 0, sons: 0 };
    window.__bruitages = compte;
    const Origine = window.AudioContext;
    window.AudioContext = class extends Origine {
      constructor(options?: AudioContextOptions) {
        super(options);
        compte.contextes += 1;
      }
      override createOscillator() {
        compte.sons += 1;
        return super.createOscillator();
      }
      override createBufferSource() {
        compte.sons += 1;
        return super.createBufferSource();
      }
    };
  });
}

test('Plumio se tait avant le premier geste, puis se fait entendre', async ({ page }) => {
  const plantages: string[] = [];
  const avertissements: string[] = [];
  page.on('pageerror', (erreur) => plantages.push(erreur.message));
  page.on('console', (message) => {
    if (/AudioContext/u.test(message.text())) avertissements.push(message.text());
  });
  await ecouter(page);
  await poser(page, [BALI], '/voyages');

  const accueil = page.getByRole('dialog', { name: 'Bonjour, moi c’est Plumio !' });
  await expect(accueil).toBeVisible();
  // Il arrive, salue : sans geste préalable, le navigateur refuserait le son.
  await page.waitForTimeout(1500);
  expect(await page.evaluate(() => window.__bruitages)).toEqual({ contextes: 0, sons: 0 });

  // Un appui : son demi-tour, puis ses gestes dans la visite, se font entendre.
  await accueil.getByRole('button', { name: 'C’est parti' }).click();
  await expect.poll(() => page.evaluate(() => window.__bruitages.sons)).toBeGreaterThan(0);
  expect(await page.evaluate(() => window.__bruitages.contextes)).toBe(1);
  expect(avertissements).toEqual([]);
  expect(plantages).toEqual([]);
});

test('coupés dans le profil, plus un bruit', async ({ page }) => {
  await ecouter(page);
  await poser(page, [BALI], '/voyages');
  await page.evaluate(() =>
    localStorage.setItem('tripora.theme', JSON.stringify({ state: { bruitagesPlumio: false }, version: 0 })),
  );
  await page.reload({ waitUntil: 'networkidle' });

  const accueil = page.getByRole('dialog', { name: 'Bonjour, moi c’est Plumio !' });
  await accueil.getByRole('button', { name: 'C’est parti' }).click();
  await expect(page.getByRole('group', { name: 'Visite guidée' })).toBeVisible();
  // Le temps de son demi-tour et du premier geste de la visite.
  await page.waitForTimeout(1500);
  expect(await page.evaluate(() => window.__bruitages.sons)).toBe(0);
});
