import { expect, test } from '@playwright/test';
import { brouillon, poser, type VoyagePose } from './tripora';

/**
 * Le voyage au présent, en haut de son accueil.
 *
 * Tout l'écran parlait de préparation — envies, vote, itinéraire — y compris
 * la veille du départ et pendant le séjour. Les dates sont calculées depuis
 * aujourd'hui, pour que le test ne vieillisse pas.
 */
function dansJours(jours: number): string {
  const date = new Date();
  date.setDate(date.getDate() + jours);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function voyageDaté(debut: number, fin: number): VoyagePose {
  return {
    id: 'v1',
    titre: 'Bali entre potes',
    cree: '2026-09-08T10:00:00.000Z',
    draft: brouillon({
      dateMode: 'exact',
      month: null,
      startDate: dansJours(debut),
      endDate: dansJours(fin),
      durationDays: fin - debut + 1,
    }),
  };
}

test('avant le départ : le compte à rebours et les nuits encore sans toit', async ({ page }) => {
  await poser(page, [voyageDaté(12, 19)], '/voyages/v1');
  await expect(page.getByRole('heading', { name: 'Départ dans 12 jours' })).toBeVisible();
  await expect(page.getByText(/7 nuits sans hébergement réservé/u)).toBeVisible();
  await page.getByRole('link', { name: /Ajouter un hébergement/u }).click();
  await expect(page).toHaveURL(/\/voyages\/v1\/reservations$/u);
});

test('pendant le séjour : le jour, et la dépense à noter d’un geste', async ({ page }) => {
  await poser(page, [voyageDaté(-2, 5)], '/voyages/v1');
  await expect(page.getByRole('heading', { name: 'Jour 3 sur 8' })).toBeVisible();
  await page.screenshot({ path: 'test-results/present-pendant.png', fullPage: false });

  await page.getByRole('link', { name: /Une dépense/u }).click();
  await expect(page).toHaveURL(/\/voyages\/v1\/budget\?ajouter=1$/u);
  // La saisie est ouverte : pas besoin de chercher le bouton.
  await expect(page.getByRole('button', { name: 'Ajouter une dépense' })).toHaveCount(0);
});

test('les infos pratiques de la destination : adaptateur, urgences, côté de la route', async ({ page }) => {
  await poser(page, [voyageDaté(30, 37)], '/voyages/v1');
  const carte = page.getByRole('heading', { name: /Infos pratiques · Indonésie/u });
  await expect(carte).toBeVisible();
  // De Paris à Bali, les prises C/F prennent les fiches françaises.
  await expect(page.getByText('Pas besoin d’adaptateur.')).toBeVisible();
  await expect(page.getByText('On roule à gauche.')).toBeVisible();
  await expect(page.getByRole('link', { name: '112' })).toHaveAttribute('href', 'tel:112');
  await carte.scrollIntoViewIfNeeded();
  await page.screenshot({ path: 'test-results/infos-pratiques.png' });
});
