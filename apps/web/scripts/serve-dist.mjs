/**
 * Serveur statique minimal pour `dist/`, le temps d'un parcours automatisé.
 *
 * Écrit à la main plutôt qu'installé : il ne fait que servir des fichiers et
 * renvoyer `index.html` pour toute route inconnue — c'est ce que fait
 * Cloudflare Pages grâce à `public/_redirects`, et sans cette règle les liens
 * profonds renverraient 404, exactement le bug corrigé en production.
 */
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize } from 'node:path';

const RACINE = new URL('../dist/', import.meta.url).pathname;
const PORT = Number(process.env.SMOKE_PORT ?? 4173);

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webmanifest': 'application/manifest+json',
  '.woff2': 'font/woff2',
};

createServer((requete, reponse) => {
  const chemin = new URL(requete.url ?? '/', 'http://localhost').pathname;
  // normalize + le préfixe vérifié : on ne sort pas de dist/.
  const candidat = join(RACINE, normalize(chemin));
  const fichier =
    candidat.startsWith(RACINE) && existsSync(candidat) && statSync(candidat).isFile()
      ? candidat
      : join(RACINE, 'index.html');

  reponse.writeHead(200, {
    'content-type': TYPES[extname(fichier)] ?? 'application/octet-stream',
  });
  createReadStream(fichier).pipe(reponse);
}).listen(PORT);
