import { expect, test, type Route } from '@playwright/test';
import { BALI, poser } from './tripora';

/**
 * La carte hors ligne : télécharger la destination, la retrouver dans le
 * stockage de l'appareil, la supprimer.
 *
 * Les tests n'ont pas Internet : on joue le serveur de cartes (style,
 * description des tuiles, tuiles, polices, pictogrammes) pour vérifier tout
 * le chemin du téléchargement, sans dépendre d'un service extérieur.
 */
const STYLE = {
  version: 8,
  sprite: 'https://tiles.openfreemap.org/sprites/ofm',
  glyphs: 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf',
  sources: { openmaptiles: { type: 'vector', url: 'https://tiles.openfreemap.org/planet' } },
  layers: [
    { id: 'fond', type: 'background', paint: { 'background-color': '#eeeeee' } },
    {
      id: 'villes',
      type: 'symbol',
      source: 'openmaptiles',
      'source-layer': 'place',
      layout: { 'text-font': ['Noto Sans Regular'], 'text-field': '{name}' },
    },
  ],
};

// La carte hors ligne ne doit rien au service worker (l'application Android
// n'en a pas) ; et ses requêtes échapperaient au faux serveur ci-dessous.
test.use({ serviceWorkers: 'block' });

/** Un pixel transparent, pour les pictogrammes. */
const PIXEL = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
  'base64',
);

// Comme le vrai serveur : des réponses lisibles depuis une autre origine.
const CORS = { 'Access-Control-Allow-Origin': '*' };

function serveurDeCartes(route: Route) {
  const adresse = route.request().url();
  if (/\/styles\/(positron|dark)$/u.test(adresse)) return route.fulfill({ json: STYLE, headers: CORS });
  if (adresse.endsWith('/planet')) {
    return route.fulfill({
      json: { tiles: ['https://tiles.openfreemap.org/planet/v1/{z}/{x}/{y}.pbf'], maxzoom: 14 },
      headers: CORS,
    });
  }
  if (adresse.endsWith('.json')) return route.fulfill({ json: {}, headers: CORS });
  if (adresse.endsWith('.png')) return route.fulfill({ body: PIXEL, contentType: 'image/png', headers: CORS });
  // Une tuile vide est une tuile valide : une zone sans rien à dessiner.
  return route.fulfill({ body: Buffer.alloc(0), contentType: 'application/x-protobuf', headers: CORS });
}

test('la carte de la destination se garde sur l’appareil, et s’en va d’un geste', async ({ page }) => {
  test.setTimeout(60_000);
  await poser(page, [BALI], '/voyages/v1/carte');
  // Après la coupure d'Internet posée par `poser` : cette route passe en premier.
  await page.route('https://tiles.openfreemap.org/**', serveurDeCartes);

  const carte = page.getByText('Carte hors ligne').locator('xpath=ancestor::*[contains(@class,"space-y-3")][1]');
  await expect(carte.getByText(/Environ \d+ Mo/u)).toBeVisible();
  await page.getByRole('button', { name: 'Télécharger la carte' }).click();
  await expect(page.getByText(/La carte de .+ est sur cet appareil/u)).toBeVisible({ timeout: 45_000 });

  const stockage = await page.evaluate(async () => {
    const noms = await caches.keys();
    const tuiles = noms.find((nom) => nom.startsWith('tripora-carte-') && nom !== 'tripora-carte-commun');
    const communes = await (await caches.open('tripora-carte-commun')).keys();
    return {
      noms,
      tuiles: tuiles ? (await (await caches.open(tuiles)).keys()).length : 0,
      style: communes.some((requete) => requete.url.endsWith('/styles/positron')),
      police: communes.some((requete) => requete.url.includes('/fonts/Noto%20Sans%20Regular/0-255.pbf')),
      pictogrammes: communes.some((requete) => requete.url.endsWith('/sprites/ofm@2x.png')),
    };
  });
  expect(stockage.tuiles).toBeGreaterThan(200);
  expect(stockage.style && stockage.police && stockage.pictogrammes).toBe(true);

  // Plus de réseau du tout : la carte se dessine depuis l'appareil, sans
  // basculer sur le fond de repli (qu'elle prend passé huit secondes sans tuile).
  await page.unroute('https://tiles.openfreemap.org/**');
  await page.reload({ waitUntil: 'networkidle' });
  await expect(page.getByText(/La carte de .+ est sur cet appareil/u)).toBeVisible();
  await page.waitForTimeout(9_000);
  await expect(page.getByText(/Fond de carte indisponible/u)).toHaveCount(0);

  await page.getByRole('button', { name: 'Supprimer la carte' }).click();
  await expect(page.getByRole('button', { name: 'Télécharger la carte' })).toBeVisible();
  const restants = await page.evaluate(() => caches.keys());
  expect(restants.filter((nom) => nom.startsWith('tripora-carte-'))).toEqual([]);
});
