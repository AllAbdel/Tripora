import { expect, test } from '@playwright/test';
import { BALI, poser } from './tripora';

/**
 * Deux mises en page, selon la taille de l'écran.
 *
 * Sur un ordinateur, Tripora affichait la colonne d'un téléphone au milieu de
 * l'écran, onglets en bas compris. La navigation passe désormais dans une
 * barre latérale à partir de 1 024 px ; en dessous, rien ne change.
 */

test.describe('sur un ordinateur', () => {
  test.use({ viewport: { width: 1440, height: 900 }, isMobile: false, hasTouch: false });

  test('la navigation est dans une barre latérale, avec les écrans du voyage ouvert', async ({ page }) => {
    await poser(page, [BALI], '/voyages/v1');

    // Une seule navigation principale visible : celle de la barre latérale.
    const principale = page.getByRole('navigation', { name: 'Navigation principale' });
    await expect(principale).toHaveCount(1);
    await expect(page.locator('aside').getByRole('navigation', { name: 'Navigation principale' })).toBeVisible();

    const ecrans = page.getByRole('navigation', { name: 'Écrans du voyage' });
    await expect(ecrans.getByText('Bali entre potes')).toBeVisible();
    await ecrans.getByRole('link', { name: 'Itinéraire' }).click();
    await expect(page).toHaveURL(/\/voyages\/v1\/itineraire$/);
    await expect(ecrans.getByRole('link', { name: 'Itinéraire' })).toHaveAttribute('aria-current', 'page');

    // Le contenu profite de la largeur : plus d'une colonne de téléphone.
    const largeur = await page.locator('main').evaluate((main) => main.getBoundingClientRect().width);
    expect(largeur).toBeGreaterThan(800);
  });

  test('hors d’un voyage, la barre latérale ne liste que la navigation principale', async ({ page }) => {
    await poser(page, [BALI], '/voyages');
    await expect(page.getByRole('navigation', { name: 'Écrans du voyage' })).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Nouveau trip' })).toBeVisible();
  });
});

test('sur un téléphone, les onglets restent en bas et la barre latérale n’existe pas', async ({ page }) => {
  await poser(page, [BALI], '/voyages/v1');
  await expect(page.locator('aside')).toBeHidden();
  await expect(page.getByRole('navigation', { name: 'Écrans du voyage' })).toHaveCount(0);

  const onglets = page.getByRole('navigation', { name: 'Navigation principale' });
  await expect(onglets).toHaveCount(1);
  const boite = await onglets.boundingBox();
  const hauteur = page.viewportSize()!.height;
  // Collée au bas de l'écran, là où le pouce arrive.
  expect(boite!.y + boite!.height).toBeGreaterThan(hauteur - 2);
});

test('pendant qu’on écrit, les onglets ne remontent pas sur le champ', async ({ page }) => {
  // Le clavier réduit la page de moitié, et la barre d'onglets, fixée en bas,
  // remontait avec lui jusque sur le champ qu'on remplissait.
  await poser(page, [BALI], '/voyages/v1/reservations');
  const onglets = page.getByRole('navigation', { name: 'Navigation principale' });
  await expect(onglets).toHaveCount(1);

  await page.getByRole('button', { name: /Ajouter une réservation/ }).first().click();
  const champ = page.getByRole('textbox').first();
  await champ.focus();
  await expect(onglets).toHaveCount(0);

  await champ.blur();
  await expect(onglets).toHaveCount(1);
});
