import { expect, test } from '@playwright/test';
import { BALI, poser } from './tripora';

/**
 * Les sondages du groupe : quelles dates, quel logement, où dîner.
 *
 * Tout ce que le vote sur la destination ne tranchait pas repartait dans la
 * messagerie. Le mode local fait voter « moi » seul, ce qui suffit à vérifier
 * le parcours entier : lancer, voter, déplacer son vote, clore.
 */

test('un sondage de dates : plusieurs choix, puis clos', async ({ page }) => {
  await poser(page, [BALI], '/voyages/v1');
  await page.getByRole('link', { name: /Sondages/u }).first().click();
  await expect(page).toHaveURL(/\/voyages\/v1\/sondages$/u);

  await page.getByRole('button', { name: 'Lancer un sondage' }).click();
  // Le modèle « Les dates » est proposé d'abord, à choix multiple.
  await expect(page.getByRole('textbox', { name: 'La question' })).toHaveValue('Quelles dates vous arrangent ?');

  // Une seule option : refusé, avec une phrase.
  await page.getByLabel('Option 1 : premier jour').fill('2026-10-09');
  await page.getByLabel('Option 1 : dernier jour').fill('2026-10-11');
  await page.getByRole('button', { name: 'Lancer le sondage' }).click();
  await expect(page.getByRole('alert')).toHaveText('Il faut au moins deux options.');

  await page.getByLabel('Option 2 : premier jour').fill('2026-10-16');
  await page.getByLabel('Option 2 : dernier jour').fill('2026-10-18');
  await page.getByRole('button', { name: 'Lancer le sondage' }).click();

  await expect(page.getByRole('heading', { name: 'Quelles dates vous arrangent ?' })).toBeVisible();
  const premier = page.getByRole('button', { name: /Du 9 au 11 octobre/u });
  const second = page.getByRole('button', { name: /Du 16 au 18 octobre/u });
  await premier.click();
  await second.click();
  // Plusieurs choix : les deux restent cochés.
  await expect(premier).toHaveAttribute('aria-pressed', 'true');
  await expect(second).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByText(/1 votant/u)).toBeVisible();

  await page.getByRole('button', { name: 'Clore le sondage' }).click();
  await expect(page.getByRole('heading', { name: 'Clos' })).toBeVisible();
  await expect(premier).toBeDisabled();
  await expect(page.getByText('Retenu').first()).toBeVisible();
});

test('un sondage de logement : les liens se nomment seuls, un seul choix', async ({ page }) => {
  await poser(page, [BALI], '/voyages/v1/sondages');
  await page.getByRole('button', { name: 'Lancer un sondage' }).click();
  await page.getByRole('button', { name: 'Le logement' }).click();
  await expect(page.getByRole('textbox', { name: 'La question' })).toHaveValue('Quel logement on prend ?');

  await page.getByLabel('Option 1 : lien').fill('https://www.airbnb.fr/rooms/123');
  await page.getByLabel('Option 2 : lien').fill('https://www.booking.com/hotel/id/villa.html');
  await page.getByRole('button', { name: 'Lancer le sondage' }).click();

  const airbnb = page.getByRole('button', { name: /Sur Airbnb/u });
  const booking = page.getByRole('button', { name: /Sur Booking\.com/u });
  await airbnb.click();
  await expect(airbnb).toHaveAttribute('aria-pressed', 'true');
  // Un seul choix : voter pour l'autre déplace le vote.
  await booking.click();
  await expect(booking).toHaveAttribute('aria-pressed', 'true');
  await expect(airbnb).toHaveAttribute('aria-pressed', 'false');
  await expect(page.getByRole('link', { name: /Ouvrir Sur Airbnb/u })).toHaveAttribute(
    'href',
    'https://www.airbnb.fr/rooms/123',
  );

  // Tout le monde peut proposer une option tant que c'est ouvert.
  await page.getByRole('button', { name: 'Proposer une option' }).click();
  await page.getByLabel('Nouvelle option : lien').fill('https://www.hostelworld.com/hosteldetails.php/x');
  await page.getByRole('button', { name: 'Proposer', exact: true }).click();
  await expect(page.getByRole('button', { name: /Sur Hostelworld/u })).toBeVisible();
  await page.screenshot({ path: 'test-results/sondages.png', fullPage: true });
});
