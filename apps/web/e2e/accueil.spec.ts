import { expect, test } from '@playwright/test';
import { attendreLeCache, BALI, LISBONNE, brouillon, glisser, poser } from './tripora';

/**
 * L'écran d'accueil, celui qui s'ouvre en premier et qui a le plus cassé.
 *
 * Chaque test ici correspond à un défaut réellement livré. Ce ne sont pas des
 * précautions : ce sont des choses qui sont arrivées.
 */

test('la deuxième ouverture affiche encore quelque chose', async ({ page }) => {
  // Le cache des requêtes est conservé en JSON d'une visite à l'autre. La
  // liste des favoris y partait sous forme d'ensemble et en revenait sous
  // forme d'objet vide : l'écran appelait `.has()` dessus, React s'arrêtait,
  // et il ne restait rien — pas un message, pas un bouton, du blanc.
  const plantages: string[] = [];
  page.on('pageerror', (erreur) => plantages.push(erreur.message));

  await poser(page, [BALI]);
  // Le rechargement ne prouve quelque chose qu'une fois le cache écrit : c'est
  // ce qu'on relit qui plantait, pas ce qu'on vient de calculer.
  await attendreLeCache(page, 'favoris');
  const garde = await page.evaluate(() => localStorage.getItem('tripora.cache') ?? '');
  expect(garde, 'le cache doit être là pour que la relecture ait un sens').toContain('favoris');

  await page.getByRole('link', { name: /Bali entre potes/ }).click();
  await expect(page).toHaveURL(/\/voyages\/v1$/);

  await page.goto('/voyages', { waitUntil: 'networkidle' });
  await expect(page.getByRole('heading', { name: 'Mes trips' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Bali entre potes' })).toBeVisible();
  expect(plantages, 'aucune erreur ne doit remonter jusqu’à la page').toEqual([]);
});

test('un voyage dont la destination est arrêtée le dit sur sa carte', async ({ page }) => {
  // La liste renvoyait `null` sans condition là où l'écran du voyage savait
  // retrouver la destination : le même voyage se présentait autrement selon
  // l'écran d'où on le regardait.
  await poser(page, [BALI]);
  const carte = page.locator('li').first();
  await expect(carte).toContainText('Bali');
  await expect(carte).toContainText('Destination choisie');
  await expect(carte).not.toContainText('Brouillon');
});

test('un titre un peu long reste lisible en entier', async ({ page }) => {
  // Entre les deux boutons d'action et l'étiquette de statut, il ne restait
  // que quatre-vingts pixels au nom du voyage : « Bali entre potes »
  // s'affichait « Bali e… ».
  await poser(page, [
    { ...BALI, titre: 'Bali entre potes', draft: brouillon({ title: 'Bali entre potes' }) },
  ]);
  const titre = page.getByRole('heading', { name: 'Bali entre potes' });
  await expect(titre).toBeVisible();
  const rendu = await titre.evaluate((noeud) => {
    const span = noeud.querySelector('span') ?? noeud;
    return { affiche: span.clientWidth, reel: span.scrollWidth };
  });
  // `scrollWidth` dépasse `clientWidth` quand le texte est coupé.
  expect(rendu.reel, 'le titre ne doit pas être tronqué').toBeLessThanOrEqual(rendu.affiche + 1);
});

test('appuyer sur une carte ouvre le voyage', async ({ page }) => {
  await poser(page, [BALI]);
  await page.locator('li').first().locator('a').first().click();
  await expect(page).toHaveURL(/\/voyages\/v1$/);
});

test('glisser vers la droite épingle, et remonte le voyage en tête', async ({ page }) => {
  await poser(page, [BALI, LISBONNE]);
  await expect(page.getByRole('heading', { level: 2 })).toHaveText([
    'Bali entre potes',
    'Week-end à Lisbonne',
  ]);

  await glisser(page, 1, 130);

  await expect(page.getByRole('heading', { level: 2 })).toHaveText([
    'Week-end à Lisbonne',
    'Bali entre potes',
  ]);
  // Le geste ne doit pas ouvrir le voyage au passage.
  await expect(page).toHaveURL(/\/voyages$/);
  expect(await page.evaluate(() => localStorage.getItem('tripora.favoris'))).toBe('["v2"]');
});

test('glisser vers la gauche demande confirmation, puis supprime', async ({ page }) => {
  // À la souris, ce geste ne faisait rien du tout : la carte est un lien, et
  // le navigateur lançait un glisser-déposer au bout de deux pixels, ce qui
  // annulait le pointeur.
  await poser(page, [BALI, LISBONNE]);
  await glisser(page, 0, -130);

  const dialogue = page.locator('dialog[open]');
  await expect(dialogue).toBeVisible();
  await expect(dialogue).toContainText('Bali entre potes');
  await expect(page, 'le geste ne doit pas ouvrir le voyage').toHaveURL(/\/voyages$/);

  await dialogue.getByRole('button', { name: /^Supprimer/ }).click();
  await expect(page.getByRole('heading', { level: 2 })).toHaveText(['Week-end à Lisbonne']);
  expect(
    await page.evaluate(() =>
      (JSON.parse(localStorage.getItem('tripora.local-trips') ?? '[]') as { id: string }[]).map(
        (v) => v.id,
      ),
    ),
  ).toEqual(['v2']);
});

test('un petit mouvement horizontal ne déclenche rien', async ({ page }) => {
  // Le seuil existe pour qu'un doigt qui ripe en faisant défiler la liste ne
  // supprime pas un voyage.
  await poser(page, [BALI]);
  await glisser(page, 0, -30);

  await expect(page.locator('dialog[open]')).toHaveCount(0);
  await expect(page).toHaveURL(/\/voyages$/);
  expect(await page.evaluate(() => localStorage.getItem('tripora.favoris'))).toBeNull();
});

test('le bouton fait ce que le geste fait', async ({ page }) => {
  // Le geste est plus rapide pour qui le connaît ; le bouton est le seul
  // chemin au clavier et au lecteur d'écran.
  await poser(page, [BALI]);
  await page.getByRole('button', { name: 'Épingler Bali entre potes' }).click();
  await expect(page.getByRole('button', { name: /Retirer Bali entre potes/ })).toBeVisible();

  await page.getByRole('button', { name: 'Supprimer Bali entre potes' }).click();
  await expect(page.locator('dialog[open]')).toBeVisible();
});
