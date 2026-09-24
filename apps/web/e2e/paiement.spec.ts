import { expect, test } from '@playwright/test';
import { BALI, poser } from './tripora';

/**
 * Comment je veux être remboursé, dans le profil.
 *
 * Le mode local n'a qu'une personne : pas de virement à faire, mais le
 * formulaire et ses garde-fous s'y vérifient entièrement.
 */
test('les moyens de paiement : une faute dans l’IBAN est attrapée, le reste est gardé', async ({ page }) => {
  await poser(page, [BALI], '/profil');

  await page.getByRole('textbox', { name: 'PayPal.me' }).fill('https://www.paypal.me/TomDupont');
  await page.getByRole('textbox', { name: 'IBAN' }).fill('FR76 3000 6000 0112 3456 7890 188');
  await page.getByRole('textbox', { name: 'Titulaire du compte' }).fill('Tom Dupont');
  await page.getByRole('button', { name: 'Enregistrer' }).click();
  await expect(page.getByRole('alert')).toHaveText(/faute de frappe/u);

  await page.getByRole('textbox', { name: 'IBAN' }).fill('FR76 3000 6000 0112 3456 7890 189');
  await page.getByRole('button', { name: 'Enregistrer' }).click();
  await expect(page.getByRole('button', { name: 'Enregistré' })).toBeVisible();

  // Relu après rechargement : l'identifiant nettoyé, l'IBAN par groupes de quatre.
  await page.reload({ waitUntil: 'networkidle' });
  await expect(page.getByRole('textbox', { name: 'PayPal.me' })).toHaveValue('TomDupont');
  await expect(page.getByRole('textbox', { name: 'IBAN' })).toHaveValue('FR76 3000 6000 0112 3456 7890 189');
});
