import { expect, test, type Page } from '@playwright/test';
import { brouillon, poser, type VoyagePose } from './tripora';

/**
 * L'application en anglais, écran par écran, comme la verrait quelqu'un dont
 * le téléphone est réglé en anglais américain.
 *
 * Les tests unitaires vérifient les phrases une à une ; ils ne voient pas un
 * texte français qu'on vient d'ajouter à un écran sans sa traduction, ni une
 * phrase réécrite qui ne correspond plus à sa clé (la traduction disparaît
 * alors sans bruit). Ce test ouvre chaque écran principal avec la récolte des
 * traductions allumée — le même mécanisme que `traductions:recolte` — et
 * échoue si un texte resté en français s'affiche. Il vérifie aussi qu'aucun
 * écran ne déborde : l'anglais est plus court que le français, mais pas
 * toujours (« Settle on the destination first »).
 */

test.use({
  // La langue du téléphone, pas un réglage de Tripora : la détection compte aussi.
  locale: 'en-US',
  storageState: {
    cookies: [],
    origins: [
      {
        origin: 'http://localhost:4173',
        localStorage: [
          { name: 'tripora.guide-vu', value: '3' },
          { name: 'tripora.recolte-traductions', value: '1' },
        ],
      },
    ],
  },
});

const VOYAGES: readonly VoyagePose[] = [
  { id: 'v1', titre: 'Bali with friends', cree: '2026-09-08T10:00:00.000Z', draft: brouillon({ title: 'Bali with friends' }) },
  {
    id: 'v2',
    titre: 'October sun',
    cree: '2026-09-09T10:00:00.000Z',
    draft: brouillon({
      title: 'October sun',
      destinationMode: 'suggest',
      destinationIds: [],
      month: 10,
      durationDays: 5,
      budgetPerPersonCents: 60_000,
      weights: { food: 1, culture: 0.66, nightlife: 0.66, relax: 0.33 },
    }),
  },
];

const ECRANS = [
  '/voyages',
  '/voyages/nouveau',
  '/voyages/v1',
  '/voyages/v2',
  '/voyages/v1/itineraire',
  '/voyages/v1/decouvrir',
  '/voyages/v1/a-faire',
  '/voyages/v1/bilan',
  '/voyages/v1/budget',
  '/voyages/v1/reservations',
  '/voyages/v1/coffre',
  '/voyages/v1/journal',
  '/voyages/v1/valise',
  '/voyages/v1/qui-fait-quoi',
  '/voyages/v1/sondages',
  '/voyages/v1/participants',
  '/voyages/v1/carte',
  '/voyages/v1/recapitulatif',
  '/voyages/v1/modifier',
  '/profil',
  '/passeport',
  '/alertes',
  '/partager',
  '/soutenir',
  '/confidentialite',
  '/conditions',
  '/mentions-legales',
];

/**
 * Du français, à coup sûr : un mot outil qui n'existe pas en anglais. Les
 * accents seuls ne suffisent pas — « Inès », « Português » ou « Wrocław »
 * sont des noms, pas des phrases à traduire.
 */
const FRANCAIS = /(?:^|[\s'’(«])(?:le|la|les|des|une|est|sont|pour|vous|votre|vos|avec|dans|sur|pas|qui|que|du|au|aux|et|ou|à|ce|cette|leur|sans|très|plus|tout)(?=$|[\s,.;:!?»)])/iu;

async function francaisAffiche(page: Page): Promise<string[]> {
  // La traduction s'applique après le rendu, et certaines listes ne se
  // dessinent qu'une fois à l'écran : on laisse le temps, et on fait défiler.
  await page.waitForTimeout(600);
  await page.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += 600) {
      window.scrollTo(0, y);
      await new Promise((suite) => setTimeout(suite, 60));
    }
    window.scrollTo(0, 0);
  });
  await page.waitForTimeout(300);
  const manquantes = await page.evaluate(
    () => (window as unknown as { __phrasesManquantes?: () => [string, number][] }).__phrasesManquantes?.() ?? [],
  );
  return manquantes.map(([phrase]) => phrase).filter((phrase) => FRANCAIS.test(phrase));
}

for (const ecran of ECRANS) {
  test(`${ecran} s’affiche en anglais, sans déborder`, async ({ page }) => {
    await poser(page, VOYAGES, ecran);
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');

    expect(await francaisAffiche(page)).toEqual([]);

    const deborde = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(deborde, 'défilement horizontal').toBeLessThanOrEqual(1);
  });
}

test('un téléphone en anglais américain lit Tripora en anglais, en miles et en °F', async ({ page }) => {
  await poser(page, VOYAGES, '/profil');
  await expect(page.getByRole('heading', { name: 'Units and currency' })).toBeVisible();
  await expect(page.getByText(/^Automatic \(°F\)$/u).first()).toBeAttached();
  await page.goto('/passeport', { waitUntil: 'networkidle' });
  await expect(page.getByText('mi traveled', { exact: true })).toBeVisible();
});

test('un budget se lit et se tape en dollars, et se garde en euros', async ({ page }) => {
  await poser(page, VOYAGES, '/voyages/v1/modifier');
  // Les taux du jour, comme si l'appareil les avait déjà relevés (le test est hors ligne).
  await page.evaluate(() =>
    localStorage.setItem('tripora.taux-du-jour', JSON.stringify({ date: '2026-10-02', rates: { USD: 1.17 } })),
  );
  await page.reload({ waitUntil: 'networkidle' });

  // 1 800 € de budget par personne, lus en dollars.
  const champ = page.getByRole('textbox', { name: 'Maximum budget per person' });
  await expect(champ).toHaveValue('2106');
  await expect(page.getByText('$', { exact: true })).toBeVisible();
  await expect(page.getByText(/^Currently ≈ \$2,106\./u)).toBeVisible();
});

test('le carnet d’une autre destination arrive en anglais, juste après l’interface', async ({ page }) => {
  // Bali était traduit avec l'interface ; Lisbonne vient du carnet, chargé à part.
  const lisbonne: VoyagePose = {
    id: 'v3',
    titre: 'Lisbon long weekend',
    cree: '2026-09-10T10:00:00.000Z',
    draft: brouillon({ title: 'Lisbon long weekend', destinationIds: ['lisbonne'], durationDays: 4 }),
  };
  await poser(page, [lisbonne], '/voyages/v3/a-faire');
  await expect(page.getByText('The Jerónimos Monastery', { exact: true }).first()).toBeAttached();
  await expect(page.getByText('Le monastère des Hiéronymites', { exact: true })).toHaveCount(0);
  expect(await francaisAffiche(page)).toEqual([]);
});
