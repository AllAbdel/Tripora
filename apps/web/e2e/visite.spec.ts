import { expect, test, type Page } from '@playwright/test';
import { BALI, poser } from './tripora';

/**
 * Le guide de démarrage : l'accueil de Plumio, puis la visite qui montre
 * comment créer un voyage.
 *
 * Il n'y a pas de bouton « Suivant » : on avance en appuyant sur les vrais
 * boutons et en remplissant les vrais champs, et la visite s'arrête sur
 * « Créer le voyage » sans rien créer. Ces tests partent d'un navigateur qui
 * ne l'a jamais vue (la configuration commune la dit vue, pour ne gêner
 * personne).
 */
test.use({ storageState: { cookies: [], origins: [] } });

const bulle = (page: Page) => page.getByRole('group', { name: 'Visite guidée' });

/** La consigne de la bulle : elle seule dit où l'on en est. */
async function consigne(page: Page, texte: string) {
  await expect(bulle(page).getByText(texte, { exact: true })).toBeVisible();
}

test('Plumio accueille, puis montre comment créer un voyage, pas à pas, sans le créer', async ({ page }) => {
  const plantages: string[] = [];
  page.on('pageerror', (erreur) => plantages.push(erreur.message));
  await poser(page, [BALI], '/voyages');

  // L'accueil, en grand, s'ouvre de lui-même.
  const accueil = page.getByRole('dialog', { name: 'Bonjour, moi c’est Plumio !' });
  await expect(accueil).toBeVisible();
  await expect(accueil.getByRole('button', { name: 'C’est parti' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(accueil).toHaveCount(0);

  // 1 — Le vrai bouton « Nouveau » ; pas de « Suivant » dans la bulle.
  await consigne(page, 'Tout commence ici : appuyez sur « Nouveau ».');
  await expect(bulle(page).getByRole('button', { name: /Suivant/ })).toHaveCount(0);
  await page.getByRole('button', { name: 'Nouveau' }).click();
  await expect(page).toHaveURL(/\/voyages\/nouveau$/u);

  // 2 — « Avec qui ? » attend un vrai choix, même si la réponse par défaut vaut déjà.
  await consigne(page, 'Avec qui partez-vous ? Choisissez une réponse.');
  await page.getByRole('radio').filter({ hasText: 'Entre amis' }).click();
  await consigne(page, 'Parfait. Appuyez sur « Continuer ».');
  await page.getByRole('button', { name: /^Continuer/ }).click();

  // 3 — La ville de départ, au bec : la consigne suit la saisie.
  await consigne(page, 'Tapez votre ville, puis choisissez-la dans la liste.');
  await page.getByRole('textbox', { name: 'Chercher une ville de départ' }).fill('Paris');
  await consigne(page, 'Choisissez votre ville dans la liste.');
  await page.getByRole('radio').filter({ hasText: 'Paris' }).first().click();
  await consigne(page, 'Appuyez sur « Continuer ».');
  await page.getByRole('button', { name: /^Continuer/ }).click();

  // 4 — Où : « Surprends-nous » suffit.
  await consigne(page, 'Vous avez une idée ? Sinon, « Surprends-nous » : Tripora proposera des destinations au groupe.');
  await page.getByRole('radio').filter({ hasText: 'Surprends-nous' }).click();
  await page.getByRole('button', { name: /^Continuer/ }).click();

  // 5 — Quand : la façon, puis le mois.
  await consigne(page, 'Choisissez une façon de dire quand. Plus c’est souple, moins ça coûte.');
  await page.getByRole('radio').filter({ hasText: 'Un mois' }).click();
  await consigne(page, 'Choisissez le mois du départ.');
  await page.getByRole('button', { name: 'juillet', exact: true }).click();
  await page.getByRole('button', { name: /^Continuer/ }).click();

  // 6 — Le budget, au bec.
  await consigne(page, 'Combien par personne, tout compris ?');
  await page.getByRole('textbox', { name: 'Budget par personne' }).fill('400');
  await page.getByRole('button', { name: /^Continuer/ }).click();

  // 7 — Une envie.
  await consigne(page, 'Choisissez au moins une envie.');
  await page.getByRole('radio', { name: 'Essentiel' }).first().click();

  // 8 — La fin : le bouton est montré, pas pressé.
  await consigne(
    page,
    'C’est tout ! Ce bouton crée le voyage ; ensuite, vous inviterez le groupe. Rien n’est créé tant que vous n’appuyez pas dessus.',
  );
  await expect(bulle(page).getByRole('button', { name: 'Terminer la visite' })).toBeFocused();
  await bulle(page).getByRole('button', { name: 'Terminer la visite' }).click();
  await expect(bulle(page)).toHaveCount(0);

  // Rien n'a été créé ; ce qui est saisi reste là.
  await expect(page).toHaveURL(/\/voyages\/nouveau$/u);
  await expect(page.getByRole('button', { name: /Créer le voyage/ })).toBeEnabled();
  const voyages = await page.evaluate(() => JSON.parse(localStorage.getItem('tripora.local-trips') ?? '[]') as unknown[]);
  expect(voyages).toHaveLength(1);

  // Vue une fois, elle ne revient plus.
  await page.goto('/voyages', { waitUntil: 'networkidle' });
  await expect(page.getByRole('heading', { name: 'Mes trips' })).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(bulle(page)).toHaveCount(0);
  expect(plantages).toEqual([]);
});

test('hors du chemin, la visite se replie, et reprend où elle en était', async ({ page }) => {
  await poser(page, [BALI], '/voyages');
  await page.getByRole('dialog').getByRole('button', { name: 'C’est parti' }).click();
  await consigne(page, 'Tout commence ici : appuyez sur « Nouveau ».');

  // La personne ouvre son voyage plutôt : Plumio attend dans un coin.
  await page.getByRole('link', { name: /Bali/ }).first().click();
  await expect(page).toHaveURL(/\/voyages\/v1$/u);
  const reprendre = page.getByRole('button', { name: 'Reprendre la visite' });
  await expect(reprendre).toBeVisible();
  await expect(bulle(page)).toHaveCount(0);

  await reprendre.click();
  await expect(page).toHaveURL(/\/voyages$/u);
  await consigne(page, 'Tout commence ici : appuyez sur « Nouveau ».');

  // Échap la termine, à toute étape.
  await page.keyboard.press('Escape');
  await expect(bulle(page)).toHaveCount(0);
  await expect(reprendre).toHaveCount(0);
});

test('« Passer » sur l’accueil : Plumio s’en va, et le guide ne revient plus', async ({ page }) => {
  await poser(page, [BALI], '/voyages');
  await page.getByRole('dialog').getByRole('button', { name: 'Passer' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.reload({ waitUntil: 'networkidle' });
  await expect(page.getByRole('heading', { name: 'Mes trips' })).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);
});
