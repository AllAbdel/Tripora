import { expect, test } from '@playwright/test';
import { brouillon, poser, type VoyagePose } from './tripora';

/**
 * Le passeport du voyageur : ce qu'on a vécu avec Tripora, compté.
 *
 * Un voyage n'y entre que daté et commencé : un séjour « en juillet » ne
 * prouve pas qu'on soit parti.
 */
function ilYA(jours: number): string {
  const date = new Date();
  date.setDate(date.getDate() - jours);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

const BALI_FAIT: VoyagePose = {
  id: 'v1',
  titre: 'Bali entre potes',
  cree: '2026-01-08T10:00:00.000Z',
  draft: brouillon({ dateMode: 'exact', month: null, startDate: ilYA(40), endDate: ilYA(29), durationDays: 12 }),
};

const LISBONNE_REVEE: VoyagePose = {
  id: 'v2',
  titre: 'Lisbonne un jour',
  cree: '2026-02-08T10:00:00.000Z',
  // Sans dates exactes : il ne compte pas.
  draft: brouillon({ title: 'Lisbonne un jour', destinationIds: ['lisbonne'], durationDays: 3 }),
};

test('le passeport compte le voyage vécu, pas celui qu’on rêve', async ({ page }) => {
  await poser(page, [BALI_FAIT, LISBONNE_REVEE], '/profil');

  await page.getByRole('link', { name: /Mon passeport/u }).click();
  await expect(page).toHaveURL(/\/passeport$/u);
  await expect(page.getByRole('heading', { name: 'Mon passeport' })).toBeVisible();

  await expect(page.getByText('Explorateur', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: /1 pays · Asie/u })).toBeVisible();
  await expect(page.getByText('Indonésie')).toBeVisible();
  await expect(page.getByText('Portugal')).toHaveCount(0);
  // Douze jours sur la route, et plus de 20 000 km d'aller-retour depuis Paris.
  await expect(page.getByText('12', { exact: true })).toBeVisible();
  await expect(page.getByText(/Premier départ — obtenu/u)).toBeAttached();
  await expect(page.getByText(/Long-courrier — obtenu/u)).toBeAttached();
  await expect(page.getByText(/Cinq pays — à gagner/u)).toBeAttached();
  // Sur la carte : l'Indonésie s'allume, le Portugal rêvé non.
  const carte = page.getByRole('img', { name: 'Carte du monde : 1 pays visité — Indonésie.' });
  await expect(carte).toBeVisible();
  await carte.screenshot({ path: 'test-results/carte-du-monde.png' });
  await page.screenshot({ path: 'test-results/passeport.png', fullPage: true });
});

test('vierge, il dit comment le remplir', async ({ page }) => {
  await poser(page, [LISBONNE_REVEE], '/passeport');
  await expect(page.getByText('Votre passeport est encore vierge')).toBeVisible();
  await expect(page.getByText('Voyageur en herbe', { exact: true })).toBeVisible();
});
