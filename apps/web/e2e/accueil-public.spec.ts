import { expect, test } from '@playwright/test';

/**
 * L'arrivée sur Tripora sans compte.
 *
 * On arrivait sur l'écran de connexion : rien à voir avant d'avoir donné un
 * compte. L'accueil se lit maintenant sans rien demander, et la connexion ne
 * vient qu'au moment d'agir — puis ramène là où l'on allait.
 */

test('l’accueil se lit sans compte, et « Créer un voyage » y revient après la connexion', async ({
  page,
}) => {
  const plantages: string[] = [];
  page.on('pageerror', (erreur) => plantages.push(erreur.message));

  await page.goto('/', { waitUntil: 'networkidle' });
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Le voyage entre amis, sans les quinze conversations.',
  );
  await expect(page.getByRole('heading', { name: 'Du « on part où ? » au départ' })).toBeVisible();
  await expect(page.getByRole('heading', { name: /^Où partir en / })).toBeVisible();

  await page.getByRole('link', { name: 'Créer un voyage' }).first().click();
  await expect(page).toHaveURL(/\/connexion$/);
  await page.getByRole('button', { name: /Découvrir en mode local/ }).click();
  // La connexion faite, on arrive sur la création, pas sur une liste vide.
  await expect(page).toHaveURL(/\/voyages\/nouveau$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Avec qui partez-vous ?');
  expect(plantages).toEqual([]);
});

test('le pied de page mène aux pages légales, lisibles sans compte', async ({ page }) => {
  await page.goto('/', { waitUntil: 'networkidle' });
  const pied = page.getByRole('contentinfo');

  await pied.getByRole('link', { name: 'Mentions légales' }).click();
  await expect(page).toHaveURL(/\/mentions-legales$/);
  await expect(page.getByRole('heading', { name: 'Mentions légales', level: 1 })).toBeVisible();
  await expect(page).toHaveTitle('Mentions légales — Tripora');

  await page.getByRole('contentinfo').getByRole('link', { name: 'Conditions d’utilisation' }).click();
  await expect(page.getByRole('heading', { name: 'Conditions d’utilisation', level: 1 })).toBeVisible();

  await page.getByRole('contentinfo').getByRole('link', { name: 'Confidentialité' }).click();
  await expect(page.getByRole('heading', { name: 'Confidentialité', level: 1 })).toBeVisible();

  await page.getByRole('contentinfo').getByRole('link', { name: 'Comment Tripora est financé' }).click();
  await expect(page.getByRole('heading', { name: 'Soutenir Tripora' })).toBeVisible();
});

test('une page qui demande un compte mène à la connexion, puis y revient', async ({ page }) => {
  await page.goto('/passeport', { waitUntil: 'networkidle' });
  await expect(page).toHaveURL(/\/connexion$/);
  await page.getByRole('button', { name: /Découvrir en mode local/ }).click();
  await expect(page).toHaveURL(/\/passeport$/);
});

test.describe('le guide de démarrage', () => {
  // Un navigateur qui n'a jamais vu Tripora : le guide n'y est pas encore vu.
  test.use({ storageState: { cookies: [], origins: [] } });

  test('se propose sans s’imposer sur l’accueil, et ne revient pas une fois fermé', async ({
    page,
  }) => {
    await page.goto('/', { waitUntil: 'networkidle' });
    // Pas de fenêtre par-dessus l'accueil : une carte, en bas.
    await expect(page.getByRole('dialog')).toHaveCount(0);
    const invitation = page.getByRole('complementary', { name: 'Guide de démarrage' });
    await expect(invitation).toBeVisible();

    await invitation.getByRole('button', { name: /Première visite/ }).click();
    const guide = page.getByRole('dialog');
    await expect(guide).toBeVisible();
    await expect(guide.getByText('1 sur 6')).toBeVisible();
    await guide.getByRole('button', { name: 'Suivant' }).click();
    await expect(guide.getByText('2 sur 6')).toBeVisible();
    await page.keyboard.press('ArrowRight');
    await expect(guide.getByText('3 sur 6')).toBeVisible();
    await guide.getByRole('button', { name: 'Passer' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);

    // Passé une fois, il ne se représente plus — même après la connexion.
    await page.goto('/connexion', { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: /Découvrir en mode local/ }).click();
    await expect(page.getByRole('heading', { name: 'Mes trips' })).toBeVisible();
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });

  test('s’ouvre de lui-même à la première connexion', async ({ page }) => {
    await page.goto('/connexion', { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: /Découvrir en mode local/ }).click();
    const guide = page.getByRole('dialog');
    await expect(guide).toBeVisible();
    for (let ecran = 1; ecran < 6; ecran += 1) {
      await guide.getByRole('button', { name: 'Suivant' }).click();
    }
    await guide.getByRole('button', { name: 'C’est parti' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);

    await page.reload({ waitUntil: 'networkidle' });
    await expect(page.getByRole('heading', { name: 'Mes trips' })).toBeVisible();
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });
});
