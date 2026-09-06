/**
 * Reporte le catalogue TypeScript, seule source de vérité, dans la table
 * `destinations`.
 *
 *   pnpm --filter @tripora/core seed:sql
 *
 * Une migration déjà appliquée ne se rejoue jamais : la corriger sur place
 * n'aurait aucun effet sur une base existante, et le catalogue en ligne
 * resterait figé sur l'ancienne version pendant que le fichier prétend le
 * contraire. Le script écrit donc une **nouvelle** migration, et seulement
 * pour les lignes qui ont changé depuis la dernière — souvent une seule.
 *
 * Rien à lancer pour déployer : les migrations produites sont versionnées.
 * Ce script ne sert qu'après avoir corrigé une note ou une coordonnée.
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DESTINATIONS } from '../src/catalog/destinations.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS = resolve(HERE, '../../../supabase/migrations');
const SUFFIXE = '_seed_catalogue_destinations.sql';

/** Échappement SQL par doublement de l'apostrophe. Aucune valeur ne vient d'un utilisateur. */
const quote = (value: string): string => `'${value.replace(/'/g, "''")}'`;
const array = (values: readonly (string | number)[]): string =>
  values.length === 0 ? "'{}'" : `'{${values.join(',')}}'`;

/** Une ligne de `values`, sans indentation ni virgule finale. */
function rowFor(destination: (typeof DESTINATIONS)[number]): string {
  return `(${[
    quote(destination.id),
    quote(destination.name),
    quote(destination.country),
    quote(destination.countryCode),
    destination.lat,
    destination.lng,
    array(destination.iata),
    `${quote(JSON.stringify(destination.tags))}::jsonb`,
    destination.costIndex,
    destination.poiRichness,
    array(destination.bestMonths),
    destination.timezone ? quote(destination.timezone) : 'null',
  ].join(', ')})`;
}

/**
 * État du catalogue tel que les migrations déjà écrites le décrivent : chaque
 * migration de seed écrase la précédente, ligne par ligne.
 */
function etatDeja(): Map<string, string> {
  const connu = new Map<string, string>();
  const fichiers = readdirSync(MIGRATIONS)
    .filter((nom) => nom.endsWith(SUFFIXE))
    .sort();
  for (const nom of fichiers) {
    for (const ligne of readFileSync(join(MIGRATIONS, nom), 'utf8').split('\n')) {
      const nettoyee = ligne.trim().replace(/,$/, '');
      const id = /^\('([a-z0-9-]+)',/.exec(nettoyee)?.[1];
      if (id) connu.set(id, nettoyee);
    }
    for (const bloc of readFileSync(join(MIGRATIONS, nom), 'utf8').matchAll(
      /delete from public\.destinations where id in \(([^)]*)\)/g,
    )) {
      for (const id of bloc[1]!.split(',')) connu.delete(id.trim().replace(/'/g, ''));
    }
  }
  return connu;
}

const connu = etatDeja();
const actuel = new Map(DESTINATIONS.map((d) => [d.id, rowFor(d)]));

const modifiees = [...actuel.entries()].filter(([id, ligne]) => connu.get(id) !== ligne);
const retirees = [...connu.keys()].filter((id) => !actuel.has(id));

if (modifiees.length === 0 && retirees.length === 0) {
  console.log(`Catalogue déjà à jour : ${DESTINATIONS.length} destinations, aucune migration à écrire.`);
  process.exit(0);
}

const horodatage = new Date()
  .toISOString()
  .replace(/[-:T]/g, '')
  .slice(0, 14);
const cible = join(MIGRATIONS, `${horodatage}${SUFFIXE}`);
const premiere = connu.size === 0;

const upsert =
  modifiees.length === 0
    ? ''
    : `insert into public.destinations
  (id, name, country, country_code, lat, lng, iata, tags, cost_index, poi_richness, best_months, timezone)
values
${modifiees.map(([, ligne]) => `  ${ligne}`).join(',\n')}
on conflict (id) do update set
  name         = excluded.name,
  country      = excluded.country,
  country_code = excluded.country_code,
  lat          = excluded.lat,
  lng          = excluded.lng,
  iata         = excluded.iata,
  tags         = excluded.tags,
  cost_index   = excluded.cost_index,
  poi_richness = excluded.poi_richness,
  best_months  = excluded.best_months,
  timezone     = excluded.timezone,
  updated_at   = now();
`;

const suppression =
  retirees.length === 0
    ? ''
    : `\n-- Retirées du catalogue. Échoue si un voyage y fait référence, et c'est
-- voulu : on ne supprime pas sous les pieds d'un groupe.
delete from public.destinations where id in (${retirees.map(quote).join(', ')});
`;

const sql = `-- ============================================================================
-- Catalogue de destinations — FICHIER GÉNÉRÉ, NE PAS MODIFIER À LA MAIN.
--
-- Source de vérité : packages/core/src/catalog/destinations.ts
-- Régénérer avec  : pnpm --filter @tripora/core seed:sql
--
-- ${premiere ? `Catalogue initial : ${modifiees.length} destinations.` : `Mise à jour : ${modifiees.length} destination(s) modifiée(s)${retirees.length > 0 ? `, ${retirees.length} retirée(s)` : ''}.`}
--
-- Cette table existe surtout pour que les propositions, les lieux et les votes
-- puissent y faire référence. La logique de suggestion, elle, lit le catalogue
-- directement depuis le code : aucune requête, aucun quota.
-- ============================================================================

${upsert}${suppression}`;

writeFileSync(cible, sql, 'utf8');
console.log(
  `${modifiees.length} destination(s) mise(s) à jour${retirees.length > 0 ? `, ${retirees.length} retirée(s)` : ''} dans ${cible}`,
);
