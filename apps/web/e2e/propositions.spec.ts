import { expect, test, type Page } from '@playwright/test';
import { poser, SURPRISE } from './tripora';

/**
 * Les propositions d'un voyage « Surprends-nous » : dix destinations, des
 * continents à choisir, et « D'autres idées » quand aucune ne plaît.
 *
 * De France, le groupe revoyait toujours Bruxelles, Prague, Budapest et
 * Berlin, sans moyen d'en demander d'autres.
 */

/** Les destinations proposées, dans l'ordre affiché. */
async function proposees(page: Page): Promise<string[]> {
  const cartes = page.locator('#root li h3.titre-lieu');
  await expect(cartes.first()).toBeVisible();
  return cartes.allTextContents();
}

test('dix propositions, des continents, et d’autres idées sans revoir les mêmes', async ({ page }) => {
  const plantages: string[] = [];
  page.on('pageerror', (erreur) => plantages.push(erreur.message));
  await poser(page, [SURPRISE], `/voyages/${SURPRISE.id}`);

  await expect(page.getByText('10 destinations pour votre groupe')).toBeVisible();
  const premieres = await proposees(page);
  expect(premieres).toHaveLength(10);

  // « D'autres idées » : personne n'a voté, les dix partent.
  await page.getByRole('button', { name: 'D’autres idées' }).click();
  await expect(page.getByRole('button', { name: 'Revoir les 10 destinations mises de côté' })).toBeVisible();
  const suivantes = await proposees(page);
  expect(suivantes).toHaveLength(10);
  expect(suivantes.filter((nom) => premieres.includes(nom))).toEqual([]);

  // Rien n'est perdu.
  await page.getByRole('button', { name: 'Revoir les 10 destinations mises de côté' }).click();
  await expect(page.getByRole('button', { name: /^Revoir les/u })).toHaveCount(0);
  expect(await proposees(page)).toEqual(premieres);

  // Où chercher : l'Asie seulement, et le choix tient au rechargement.
  const groupe = page.getByRole('group', { name: 'Où chercher' });
  await groupe.getByRole('button', { name: 'Asie' }).click();
  await expect(groupe.getByRole('button', { name: 'Asie' })).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(async () => (await proposees(page)).join()).not.toBe(premieres.join());
  const enAsie = await proposees(page);
  await page.reload({ waitUntil: 'networkidle' });
  await expect(page.getByRole('group', { name: 'Où chercher' }).getByRole('button', { name: 'Asie' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  expect(await proposees(page)).toEqual(enAsie);
  expect(plantages).toEqual([]);
});
