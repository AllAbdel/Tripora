import { expect, test } from '@playwright/test';
import { BALI, poser } from './tripora';

/**
 * Tous les écrans, ouverts un par un.
 *
 * Deux d'entre eux étaient des culs-de-sac — un message et rien d'autre, pas
 * de retour, pas de barre d'onglets — et un troisième s'ouvrait sur du blanc.
 * Un écran vide ne se voit dans aucun test unitaire : il faut le charger.
 */

const ECRANS = [
  '/voyages',
  '/voyages/v1',
  '/voyages/v1/participants',
  '/voyages/v1/carte',
  '/voyages/v1/itineraire',
  '/voyages/v1/discussion',
  '/voyages/v1/applications',
  '/voyages/v1/valise',
  '/voyages/v1/budget',
  '/voyages/v1/recapitulatif',
  '/voyages/v1/modifier',
  '/voyages/v1/mes-envies',
  '/carte',
  '/budget',
  '/profil',
  '/soutenir',
  '/confidentialite',
  '/rejoindre/ABCD2345',
  '/adresse-qui-nexiste-pas',
] as const;

for (const ecran of ECRANS) {
  test(`« ${ecran} » affiche quelque chose et laisse une porte de sortie`, async ({ page }) => {
    const plantages: string[] = [];
    page.on('pageerror', (erreur) => plantages.push(erreur.message));

    await poser(page, [BALI], ecran);
    await page.waitForLoadState('networkidle');

    const texte = (await page.locator('body').innerText()).trim();
    expect(texte.length, 'un écran blanc n’est jamais une réponse').toBeGreaterThan(0);
    expect(plantages).toEqual([]);

    // Une application installée en plein écran n'a pas de bouton « page
    // précédente ». Chaque écran doit donc offrir au moins un chemin :
    // la barre d'onglets, un lien de retour, ou un bouton.
    const sorties = await page.getByRole('link').count();
    expect(sorties, 'aucun écran ne doit être sans issue').toBeGreaterThan(0);

    // Un lecteur d'écran navigue de titre en titre. Trois écrans en mode
    // local n'en avaient aucun : leur version complète en affiche un, la
    // branche de repli l'avait perdu en chemin.
    const titres = await page.getByRole('heading', { level: 1 }).count();
    expect(titres, 'un écran a un titre, et un seul').toBe(1);
  });
}

test('aucun bouton, lien ou champ sans nom accessible', async ({ page }) => {
  // Les vingt-huit cases de la valise étaient annoncées « case à cocher, non
  // cochée » vingt-huit fois de suite, sans jamais dire de quoi.
  const anonymes: string[] = [];

  for (const ecran of ECRANS) {
    await poser(page, [BALI], ecran);
    await page.waitForLoadState('networkidle');
    const trouves = await page.evaluate(() => {
      const nom = (element: Element): string => {
        const etiquette =
          element.getAttribute('aria-label') ??
          element.getAttribute('title') ??
          (element.id
            ? document.querySelector(`label[for="${CSS.escape(element.id)}"]`)?.textContent
            : null) ??
          element.closest('label')?.textContent ??
          element.textContent ??
          '';
        return etiquette.trim();
      };
      const cibles = 'button, [role="button"], [role="checkbox"], [role="radio"], a[href], input, select, textarea';
      return [...document.querySelectorAll(cibles)]
        .filter((element) => {
          // Ce qui est masqué aux outils d'assistance n'a pas à être nommé :
          // un contrôle visible le pilote à sa place.
          if (element.closest('[aria-hidden="true"]')) return false;
          return !nom(element) && !element.getAttribute('aria-labelledby');
        })
        .map((element) => `${element.tagName.toLowerCase()}[${element.getAttribute('role') ?? '—'}]`);
    });
    for (const trouve of trouves) anonymes.push(`${ecran} → ${trouve}`);
  }

  expect(anonymes).toEqual([]);
});
