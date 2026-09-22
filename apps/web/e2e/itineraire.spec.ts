import { expect, test } from '@playwright/test';
import { BALI, poser } from './tripora';

/**
 * L'itinéraire de Bali, rempli pour de vrai.
 *
 * C'est la simulation qui a déclenché le carnet d'activités : dix jours à Bali
 * n'affichaient que « Musées et monuments ». Ce test la rejoue dans un
 * navigateur, du bouton « Générer » au remplissage, et vérifie les trois
 * choses qu'on a vu casser en regardant l'écran.
 */
test('un séjour à Bali se remplit d’activités de Bali, chacune une seule fois', async ({ page }) => {
  await poser(page, [BALI], '/voyages/v1/itineraire');
  await page.getByRole('button', { name: /Générer l’itinéraire/ }).click();

  const completer = page.getByRole('button', { name: /Compléter avec de vrais lieux/ });
  await expect(completer).toBeVisible();
  await completer.click();

  // Une seule passe suffit : le bouton disparaît, faute de quoi le second
  // appui reposait les mêmes lieux sur d'autres jours.
  await expect(completer).toHaveCount(0);

  // On relève tous les titres, jour par jour.
  const onglets = page.locator('nav button', { hasText: /^Jour \d+$/ });
  const combien = await onglets.count();
  expect(combien).toBeGreaterThanOrEqual(10);

  const titres: string[] = [];
  const heuresDuKecak: string[] = [];
  for (let index = 0; index < combien; index += 1) {
    await onglets.nth(index).click();
    const lignes = page.locator('ul li');
    const nombre = await lignes.count();
    for (let ligne = 0; ligne < nombre; ligne += 1) {
      const texte = (await lignes.nth(ligne).innerText()).replace(/\s+/g, ' ');
      titres.push(texte);
      if (/kecak/i.test(texte)) heuresDuKecak.push(/(\d{2}:\d{2})/.exec(texte)?.[1] ?? '');
    }
  }
  const tout = titres.join(' | ');

  // Des activités de Bali, et pas des intitulés génériques partout.
  expect(tout).toMatch(/Tegallalang|Uluwatu|Tanah Lot|Batur|Ubud|Nusa Penida/u);

  // Chaque activité du carnet n'apparaît qu'une fois sur tout le séjour.
  for (const nom of ['Tegallalang', 'kecak', 'Tanah Lot', 'mont Batur', 'Nusa Penida']) {
    const occurrences = titres.filter((titre) => titre.includes(nom)).length;
    expect(occurrences, nom).toBeLessThanOrEqual(1);
  }

  // Le kecak se joue au coucher du soleil, jamais à neuf heures.
  for (const heure of heuresDuKecak) {
    expect(Number(heure.slice(0, 2)), `kecak à ${heure}`).toBeGreaterThanOrEqual(17);
  }
});
