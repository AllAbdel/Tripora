import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';
import { BALI, poser } from './tripora';

/**
 * Scanner un ticket de caisse : la vraie reconnaissance de caractères, dans
 * le navigateur, sous la CSP de production et sans Internet — le moteur et le
 * modèle français viennent de Tripora, la photo ne part nulle part.
 */
test('un ticket photographié remplit la dépense, lu sur l’appareil', async ({ page }) => {
  test.setTimeout(120_000);
  // La date lue n'est retenue que si elle est plausible : on fixe « aujourd'hui ».
  await page.clock.setFixedTime(new Date('2026-10-02T12:00:00'));
  await poser(page, [BALI], '/voyages/v1/budget?ajouter=1');

  await page
    .getByLabel('Image du ticket')
    .setInputFiles(fileURLToPath(new URL('./fixtures/ticket-brasserie.png', import.meta.url)));

  await expect(page.getByText(/Total lu/u)).toBeVisible({ timeout: 90_000 });
  await expect(page.getByRole('textbox', { name: 'Intitulé de la dépense' })).toHaveValue('Chez Marcel');
  await expect(page.getByLabel('Montant')).toHaveValue('53,50');
  await expect(page.getByLabel('Date de la dépense')).toHaveValue('2026-09-28');
  await expect(page.getByRole('button', { name: /Nourriture/u })).toHaveAttribute('aria-pressed', 'true');
});
