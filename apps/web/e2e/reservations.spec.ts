import { expect, test } from '@playwright/test';
import { BALI, brouillon, poser } from './tripora';

/**
 * Les réservations : coller l'e-mail, vérifier, enregistrer — et les
 * retrouver à la bonne date dans l'itinéraire.
 */

const EMAIL_BOOKING = `Booking.com
Merci, votre réservation à Ubud Tropical Villas est confirmée.

Numéro de confirmation : 4521.873.219

Arrivée
ven. 10 juil. 2026
à partir de 14:00

Départ
lun. 13 juil. 2026
jusqu'à 12:00

Adresse : Jalan Raya Sanggingan 12, Ubud, 80571, Indonésie
Annulation gratuite jusqu'au 8 juillet 2026

Montant total
€ 612,40

Gérer votre réservation : https://secure.booking.com/myreservations.html?bn=4521873219`;

const DATE = { ...BALI, draft: brouillon({ dateMode: 'exact', startDate: '2026-07-10', endDate: '2026-07-16' }) };

test('un e-mail de confirmation collé remplit la fiche, et l’hôtel se range dans le programme', async ({ page }) => {
  await poser(page, [DATE], '/voyages/v1/reservations');

  await expect(page.getByText('Rien de réservé pour l’instant')).toBeVisible();
  await page.getByRole('button', { name: 'Ajouter une réservation' }).click();

  await page.getByLabel('Collez l’e-mail de confirmation').fill(EMAIL_BOOKING);
  await page.getByRole('button', { name: 'Remplir depuis l’e-mail' }).click();
  await expect(page.getByText(/Rempli depuis le texte de l’e-mail/)).toBeVisible();

  // La fiche arrive préremplie : on vérifie, puis on enregistre.
  await expect(page.getByLabel('Nom', { exact: true })).toHaveValue('Ubud Tropical Villas');
  await expect(page.getByLabel('Arrivée', { exact: true })).toHaveValue('2026-07-10');
  await expect(page.getByLabel('Départ', { exact: true })).toHaveValue('2026-07-13');
  await expect(page.getByLabel('Numéro de confirmation')).toHaveValue('4521.873.219');
  await expect(page.getByLabel('Réservé sur')).toHaveValue('booking');
  await page.getByRole('button', { name: 'Enregistrer' }).click();

  const carte = page.getByRole('heading', { level: 3, name: 'Ubud Tropical Villas' });
  await expect(carte).toBeVisible();
  await expect(page.getByText(/Booking\.com · arrivée 14 h → départ .* 12 h · 3 nuits/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Copier la référence 4521.873.219' })).toBeVisible();
  await expect(page.getByRole('link', { name: /Gérer la réservation/ })).toHaveAttribute(
    'href',
    'https://secure.booking.com/myreservations.html?bn=4521873219',
  );

  // Dans l'itinéraire : l'arrivée le premier jour, une nuit le deuxième.
  await page.goto('/voyages/v1/itineraire');
  await page.getByRole('button', { name: /Générer l’itinéraire/ }).click();
  await expect(page.getByText('Arrivée à Ubud Tropical Villas, 14 h')).toBeVisible();
  await page.locator('nav button', { hasText: /^Jour 2$/ }).click();
  await expect(page.getByText('Nuit à Ubud Tropical Villas')).toBeVisible();
});

test('une fiche incomplète ne s’enregistre pas, et dit ce qui manque', async ({ page }) => {
  await poser(page, [DATE], '/voyages/v1/reservations');
  await page.getByRole('button', { name: 'Ajouter une réservation' }).click();
  await page.getByRole('button', { name: 'Enregistrer' }).click();
  await expect(page.getByText('Donnez un nom à cette réservation.')).toBeVisible();

  await page.getByLabel('Nom', { exact: true }).fill('Cours de cuisine');
  await page.getByLabel('Arrivée', { exact: true }).fill('2026-07-12');
  await page.getByLabel('Lien pour gérer la réservation').fill('http://pas-sur.example');
  await page.getByRole('button', { name: 'Enregistrer' }).click();
  await expect(page.getByText('Le lien doit commencer par https://')).toBeVisible();
  await expect(page.getByRole('heading', { level: 3 })).toHaveCount(0);
});
