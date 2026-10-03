/**
 * Les phrases restées en français dans une langue.
 *
 * Parcourt les écrans en mode local (sans serveur), navigateur et interface
 * réglés dans la langue, avec deux trips de démonstration, et demande à la
 * traduction au rendu ce qu'elle n'a pas su traduire. Sortie : un JSON
 * { phrase: [écrans] }, à compléter dans `src/i18n/phrases-<langue>.ts`.
 *
 *   VITE_SUPABASE_URL= VITE_SUPABASE_ANON_KEY= npx vite build --outDir dist-e2e
 *   LANGUE=es node scripts/recolter-traductions.mjs > /tmp/phrases-manquantes.json
 *
 * LANGUE vaut `en` par défaut. Sans fichier `phrases-<langue>.ts`, tout le
 * texte affiché sort : c'est la liste de départ d'une nouvelle langue.
 */
/* global document, window -- le code des `page.evaluate` tourne dans la page. */
import { spawn } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const ICI = dirname(fileURLToPath(import.meta.url));
const PORT = 4175;
const LANGUE = process.env.LANGUE ?? 'en';
// L'étiquette du navigateur : la langue et son pays le plus courant.
const NAVIGATEUR = { en: 'en-US', es: 'es-ES', it: 'it-IT', de: 'de-DE', pt: 'pt-PT', nl: 'nl-NL', pl: 'pl-PL', tr: 'tr-TR', ru: 'ru-RU', ar: 'ar-SA', zh: 'zh-CN', ja: 'ja-JP', ko: 'ko-KR' }[LANGUE] ?? LANGUE;
const BASE = `http://localhost:${PORT}`;
const serveur = spawn('node', [resolve(ICI, '../e2e/serveur.mjs')], {
  env: { ...process.env, PORT_E2E: String(PORT) },
  stdio: 'ignore',
});
await new Promise((ok) => setTimeout(ok, 800));

const brouillon = (m = {}) => ({
  title: 'Bali with friends', groupType: 'friends', participants: 4,
  origin: { name: 'Paris', lat: 48.8566, lng: 2.3522, iata: ['CDG'] },
  destinationMode: 'fixed', destinationIds: ['bali'], dateMode: 'month',
  startDate: null, endDate: null, windowStart: null, windowEnd: null,
  month: 7, durationDays: 12, budgetMode: 'max_per_person', budgetPerPersonCents: 180000,
  comfortLevel: 'mid', weights: { nature: 1, relax: 0.66, food: 0.66, culture: 0.33 }, avoid: [], ...m,
});
const VOYAGES = [
  { id: 'v1', title: 'Bali with friends', createdAt: '2026-09-08T10:00:00.000Z', draft: brouillon() },
  {
    id: 'v2', title: 'October sun', createdAt: '2026-09-09T10:00:00.000Z',
    draft: brouillon({
      title: 'October sun', destinationMode: 'suggest', destinationIds: [], month: 10, durationDays: 5,
      budgetPerPersonCents: 60000, weights: { food: 1, culture: 0.66, nightlife: 0.66, relax: 0.33 },
    }),
  },
];

const ECRANS = (process.env.ECRANS ?? [
  '/', '/connexion', '/voyages', '/voyages/nouveau', '/voyages/v1', '/voyages/v2', '/voyages/v1/itineraire',
  '/voyages/v1/decouvrir', '/voyages/v1/a-faire', '/voyages/v1/bilan', '/voyages/v1/budget', '/voyages/v1/reservations',
  '/voyages/v1/coffre', '/voyages/v1/journal', '/voyages/v1/valise', '/voyages/v1/qui-fait-quoi', '/voyages/v1/sondages',
  '/voyages/v1/participants', '/voyages/v1/carte', '/voyages/v1/discussion', '/voyages/v1/recapitulatif',
  '/voyages/v1/modifier', '/voyages/v1/applications', '/carte', '/budget', '/profil', '/passeport', '/alertes',
  '/explorer', '/partager', '/soutenir',
].join(',')).split(',');

/** Les gestes qui font apparaître du texte caché derrière un bouton. */
const GESTES = {
  '/voyages/v1/itineraire': async (page) => {
    await page.getByRole('button', { name: /Générer|Generate/u }).first().click({ timeout: 3000 }).catch(() => {});
  },
  '/voyages/nouveau': async (page) => {
    // L'assistant, étape par étape, aussi loin que des choix par défaut le permettent.
    await page.getByText(/Entre amis|With friends/u).first().click({ timeout: 3000 }).catch(() => {});
    for (let etape = 0; etape < 6; etape++) {
      await page.waitForTimeout(400);
      const champ = page.getByRole('combobox').or(page.getByRole('textbox')).first();
      if (await champ.isVisible().catch(() => false)) {
        await champ.fill('Paris').catch(() => {});
        await page.waitForTimeout(500);
        await page.getByRole('option').first().click({ timeout: 1500 }).catch(() => {});
      }
      // Une étape à choix : le premier, si rien n'est encore choisi.
      const choisi = await page.locator('[role="radio"][aria-checked="true"], [aria-pressed="true"]').count();
      if (!choisi) await page.locator('[role="radio"]').first().click({ timeout: 1000 }).catch(() => {});
      await page.getByRole('button', { name: /Continuer|Continue|Suivant|Voir|Valider/u }).last().click({ timeout: 2000 }).catch(() => {});
    }
  },
};

const navigateur = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell',
});
const contexte = await navigateur.newContext({ viewport: { width: 390, height: 844 }, locale: NAVIGATEUR, serviceWorkers: 'block' });
await contexte.route(/^https?:\/\/(?!localhost[:/])/u, (r) => r.abort('internetdisconnected'));
const page = await contexte.newPage();
await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
await page.evaluate(([v, langue]) => {
  localStorage.setItem('tripora.local-identity', JSON.stringify({ id: 'moi', displayName: 'Inès', isAnonymous: true, mode: 'local' }));
  localStorage.setItem('tripora.local-trips', JSON.stringify(v));
  localStorage.setItem('tripora.guide-vu', '1');
  localStorage.setItem('tripora.recolte-traductions', '1');
  // La langue choisie dans le profil (le format du magasin zustand persisté).
  localStorage.setItem('tripora.langue', JSON.stringify({ state: { preference: langue }, version: 0 }));
}, [VOYAGES, LANGUE]);

const parPhrase = new Map();
for (const ecran of ECRANS) {
  await page.goto(BASE + ecran, { waitUntil: 'networkidle' });
  await page.waitForTimeout(700);
  await GESTES[ecran]?.(page);
  await page.waitForTimeout(500);
  // Faire défiler jusqu'en bas : certaines listes ne se rendent qu'à l'écran.
  await page.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += 600) {
      window.scrollTo(0, y);
      await new Promise((ok) => setTimeout(ok, 60));
    }
  });
  const manquantes = await page.evaluate(() => window.__phrasesManquantes?.() ?? []);
  for (const [phrase] of manquantes) {
    if (!parPhrase.has(phrase)) parPhrase.set(phrase, new Set());
    parPhrase.get(phrase).add(ecran);
  }
}
await navigateur.close();
serveur.kill();

const sortie = Object.fromEntries([...parPhrase.entries()].map(([p, e]) => [p, [...e]]));
process.stdout.write(JSON.stringify(sortie, null, 1) + '\n');
console.error(`${LANGUE} : ${parPhrase.size} phrases sans traduction sur ${ECRANS.length} écrans`);
