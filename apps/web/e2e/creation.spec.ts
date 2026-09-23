import { expect, test, type Page } from '@playwright/test';

/**
 * Créer un trip, du premier écran au dernier.
 *
 * C'est le parcours sans lequel rien d'autre n'existe, et le seul que
 * personne ne peut contourner. Six étapes, chacune avec sa condition : le
 * test les remplit comme une personne le ferait, et vérifie qu'on arrive au
 * bout — pas qu'un composant rend correctement.
 */

const suivant = (page: Page) =>
  page.getByRole('button', { name: /^(Continuer|Voir les|Créer|Terminer)/ }).first();

/** Le numéro d'étape affiché en haut, pour savoir où l'on en est. */
async function etape(page: Page): Promise<string> {
  return (await page.getByText(/Étape \d sur \d/).first().innerText()).trim();
}

test('on crée un voyage de bout en bout, et il apparaît sur l’accueil', async ({ page }) => {
  const plantages: string[] = [];
  page.on('pageerror', (erreur) => plantages.push(erreur.message));

  await page.goto('/', { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: /Découvrir en mode local/ }).click();
  await expect(page.getByRole('heading', { name: 'Mes trips' })).toBeVisible();

  await page.getByRole('link', { name: /Créer un trip|Créer/ }).first().click();
  await expect(page).toHaveURL(/\/voyages\/nouveau$/);

  // 1 — Avec qui
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Avec qui partez-vous ?');
  await suivant(page).click();

  // 2 — D'où : une ville de départ est obligatoire, faute de quoi aucun prix
  // de vol ne peut être relevé.
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('D’où partez-vous ?');
  await expect(suivant(page)).toBeDisabled();
  await page.getByRole('textbox').first().fill('Paris');
  await page.getByRole('radio').filter({ hasText: 'Paris' }).first().click();
  await expect(suivant(page)).toBeEnabled();
  await suivant(page).click();

  // 3 — Où : on laisse Tripora chercher.
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Où allez-vous ?');
  await suivant(page).click();

  // 4 — Quand : le mois suffit, c'est le choix le moins cher.
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Quand ?');
  await page.getByRole('radio').first().click();
  // Les mois sont des pastilles, pas des choix exclusifs : le nom exact évite
  // d'attraper « juillet » dans une phrase d'explication.
  await page.getByRole('button', { name: 'juillet', exact: true }).click();
  await expect(suivant(page)).toBeEnabled();
  await suivant(page).click();

  // 5 — Budget : « le moins cher possible » ne demande aucun montant.
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Quel budget ?');
  await page.getByRole('radio').filter({ hasText: /moins cher possible/ }).first().click();
  await expect(suivant(page)).toBeEnabled();
  await suivant(page).click();

  // 6 — Envies
  await expect(await etape(page)).toContain('6 sur 6');
  // Quatre paliers par envie, en groupe de boutons radio. Au moins un choix
  // est exigé : sans envie, le moteur n'a rien à optimiser.
  await expect(suivant(page)).toBeDisabled();
  await page.getByRole('radio', { name: 'Essentiel' }).first().click();
  await expect(suivant(page)).toBeEnabled();
  await suivant(page).click();

  // On arrive sur le voyage, et il existe vraiment.
  await expect(page).toHaveURL(/\/voyages\/[^/]+$/, { timeout: 15_000 });
  const enregistres = await page.evaluate(
    () => JSON.parse(localStorage.getItem('tripora.local-trips') ?? '[]') as unknown[],
  );
  expect(enregistres, 'le voyage doit avoir été écrit').toHaveLength(1);

  await page.getByRole('link', { name: /Trips/ }).first().click();
  await expect(page.getByRole('heading', { level: 2 })).toHaveCount(1);
  expect(plantages).toEqual([]);
});

test('l’assistant refuse d’avancer tant qu’il manque le départ', async ({ page }) => {
  // Un bouton qui avance sans rien retenir est pire qu'un bouton éteint :
  // on croit avoir répondu.
  await page.goto('/', { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: /Découvrir en mode local/ }).click();
  await page.getByRole('link', { name: /Créer un trip|Créer/ }).first().click();
  await suivant(page).click();

  await expect(page.getByRole('heading', { level: 1 })).toHaveText('D’où partez-vous ?');
  await expect(suivant(page)).toBeDisabled();
  await expect(page.getByText(/Choisissez une ville de départ/)).toBeVisible();
});

test.describe('la position de l’appareil', () => {
  // Villeurbanne, à deux pas de Lyon : la ville de départ connue la plus proche.
  test.use({ geolocation: { latitude: 45.771, longitude: 4.88 }, permissions: ['geolocation'] });

  test('choisit la ville de départ la plus proche', async ({ page }) => {
    // Ce test tourne sous les en-têtes de `public/_headers`, ceux du site en
    // ligne. Ils refusaient la géolocalisation à la page elle-même : le
    // bouton répondait « position refusée » même quand la personne l'avait
    // autorisée, et aucun test ne le voyait.
    await page.goto('/', { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: /Découvrir en mode local/ }).click();
    await page.getByRole('link', { name: /Créer un trip|Créer/ }).first().click();
    await suivant(page).click();

    await expect(page.getByRole('heading', { level: 1 })).toHaveText('D’où partez-vous ?');
    await page.getByRole('button', { name: 'Utiliser ma position' }).click();

    await expect(page.getByText(/Position refusée/)).toHaveCount(0);
    await expect(
      page.getByRole('radiogroup', { name: 'Ville de départ' }).getByText('Lyon', { exact: true }),
    ).toBeVisible();
    await expect(suivant(page)).toBeEnabled();
  });
});
