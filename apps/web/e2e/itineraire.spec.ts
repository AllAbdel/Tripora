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

/**
 * Les envies du groupe, de « À faire » jusqu'au programme.
 *
 * On refuse les rizières de Tegallalang et on réclame la forêt des singes ;
 * le remplissage doit en tenir compte. Sans avis, Tegallalang est justement
 * l'une des premières activités posées : son absence prouve que le refus a
 * été lu, pas que le hasard l'a oubliée.
 */
test('ce que le groupe refuse n’arrive pas au programme, ce qu’il réclame y arrive', async ({ page }) => {
  await poser(page, [BALI], '/voyages/v1/a-faire');

  const refus = page.getByRole('button', { name: 'Sans moi : Les rizières en terrasses de Tegallalang' });
  await refus.click();
  await expect(refus).toHaveAttribute('aria-pressed', 'true');

  const envie = page.getByRole('button', { name: 'J’ai envie : La forêt des singes d’Ubud' });
  await envie.click();
  await expect(envie).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByText('Vous en avez envie')).toBeVisible();

  // Le filtre « Nos envies » apparaît, et ne garde que ce qui a été réclamé.
  await page.getByRole('button', { name: /Nos envies · 1/ }).click();
  await expect(page.getByRole('heading', { level: 2 })).toHaveText(['La forêt des singes d’Ubud']);

  await page.goto('/voyages/v1/itineraire');
  await page.getByRole('button', { name: /Générer l’itinéraire/ }).click();
  await expect(page.getByText(/Ce que le groupe a réclamé/)).toBeVisible();
  await page.getByRole('button', { name: /Compléter avec de vrais lieux/ }).click();

  const onglets = page.locator('nav button', { hasText: /^Jour \d+$/ });
  await expect(onglets.first()).toBeVisible();
  const textes: string[] = [];
  for (let index = 0; index < (await onglets.count()); index += 1) {
    await onglets.nth(index).click();
    textes.push((await page.locator('ul').first().innerText()).replace(/\s+/g, ' '));
  }
  const tout = textes.join(' | ');

  expect(tout).not.toContain('Tegallalang');
  expect(tout).toContain('forêt des singes');
});
