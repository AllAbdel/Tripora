import { expect, test } from '@playwright/test';

/**
 * L'accueil tel que le lisent les moteurs de recherche.
 *
 * Googlebot rend les pages avec un navigateur réglé en « en-US ». L'accueil
 * suivant la langue du navigateur, il était indexé en anglais, puis proposé
 * ainsi à des Français. Les robots lisent maintenant le français ; la version
 * anglaise a sa propre adresse, `/?langue=en`, annoncée dans le plan du site.
 */

const GOOGLEBOT =
  'Mozilla/5.0 (Linux; Android 6.0.1; Nexus 5X Build/MMB29P) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.7390.122 Mobile Safari/537.36 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)';

const TITRE_FR = 'Le voyage entre amis, sans les quinze conversations.';

test.describe('un robot réglé en anglais américain', () => {
  test.use({ locale: 'en-US', userAgent: GOOGLEBOT });

  test('lit l’accueil en français, et l’anglais à son adresse', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });
    await expect(page.locator('html')).toHaveAttribute('lang', 'fr');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(TITRE_FR);
    await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', /^Organisez un voyage entre amis/u);

    await page.goto('/?langue=en', { waitUntil: 'networkidle' });
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page.getByRole('heading', { level: 1 })).not.toHaveText(TITRE_FR);
    await expect(page).toHaveTitle('Tripora — plan a trip with friends');
    await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', /^Plan a trip with friends/u);
  });
});

test.describe('une personne au téléphone réglé en français', () => {
  test.use({ locale: 'fr-FR' });

  test('suit un lien vers la version anglaise, et la garde en naviguant', async ({ page }) => {
    await page.goto('/?langue=en', { waitUntil: 'networkidle' });
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await page.getByRole('contentinfo').getByRole('link', { name: 'Legal notice' }).click();
    await expect(page).toHaveURL(/\/mentions-legales$/u);
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  });
});
