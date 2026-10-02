import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';
import { BALI, poser } from './tripora';

const fixture = (nom: string) => fileURLToPath(new URL(`./fixtures/${nom}`, import.meta.url));

/**
 * Le journal photo, de bout en bout, en mode local : ajouter des photos, les
 * légender, passer de l'une à l'autre, en retirer une. Les photos sont
 * redessinées dans le navigateur avant d'être rangées (orientation, poids,
 * métadonnées effacées).
 */
test('le journal : ajouter, légender, parcourir, retirer', async ({ page }) => {
  await poser(page, [BALI], '/voyages/v1/journal');
  await expect(page.getByRole('heading', { level: 1, name: 'Journal photo' })).toBeVisible();
  await expect(page.getByText(/Le journal est vide/u)).toBeVisible();

  await page.getByLabel('Choisir des photos').setInputFiles([fixture('photo-plage.jpg'), fixture('photo-temple.jpg')]);
  const vignettes = page.getByRole('button', { name: /^Photo de/u });
  await expect(vignettes).toHaveCount(2);
  // Rangées sous un jour, vignettes chargées.
  await expect(page.getByRole('heading', { level: 2 })).toHaveCount(1);
  await expect(page.locator('main img, ul img').first()).toHaveAttribute('src', /^blob:/u);

  // La première en grand, une légende, puis la suivante.
  await vignettes.first().click();
  const visionneuse = page.getByRole('dialog');
  await expect(visionneuse.getByRole('img')).toBeVisible();
  await visionneuse.getByRole('button', { name: 'Ajouter une légende' }).click();
  await visionneuse.getByRole('textbox', { name: 'Légende de la photo' }).fill('Plage de Balangan');
  await visionneuse.getByRole('button', { name: 'Enregistrer' }).click();
  await expect(visionneuse.getByText('Plage de Balangan')).toBeVisible();
  await expect(visionneuse.getByRole('button', { name: 'Photo précédente' })).toBeDisabled();
  await page.keyboard.press('ArrowRight');
  await expect(visionneuse.getByText('Sans légende')).toBeVisible();
  await expect(visionneuse.getByRole('button', { name: 'Photo suivante' })).toBeDisabled();

  // Retirer celle-ci, après confirmation.
  await visionneuse.getByRole('button', { name: 'Retirer la photo' }).click();
  await page.getByRole('button', { name: 'Retirer', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  // Reste la photo légendée, que sa légende nomme désormais.
  await expect(vignettes).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Plage de Balangan' })).toBeVisible();

  // L'accueil du voyage le compte.
  await page.goto('/voyages/v1', { waitUntil: 'networkidle' });
  await expect(page.getByRole('link', { name: /Journal photo.*1 photo/u })).toBeVisible();
});
