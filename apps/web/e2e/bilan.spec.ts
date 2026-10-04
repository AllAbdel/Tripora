import { expect, test } from '@playwright/test';
import { brouillon, poser, type VoyagePose } from './tripora';

/**
 * Le bilan d'un voyage fini : les chiffres qu'on raconte en rentrant, et
 * l'image qu'on poste.
 */

/** Une date comptée depuis aujourd'hui, à l'heure de Bali (voir present.spec). */
function ilYA(jours: number): string {
  const aujourdhui = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Makassar',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
  const date = new Date(`${aujourdhui}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - jours);
  return date.toISOString().slice(0, 10);
}

const RENTRE: VoyagePose = {
  id: 'v1',
  titre: 'Bali entre potes',
  cree: '2026-09-08T10:00:00.000Z',
  draft: brouillon({ dateMode: 'exact', month: null, startDate: ilYA(10), endDate: ilYA(3), durationDays: 8 }),
};

function depense(id: string, categorie: string, euros: number) {
  const cents = euros * 100;
  return {
    id,
    paidBy: 'moi',
    amountCents: cents,
    shares: [{ userId: 'moi', shareCents: cents }],
    label: id,
    category: categorie,
    spentOn: ilYA(5),
    currency: 'EUR',
    originalCents: cents,
  };
}

test('rentré, le voyage a son bilan et son image à partager', async ({ page }) => {
  await poser(page, [RENTRE], '/voyages');
  // Quatre voyageurs, 1 200 € notés : 600 d'hébergement, 400 de repas, 200 d'activités.
  await page.evaluate(
    (depenses) => localStorage.setItem('tripora.local-expenses', JSON.stringify({ v1: depenses })),
    [depense('villa', 'accommodation', 600), depense('warung', 'food', 400), depense('rafting', 'activities', 200)],
  );
  await page.goto('/voyages/v1', { waitUntil: 'networkidle' });

  // Le séjour est fini : le bilan passe en tête de la grille.
  await page.getByRole('link', { name: /Bilan.*Le voyage en chiffres/u }).click();
  await expect(page).toHaveURL(/\/voyages\/v1\/bilan$/u);
  await expect(page.getByRole('heading', { name: 'Bilan du voyage' })).toBeVisible();

  const recit = page.getByRole('list', { name: 'Le voyage en quelques mots' });
  await expect(recit.getByText('8 jours, 7 nuits')).toBeVisible();
  // Paris–Bali, aller-retour : plus de la moitié du tour de la Terre.
  await expect(recit.getByText(/km aller-retour, \d+ % du tour de la Terre/u)).toBeVisible();
  await expect(recit.getByText(/300\s€ par personne/u)).toBeVisible();
  await expect(recit.getByText('Premier poste : hébergement (50 %)')).toBeVisible();

  // L'image se dessine, au format des stories, et se partage ou s'enregistre.
  const image = page.getByRole('img', { name: 'Le bilan du voyage à Bali, en image' });
  await expect(image).toHaveAttribute('src', /^blob:/u);
  const dimensions = await image.evaluate((element: HTMLImageElement) => [element.naturalWidth, element.naturalHeight]);
  expect(dimensions).toEqual([1080, 1920]);
  await expect(page.getByRole('button', { name: 'Partager' })).toBeEnabled();
  const [telechargement] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Enregistrer' }).click(),
  ]);
  expect(telechargement.suggestedFilename()).toBe('tripora-bali.png');
  await telechargement.saveAs('test-results/bilan-image.png');
  await page.screenshot({ path: 'test-results/bilan.png', fullPage: true });
});
