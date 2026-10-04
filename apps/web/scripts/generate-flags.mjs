/**
 * Copie dans `public/flags/` les drapeaux des pays que Tripora connaît.
 *
 *   node scripts/generate-flags.mjs
 *
 * Pourquoi des fichiers et non un module JavaScript : le jeu complet pèse plus
 * d'un mégaoctet, presque entièrement dû à une vingtaine de drapeaux à
 * armoiries (la Serbie à elle seule fait 180 Ko). Inclus dans le paquet, ils
 * seraient téléchargés par tout le monde, tout le temps, pour être affichés en
 * vingt pixels de large. En fichiers séparés, seul le drapeau réellement
 * affiché part sur le réseau, et le service worker le garde ensuite.
 *
 * On ne copie que les pays présents dans le catalogue, plus ceux visés par une
 * recommandation d'application : le reste ne s'afficherait jamais. Le composant
 * `Drapeau` retombe proprement sur le code du pays quand le fichier manque.
 *
 * Source : `flag-icons` (CC0 pour les tracés), en dépendance de développement
 * uniquement — rien de tout ça n'existe à l'exécution.
 */
import { copyFileSync, existsSync, mkdirSync, readdirSync, rmSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DESTINATIONS } from '@tripora/core';

const HERE = dirname(fileURLToPath(import.meta.url));
const SORTIE = resolve(HERE, '../public/flags');
const require = createRequire(import.meta.url);

/** Pays cités par les fiches d'applications mais sans destination au catalogue. */
const PAYS_DES_APPLICATIONS = ['BD', 'CM', 'AO', 'BY', 'MD', 'AL', 'XK'];

const source = resolve(dirname(require.resolve('flag-icons/package.json')), 'flags/4x3');
if (!existsSync(source)) {
  console.error('flag-icons introuvable : pnpm install à la racine.');
  process.exit(1);
}

const codes = [
  ...new Set(
    [...DESTINATIONS.map((d) => d.countryCode), ...PAYS_DES_APPLICATIONS].map((c) =>
      c.toLowerCase(),
    ),
  ),
].sort();

rmSync(SORTIE, { recursive: true, force: true });
mkdirSync(SORTIE, { recursive: true });

let copies = 0;
let octets = 0;
const absents = [];

for (const code of codes) {
  const fichier = resolve(source, `${code}.svg`);
  if (!existsSync(fichier)) {
    absents.push(code);
    continue;
  }
  copyFileSync(fichier, resolve(SORTIE, `${code}.svg`));
  octets += statSync(fichier).size;
  copies += 1;
}

console.log(`${copies} drapeaux copiés (${Math.round(octets / 1024)} Ko)`);
if (absents.length > 0) console.log(`sans drapeau : ${absents.join(', ')}`);

const lourds = readdirSync(SORTIE)
  .map((nom) => ({ nom, taille: statSync(resolve(SORTIE, nom)).size }))
  .filter((f) => f.taille > 20_000)
  .sort((a, b) => b.taille - a.taille);
if (lourds.length > 0) {
  console.log(
    `les plus lourds (armoiries détaillées) : ${lourds
      .slice(0, 5)
      .map((f) => `${f.nom} ${Math.round(f.taille / 1024)} Ko`)
      .join(', ')}`,
  );
}
