/**
 * Écrit les pages publiques du carnet dans `dist/`, après le build du site.
 *
 *   tsx scripts/generer-pages-publiques.ts [dossier]   (dist par défaut)
 *
 * Lancé par `pnpm build`, jamais par le build mobile : l'application Android
 * n'a pas de moteur de recherche à contenter. Le contenu vient entièrement de
 * `src/seo/pagesPubliques.ts`, qui est testé ; ce script ne fait qu'écrire.
 *
 * L'adresse du site vient de VITE_SITE_ORIGIN (apps/web/.env) : c'est elle qui
 * figure dans les liens canoniques et le plan du site. Le même site est aussi
 * servi ailleurs (Vercel) ; le lien canonique dit aux moteurs laquelle des deux
 * adresses retenir.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadEnv } from 'vite';
import { genererLesPages } from '../src/seo/pagesPubliques';

const ICI = dirname(fileURLToPath(import.meta.url));
const RACINE = resolve(ICI, '..');
const SORTIE = resolve(RACINE, process.argv[2] ?? 'dist');

const env = { ...loadEnv('production', RACINE, 'VITE_'), ...process.env };
const origine = (env['VITE_SITE_ORIGIN'] ?? env['VITE_AUTH_ORIGIN'] ?? '').trim().replace(/\/+$/u, '');
if (!/^https:\/\/[^/]+$/u.test(origine)) {
  console.error('VITE_SITE_ORIGIN manquant ou invalide : les liens canoniques seraient faux.');
  process.exit(1);
}

const fichiers = genererLesPages({ origine, aujourdhui: new Date().toISOString().slice(0, 10) });
for (const { chemin, contenu } of fichiers) {
  const cible = resolve(SORTIE, chemin);
  mkdirSync(dirname(cible), { recursive: true });
  writeFileSync(cible, contenu);
}
console.log(`${fichiers.length} fichiers publics écrits pour ${origine}.`);
