import { expect, test, type Page } from '@playwright/test';
import { BALI, poser } from './tripora';

/**
 * La visite guidée : le guide de démarrage joué sur les vraies pages.
 *
 * Elle mène d'écran en écran, met chaque fois un élément en lumière et
 * l'explique dans une bulle. Ces tests partent d'un navigateur qui ne l'a
 * jamais vue (la configuration commune la dit vue, pour ne gêner personne).
 */
test.use({ storageState: { cookies: [], origins: [] } });

/** La bulle de l'arrêt en cours, nommée par son titre. */
function bulle(page: Page, titre: string) {
  return page.getByRole('dialog', { name: 'Visite guidée' }).getByRole('group', { name: titre });
}

test('fait le tour d’un voyage, écran par écran, puis ne revient plus', async ({ page }) => {
  await poser(page, [BALI], '/voyages');

  // Elle s'ouvre d'elle-même, sur le bouton « Nouveau » de la liste.
  const nouveau = bulle(page, 'Créez un voyage');
  await expect(nouveau).toBeVisible();
  await expect(nouveau.getByText('Étape 1 sur 6')).toBeVisible();
  // Le clavier est déjà sur « Suivant » : Entrée avance.
  await expect(nouveau.getByRole('button', { name: 'Suivant' })).toBeFocused();
  await page.keyboard.press('Enter');

  // Bali a sa destination : la visite s'y joue, Découvrir et l'itinéraire compris.
  await expect(page).toHaveURL(/\/voyages\/v1$/u);
  const geste = bulle(page, 'Toujours le prochain geste');
  await expect(geste.getByText('Étape 2 sur 6')).toBeVisible();

  // On peut revenir en arrière…
  await geste.getByRole('button', { name: 'Étape précédente' }).click();
  await expect(page).toHaveURL(/\/voyages$/u);
  await expect(bulle(page, 'Créez un voyage')).toBeVisible();
  // … et avancer aux flèches.
  await page.keyboard.press('ArrowRight');
  await expect(bulle(page, 'Toujours le prochain geste')).toBeVisible();

  const suite: readonly [RegExp, string][] = [
    [/\/voyages\/v1\/decouvrir$/u, 'Les activités, d’un glissement'],
    [/\/voyages\/v1\/itineraire$/u, 'Le programme se compose tout seul'],
    [/\/voyages\/v1\/coffre$/u, 'Tout sous la main, même sans réseau'],
    [/\/voyages\/v1\/budget$/u, 'Qui doit quoi, sans calculatrice'],
  ];
  let precedente = bulle(page, 'Toujours le prochain geste');
  for (const [adresse, titre] of suite) {
    await precedente.getByRole('button', { name: 'Suivant' }).click();
    await expect(page).toHaveURL(adresse);
    precedente = bulle(page, titre);
    await expect(precedente).toBeVisible();
  }

  // Le dernier arrêt montre le vrai bouton, encore là sous le voile.
  await expect(page.locator('[data-guide="ajouter-depense"]')).toBeVisible();
  await precedente.getByRole('button', { name: 'Terminer' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  // On reste où la visite a fini, et la page répond de nouveau.
  await expect(page).toHaveURL(/\/voyages\/v1\/budget$/u);
  await page.getByRole('button', { name: 'Ajouter une dépense' }).click();

  await page.goto('/voyages', { waitUntil: 'networkidle' });
  await expect(page.getByRole('heading', { name: 'Mes trips' })).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('sans voyage, elle attend le premier, puis reprend dedans', async ({ page }) => {
  await page.goto('/connexion', { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: /Découvrir en mode local/ }).click();

  const premier = bulle(page, 'Créez votre premier voyage');
  await expect(premier).toBeVisible();
  // Une seule étape : pas de compteur « 1 sur 1 ».
  await expect(premier.getByText(/sur 1$/u)).toHaveCount(0);
  await premier.getByRole('button', { name: 'Créer mon voyage' }).click();
  await expect(page).toHaveURL(/\/voyages\/nouveau$/u);
  await expect(page.getByRole('dialog')).toHaveCount(0);

  // Le voyage créé (l'assistant a son propre test), on y arrive : la visite
  // reprend dedans, sans repasser par « Nouveau », qu'on vient justement de faire.
  await poser(page, [BALI], '/voyages/v1');
  const geste = bulle(page, 'Toujours le prochain geste');
  await expect(geste).toBeVisible();
  await expect(geste.getByText('Étape 1 sur 5')).toBeVisible();

  // Échap la ferme, pour de bon.
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.reload({ waitUntil: 'networkidle' });
  await expect(page.getByRole('heading', { name: 'Bali entre potes' })).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('se rejoue depuis le profil, et s’arrête si l’on part ailleurs', async ({ page }) => {
  await poser(page, [BALI], '/voyages');
  await bulle(page, 'Créez un voyage').getByRole('button', { name: 'Passer' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);

  await page.goto('/profil', { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: /Revoir le guide/u }).click();
  await expect(bulle(page, 'Créez un voyage')).toBeVisible();
  await bulle(page, 'Créez un voyage').getByRole('button', { name: 'Suivant' }).click();
  await expect(page).toHaveURL(/\/voyages\/v1$/u);
  await expect(bulle(page, 'Toujours le prochain geste')).toBeVisible();

  // Le bouton retour du téléphone : la personne a choisi d'aller ailleurs.
  await page.goBack();
  await expect(page).toHaveURL(/\/voyages$/u);
  await expect(page.getByRole('dialog')).toHaveCount(0);
});
