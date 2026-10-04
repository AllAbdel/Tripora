/**
 * Le serveur des tests de bout en bout.
 *
 * `vite preview` suffirait à servir les fichiers, mais il ne pose pas les
 * en-têtes de `public/_headers` — et c'est justement sous ces en-têtes que
 * l'application casse. La carte est restée noire pendant des jours parce que
 * MapLibre chargeait son ouvrier de rendu d'une façon que la politique de
 * sécurité refuse : en développement tout marchait, en ligne non.
 *
 * Ce serveur applique donc la vraie politique, et le repli d'application à
 * page unique. Ce que voit le test est ce que voit un navigateur en ligne.
 */
import { createServer } from 'node:http';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ICI = dirname(fileURLToPath(import.meta.url));
const RACINE = resolve(ICI, process.env['DOSSIER_E2E'] ?? '../dist-e2e');
const PORT = Number(process.env['PORT_E2E'] ?? 4173);

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webmanifest': 'application/manifest+json',
};

/** Les en-têtes globaux de `public/_headers`, ceux posés sur `/*`. */
function enTetesDuSite() {
  const fichier = join(RACINE, '_headers');
  if (!existsSync(fichier)) return {};
  const trouves = {};
  let dansLeBlocGlobal = false;
  for (const ligne of readFileSync(fichier, 'utf8').split('\n')) {
    if (/^\/\S/.test(ligne)) {
      dansLeBlocGlobal = ligne.trim() === '/*';
      continue;
    }
    const paire = ligne.match(/^\s{2}([A-Za-z-]+):\s*(.+)$/);
    if (paire && dansLeBlocGlobal) trouves[paire[1]] = paire[2].trim();
  }
  return trouves;
}

const GLOBAUX = enTetesDuSite();

createServer((requete, reponse) => {
  const chemin = decodeURIComponent((requete.url ?? '/').split('?')[0]);
  let fichier = join(RACINE, normalize(chemin));
  // Un dossier sert son index.html, comme chez les deux hébergeurs : c'est
  // ainsi que /retour-app/ sert sa propre page, et non l'application.
  if (fichier.startsWith(RACINE) && existsSync(join(fichier, 'index.html'))) {
    fichier = join(fichier, 'index.html');
  }
  // Une adresse sans extension sert le fichier .html du même nom, comme
  // Cloudflare Pages (et Vercel avec cleanUrls) : /destinations/bergen sert
  // destinations/bergen.html, la page publique du carnet.
  if (fichier.startsWith(RACINE) && !extname(fichier) && existsSync(`${fichier}.html`)) {
    fichier = `${fichier}.html`;
  }
  // Repli page unique : /voyages/abc/carte doit ouvrir l'application, pas une
  // erreur 404 — c'est tout l'intérêt d'un lien d'invitation partagé.
  if (!fichier.startsWith(RACINE) || !existsSync(fichier) || statSync(fichier).isDirectory()) {
    fichier = join(RACINE, 'index.html');
  }
  reponse.writeHead(200, {
    'Content-Type': TYPES[extname(fichier)] ?? 'application/octet-stream',
    ...GLOBAUX,
  });
  reponse.end(readFileSync(fichier));
}).listen(PORT, () => {
  console.log(`Tripora servi sur http://localhost:${PORT}`);
});
