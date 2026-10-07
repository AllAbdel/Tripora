import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { BALI, poser } from './tripora';

/**
 * Accessibilité : axe passe sur les écrans principaux, en clair et en sombre.
 *
 * On ne retient que les manquements graves et critiques (WCAG 2.1 A et AA) :
 * ceux qui empêchent vraiment quelqu'un de se servir de l'écran — un bouton
 * sans nom, un contraste illisible, un champ sans étiquette. Le reste relève
 * de la revue, pas d'un test qui bloque.
 */

async function manquements(page: Page) {
  const resultat = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    // La carte est un canevas WebGL : ses repères sont doublés par une liste.
    .exclude('.maplibregl-canvas')
    // Le texte de pure décoration (WCAG 1.4.3, exception) : les grands noms en
    // fond des couvertures, les lignes qui s'effacent du tableau des départs.
    // Tous sont masqués aux lecteurs d'écran et répètent un texte lisible ailleurs.
    .exclude('[data-decor]')
    .analyze();
  return resultat.violations
    .filter((violation) => violation.impact === 'serious' || violation.impact === 'critical')
    .map((violation) => ({
      regle: violation.id,
      aide: violation.help,
      cibles: violation.nodes.slice(0, 5).map((noeud) => noeud.target.join(' ')),
    }));
}

const ECRANS = [
  '/voyages',
  '/voyages/nouveau',
  '/voyages/v1',
  '/voyages/v1/carte',
  '/voyages/v1/itineraire',
  '/voyages/v1/journal',
  '/voyages/v1/budget',
  '/voyages/v1/reservations',
  '/voyages/v1/coffre',
  '/partager',
  '/alertes',
  '/profil',
];

for (const theme of ['clair', 'sombre'] as const) {
  test.describe(`thème ${theme}`, () => {
    test.use({ colorScheme: theme === 'sombre' ? 'dark' : 'light' });

    for (const publique of ['/', '/connexion', '/confidentialite']) {
      test(`page publique ${publique}`, async ({ page }) => {
        await page.goto(publique, { waitUntil: 'networkidle' });
        expect(await manquements(page)).toEqual([]);
      });
    }

    for (const ecran of ECRANS) {
      test(ecran, async ({ page }) => {
        await poser(page, [BALI], ecran);
        await page.waitForLoadState('networkidle');
        expect(await manquements(page)).toEqual([]);
      });
    }

    test('la visite guidée', async ({ page }) => {
      await poser(page, [BALI], '/voyages');
      // Jamais vue : elle s'ouvre d'elle-même, sur la liste des voyages.
      await page.evaluate(() => localStorage.removeItem('tripora.guide-vu'));
      await page.reload({ waitUntil: 'networkidle' });
      await expect(page.getByRole('group', { name: 'Créez un voyage' })).toBeVisible();
      expect(await manquements(page)).toEqual([]);
    });
  });
}

test('« Aller au contenu » est le premier arrêt du clavier, et y mène', async ({ page }) => {
  await poser(page, [BALI], '/voyages/v1');
  await page.keyboard.press('Tab');
  const lien = page.getByRole('link', { name: 'Aller au contenu' });
  await expect(lien).toBeFocused();
  await expect(lien).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(page.locator('main')).toBeFocused();
});
