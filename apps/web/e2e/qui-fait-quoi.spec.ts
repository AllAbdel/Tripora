import { expect, test } from '@playwright/test';
import { BALI, poser } from './tripora';

/**
 * Qui fait quoi : la liste commune de ce qu'il reste à faire avant de partir.
 *
 * Chacun croyait la voiture réservée par un autre. Le mode local suffit à
 * vérifier le parcours : ajouter, s'attribuer, cocher, filtrer, retirer.
 */
test('ajouter, s’attribuer, cocher, filtrer', async ({ page }) => {
  await poser(page, [BALI], '/voyages/v1');
  await page.getByRole('link', { name: /Qui fait quoi/u }).first().click();
  await expect(page).toHaveURL(/\/voyages\/v1\/qui-fait-quoi$/u);

  // Une suggestion s'ajoute d'un geste, puis disparaît des suggestions.
  await page.getByRole('button', { name: 'Louer une voiture', exact: true }).click();
  await expect(page.getByRole('checkbox', { name: 'Louer une voiture' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Louer une voiture', exact: true })).toHaveCount(0);

  // Une tâche à soi, avec une échéance.
  await page.getByRole('textbox', { name: 'Nouvelle tâche' }).fill('Prendre l’assurance');
  await page.getByRole('combobox', { name: 'Qui s’en charge' }).selectOption({ label: 'Moi' });
  await page.getByLabel('Avant le').fill('2030-06-01');
  await page.getByRole('button', { name: 'Ajouter', exact: true }).click();
  await expect(page.getByText(/Pour vous · avant le 1er juin/u)).toBeVisible();

  // La voiture : personne encore — je m'en occupe.
  await page.getByRole('button', { name: 'Je m’en occupe' }).click();
  await expect(page.getByText('2 à faire · 2 pour vous')).toBeVisible();

  // Cochée : elle passe en bas, barrée, faite par moi.
  const voiture = page.getByRole('checkbox', { name: 'Louer une voiture' });
  await voiture.click();
  await expect(voiture).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByText('Fait par vous')).toBeVisible();
  await expect(page.getByText('1 à faire · 1 pour vous')).toBeVisible();

  await page.getByRole('button', { name: 'Retirer « Louer une voiture »' }).click();
  await expect(voiture).toHaveCount(0);
  await page.screenshot({ path: 'test-results/qui-fait-quoi.png', fullPage: true });
});
