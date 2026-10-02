/**
 * Rendu de la pub, image par image.
 *
 *   node rendu.mjs --apercu 3,10.5,24   → captures/apercu-*.png aux instants donnés
 *   node rendu.mjs --cues               → sortie/cues.json (les bruitages, pour musique.py)
 *   node rendu.mjs                      → sortie/image.mp4 (sans le son)
 *   LANGUE=en node rendu.mjs            → la pub en anglais : sortie/image-en.mp4, cues-en.json, apercu-en-*.png
 *
 * La page est servie depuis la racine du dépôt (les polices et le logo sont
 * ceux de l'application). Chaque image : window.allerA(t), puis une capture.
 * Plusieurs onglets rendent chacun un tronçon, encodé à part par ffmpeg,
 * puis les tronçons sont mis bout à bout sans réencodage.
 *
 * Variables : FFMPEG (chemin de ffmpeg), CHROMIUM_PATH, OUVRIERS (4 par défaut),
 * IPS (30 images par seconde par défaut).
 */
import { spawn } from 'node:child_process';
import { createReadStream, existsSync, mkdirSync, statSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { dirname, extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ICI = dirname(fileURLToPath(import.meta.url));
const RACINE = resolve(ICI, '../..');
const require = createRequire(resolve(RACINE, 'apps/web/package.json'));
const { chromium } = require('@playwright/test');

const FFMPEG = process.env.FFMPEG ?? 'ffmpeg';
const IPS = Number(process.env.IPS ?? 30);
const OUVRIERS = Number(process.env.OUVRIERS ?? 4);
const SORTIE = resolve(ICI, 'sortie');
const LANGUE = process.env.LANGUE ?? 'fr';
// Les fichiers de la version française gardent leur nom ; les autres langues prennent un suffixe.
const SUFFIXE = LANGUE === 'fr' ? '' : `-${LANGUE}`;
mkdirSync(SORTIE, { recursive: true });

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2', '.json': 'application/json' };
const serveur = createServer((req, res) => {
  const chemin = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^(\.\.[/\\])+/, '');
  const fichier = join(RACINE, chemin);
  if (!fichier.startsWith(RACINE) || !existsSync(fichier) || statSync(fichier).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': TYPES[extname(fichier)] ?? 'application/octet-stream' });
  createReadStream(fichier).pipe(res);
});
await new Promise((ok) => serveur.listen(0, ok));
const ADRESSE = `http://localhost:${serveur.address().port}/marketing/pub/index.html?langue=${LANGUE}`;

const navigateur = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell',
  args: ['--disable-lcd-text', '--font-render-hinting=none', '--force-color-profile=srgb'],
});

async function ouvrir() {
  const page = await navigateur.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  const erreurs = [];
  page.on('pageerror', (e) => erreurs.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') erreurs.push(m.text()); });
  await page.goto(ADRESSE, { waitUntil: 'load' });
  await page.evaluate(() => window.pret);
  if (erreurs.length) console.error('Erreurs dans la page :', erreurs);
  return page;
}

async function image(page, t, type = 'jpeg') {
  await page.evaluate((t) => window.allerA(t), t);
  return page.screenshot({ type, quality: type === 'jpeg' ? 94 : undefined, animations: 'allow' });
}

const arg = (nom) => { const i = process.argv.indexOf(nom); return i < 0 ? null : process.argv[i + 1] ?? ''; };

if (process.argv.includes('--apercu')) {
  const page = await ouvrir();
  const instants = arg('--apercu').split(',').map(Number);
  for (const t of instants) {
    writeFileSync(join(SORTIE, `apercu${SUFFIXE}-${t.toFixed(2)}.png`), await image(page, t, 'png'));
  }
  console.log(`${instants.length} aperçus dans ${SORTIE}`);
} else if (process.argv.includes('--cues')) {
  const page = await ouvrir();
  const pub = await page.evaluate(() => window.PUB);
  writeFileSync(join(SORTIE, `cues${SUFFIXE}.json`), JSON.stringify(pub, null, 1));
  console.log(`${pub.cues.length} bruitages, durée ${pub.duree} s`);
} else {
  const page0 = await ouvrir();
  const { duree } = await page0.evaluate(() => window.PUB);
  await page0.close();
  const total = Math.round(duree * IPS);
  const debut = Number(arg('--de') ?? 0), fin = Math.min(total, Number(arg('--a') ?? total));
  const parOuvrier = Math.ceil((fin - debut) / OUVRIERS);
  const troncons = [];
  const depart = Date.now();
  let faites = 0;
  await Promise.all(Array.from({ length: OUVRIERS }, async (_, k) => {
    const a = debut + k * parOuvrier, b = Math.min(fin, a + parOuvrier);
    if (a >= b) return;
    const fichier = join(SORTIE, `troncon${SUFFIXE}-${String(k).padStart(2, '0')}.mp4`);
    troncons[k] = fichier;
    const ff = spawn(FFMPEG, ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(IPS), '-i', '-',
      '-c:v', 'libx264', '-preset', 'slow', '-crf', '15', '-pix_fmt', 'yuv420p', '-profile:v', 'high', '-tune', 'animation',
      '-g', String(IPS * 2), fichier], { stdio: ['pipe', 'inherit', 'inherit'] });
    const page = await ouvrir();
    for (let i = a; i < b; i++) {
      const tampon = await image(page, i / IPS);
      if (!ff.stdin.write(tampon)) await new Promise((ok) => ff.stdin.once('drain', ok));
      faites++;
      if (faites % 150 === 0) {
        const ecoule = (Date.now() - depart) / 1000;
        console.log(`${faites}/${fin - debut} images · ${ecoule.toFixed(0)} s · reste ~${((ecoule / faites) * (fin - debut - faites)).toFixed(0)} s`);
      }
    }
    ff.stdin.end();
    await new Promise((ok, ko) => ff.on('close', (c) => (c === 0 ? ok() : ko(new Error(`ffmpeg ${c}`)))));
    await page.close();
  }));
  const liste = join(SORTIE, `troncons${SUFFIXE}.txt`);
  writeFileSync(liste, troncons.filter(Boolean).map((f) => `file '${f}'`).join('\n') + '\n');
  await new Promise((ok, ko) => {
    const ff = spawn(FFMPEG, ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', liste, '-c', 'copy', join(SORTIE, `image${SUFFIXE}.mp4`)], { stdio: 'inherit' });
    ff.on('close', (c) => (c === 0 ? ok() : ko(new Error(`ffmpeg ${c}`))));
  });
  console.log(`Vidéo sans le son : ${join(SORTIE, `image${SUFFIXE}.mp4`)} (${((Date.now() - depart) / 1000).toFixed(0)} s)`);
}

await navigateur.close();
serveur.close();
