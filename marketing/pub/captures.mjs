/**
 * Les vrais écrans de Tripora, capturés pour la vidéo.
 *
 * L'application tourne en mode local (sans serveur, sans réseau), servie par
 * le serveur des tests de bout en bout sur l'application construite :
 *   pnpm --filter @tripora/web build:e2e   (ou laisser Playwright la construire)
 *   node captures.mjs
 *
 * Les pages longues sont capturées sans la barre d'onglets, qui est posée à
 * part dans le téléphone de la vidéo : on peut ainsi faire défiler l'écran
 * sous une barre fixe, comme sur un vrai téléphone. Les bandeaux propres au
 * mode local (« ces voyages ne vivent que sur cet appareil ») sont retirés :
 * une personne connectée ne les voit jamais.
 */
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ICI = dirname(fileURLToPath(import.meta.url));
const WEB = resolve(ICI, '../../apps/web');
const require = createRequire(resolve(WEB, 'package.json'));
const { chromium } = require('@playwright/test');

const PORT = 4174;
// LANGUE=en node captures.mjs → captures-en/ (l'application en anglais).
const LANGUE = process.env.LANGUE ?? 'fr';
const DOSSIER = LANGUE === 'fr' ? 'captures' : `captures-${LANGUE}`;
const TITRES = LANGUE === 'fr' ? ['Bali entre potes', 'Soleil d’octobre'] : ['Bali with friends', 'October sun'];
mkdirSync(DOSSIER, { recursive: true });
const BASE = `http://localhost:${PORT}`;
const serveur = spawn('node', [resolve(WEB, 'e2e/serveur.mjs')], {
  env: { ...process.env, PORT_E2E: String(PORT) },
  stdio: 'ignore',
});
await new Promise((ok) => setTimeout(ok, 800));

const brouillon = (m = {}) => ({
  title: TITRES[0], groupType: 'friends', participants: 4,
  origin: { name: 'Paris', lat: 48.8566, lng: 2.3522, iata: ['CDG'] },
  destinationMode: 'fixed', destinationIds: ['bali'], dateMode: 'month',
  startDate: null, endDate: null, windowStart: null, windowEnd: null,
  month: 7, durationDays: 12, budgetMode: 'max_per_person', budgetPerPersonCents: 180000,
  comfortLevel: 'mid', weights: { nature: 1, relax: 0.66, food: 0.66, culture: 0.33 }, avoid: [], ...m,
});
const VOYAGES = [
  { id: 'v1', title: TITRES[0], createdAt: '2026-09-08T10:00:00.000Z', draft: brouillon() },
  {
    id: 'v2', title: TITRES[1], createdAt: '2026-09-09T10:00:00.000Z',
    draft: brouillon({
      title: TITRES[1], destinationMode: 'suggest', destinationIds: [], month: 10, durationDays: 5,
      budgetPerPersonCents: 60000, weights: { food: 1, culture: 0.66, nightlife: 0.66, relax: 0.33 },
    }),
  },
];

const navigateur = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell',
});
const contexte = await navigateur.newContext({
  viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: LANGUE === 'fr' ? 'fr-FR' : 'en-US', serviceWorkers: 'block',
});
await contexte.route(/^https?:\/\/(?!localhost[:/])/u, (r) => r.abort('internetdisconnected'));
const page = await contexte.newPage();
await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
await page.evaluate(([v, langue]) => {
  localStorage.setItem('tripora.local-identity', JSON.stringify({ id: 'moi', displayName: 'Inès', isAnonymous: true, mode: 'local' }));
  localStorage.setItem('tripora.local-trips', JSON.stringify(v));
  localStorage.setItem('tripora.guide-vu', '1');
}, [VOYAGES, LANGUE]);

async function nettoyer({ sansBarre = false } = {}) {
  await page.evaluate((sansBarre) => {
    for (const el of document.querySelectorAll('[role=status]')) {
      if (/cet appareil|Mode local|mode local|Pas de partage|this device|Local mode|local mode|No sharing/u.test(el.textContent ?? '')) el.remove();
    }
    if (sansBarre) {
      for (const nav of document.querySelectorAll('nav')) {
        if (getComputedStyle(nav).position === 'fixed') nav.style.display = 'none';
      }
    }
  }, sansBarre);
  await page.waitForTimeout(400);
}

/** Où se trouvent certains textes dans la page longue (px CSS), pour viser les défilements. */
const reperes = {};
/** `textes` : { repère: [texte en français, texte en anglais] } — le repère garde le même nom dans les deux langues. */
async function reperer(nom, textes) {
  reperes[nom] = await page.evaluate(([textes, langue]) => {
    const sortie = {};
    const marcheur = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    while (marcheur.nextNode()) {
      const n = marcheur.currentNode;
      for (const [cle, [fr, en]] of Object.entries(textes)) {
        const t = langue === 'fr' ? fr : en;
        if (sortie[cle] === undefined && n.textContent.includes(t)) {
          sortie[cle] = Math.round(n.parentElement.getBoundingClientRect().top + window.scrollY);
        }
      }
    }
    sortie.hauteur = document.documentElement.scrollHeight;
    return sortie;
  }, [textes, LANGUE]);
}

async function capturer(nom, chemin, { avant, long = true, textes = {}, decoupe, decoupeLongue } = {}) {
  await page.goto(BASE + chemin, { waitUntil: 'networkidle' });
  await page.waitForTimeout(900);
  if (avant) await avant();
  await nettoyer();
  await page.screenshot({ path: `${DOSSIER}/${nom}.jpg`, type: 'jpeg', quality: 88 });
  if (decoupe) await page.screenshot({ path: `${DOSSIER}/${decoupe.nom}.jpg`, type: 'jpeg', quality: 90, clip: decoupe.zone });
  if (long) {
    await nettoyer({ sansBarre: true });
    await page.screenshot({ path: `${DOSSIER}/${nom}-long.jpg`, type: 'jpeg', quality: 88, fullPage: true });
    if (Object.keys(textes).length) await reperer(nom, textes);
    // La zone peut dépendre d'un repère : le texte anglais ne tombe pas à la même hauteur.
    if (decoupeLongue) {
      const zone = typeof decoupeLongue.zone === 'function' ? decoupeLongue.zone(reperes[nom]) : decoupeLongue.zone;
      await page.screenshot({ path: `${DOSSIER}/${decoupeLongue.nom}.jpg`, type: 'jpeg', quality: 92, fullPage: true, clip: zone });
    }
  }
  console.log(nom);
}

await capturer('creer', '/voyages/nouveau', {
  long: false,
  avant: () => page.getByText(/^(Entre amis|With friends)$/u).click(),
});
await capturer('propositions', '/voyages/v2', { textes: { entete: ['destinations pour votre groupe', 'destinations for your group'], budapest: ['Budapest', 'Budapest'], cracovie: ['Cracovie', 'Kraków'], prague: ['Prague', 'Prague'] } });
await capturer('itineraire', '/voyages/v1/itineraire', {
  textes: { lieux: ['Des vrais lieux', 'Real places'], jour1: ['Arrivée, puis', 'Arrival, then'], ajouter: ['Ajouter un lieu', 'Add a place'] },
  avant: async () => {
    await page.getByRole('button', { name: /Générer l.itinéraire|Generate the itinerary/u }).click();
    await page.waitForTimeout(1200);
  },
});
// La carte du dessus, à part : la vidéo la fait glisser hors de l'écran.
await capturer('decouvrir', '/voyages/v1/decouvrir', { long: false, decoupe: { nom: 'carte-rizieres', zone: { x: 12, y: 110, width: 366, height: 636 } } });
await capturer('afaire', '/voyages/v1/a-faire', { textes: { rizieres: ['Les rizières', 'Tegallalang rice'], singes: ['La forêt des singes', 'Monkey Forest'], penida: ['Nusa Penida', 'Nusa Penida'] } });
// L'image du bilan à partager, seule.
await capturer('bilan', '/voyages/v1/bilan', { textes: { image: ['L’image à partager', 'The image to share'] }, decoupeLongue: { nom: 'bilan-carte', zone: (r) => ({ x: 35, y: r.image + 40, width: 320, height: 314 }) } });
await capturer('budget', '/voyages/v1/budget');
await capturer('valise', '/voyages/v1/valise');
await capturer('voyage', '/voyages/v1', { textes: { avancement: ['Où on en est', 'Where we’re at'], outils: ['Découvrir', 'Discover'], destination: ['Destination retenue', 'Destination chosen'], empreinte: ['L’empreinte du trajet', 'The trip’s footprint'], infos: ['Infos pratiques', 'Practical info'] } });

await navigateur.close();
serveur.kill();
writeFileSync(`${DOSSIER}/reperes.json`, JSON.stringify(reperes, null, 2) + '\n');
// La même chose, lisible par la page de la pub sans requête.
writeFileSync(`${DOSSIER}/reperes.js`, `window.REPERES = ${JSON.stringify(reperes)};\n`);
console.log(reperes);
