import { expect, test } from '@playwright/test';
import { brouillon, poser, type VoyagePose } from './tripora';

/**
 * Le visa se calcule d'après le passeport déclaré dans le profil, et non
 * plus seulement d'après le pays de départ : un Algérien qui part de Paris
 * n'a pas les droits d'un Français.
 */
const LONDRES: VoyagePose = {
  id: 'v1',
  titre: 'Londres',
  cree: '2026-02-08T10:00:00.000Z',
  draft: brouillon({ title: 'Londres', destinationIds: ['londres'], durationDays: 4 }),
};

test('le passeport déclaré décide du visa', async ({ page }) => {
  await poser(page, [LONDRES], '/voyages/v1');

  const ligne = page.getByText(/Pour un passeport du pays de départ/u);
  await expect(ligne).toBeVisible();
  await page.getByRole('link', { name: 'Indiquer mon passeport' }).click();
  await expect(page).toHaveURL(/\/profil#passeports$/u);

  await page.getByRole('combobox', { name: 'Pays de mon passeport' }).selectOption('DZ');
  await expect(page.getByRole('button', { name: 'Retirer le passeport Algérie' })).toBeVisible();

  await page.goto('/voyages/v1');
  await expect(page.getByText('Attention :')).toBeVisible();
  await expect(page.getByText(/Avec votre passeport \(Algérie\)/u)).toBeVisible();
});
