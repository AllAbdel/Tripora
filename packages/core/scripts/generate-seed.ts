/**
 * Écrit la migration qui remplit la table `destinations` à partir du catalogue
 * TypeScript, qui reste la seule source de vérité.
 *
 *   pnpm --filter @tripora/core seed:sql
 *
 * La migration produite est versionnée : personne n'a besoin de lancer ce
 * script pour déployer, seulement pour le régénérer après avoir corrigé une
 * note du catalogue.
 */
import { writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DESTINATIONS } from '../src/catalog/destinations.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const TARGET = resolve(HERE, '../../../supabase/migrations/20260906070002_seed_destinations.sql');

/** Échappement SQL par doublement de l'apostrophe. Aucune valeur ne vient d'un utilisateur. */
const quote = (value: string): string => `'${value.replace(/'/g, "''")}'`;
const array = (values: readonly (string | number)[]): string =>
  values.length === 0 ? "'{}'" : `'{${values.join(',')}}'`;

const rows = DESTINATIONS.map((d) =>
  [
    quote(d.id),
    quote(d.name),
    quote(d.country),
    quote(d.countryCode),
    d.lat,
    d.lng,
    array(d.iata),
    `${quote(JSON.stringify(d.tags))}::jsonb`,
    d.costIndex,
    d.poiRichness,
    array(d.bestMonths),
    d.timezone ? quote(d.timezone) : 'null',
  ].join(', '),
).map((values) => `  (${values})`);

const sql = `-- ============================================================================
-- Catalogue de destinations — FICHIER GÉNÉRÉ, NE PAS MODIFIER À LA MAIN.
--
-- Source de vérité : packages/core/src/catalog/destinations.ts
-- Régénérer avec  : pnpm --filter @tripora/core seed:sql
--
-- Cette table existe surtout pour que les propositions, les lieux et les votes
-- puissent y faire référence. La logique de suggestion, elle, lit le catalogue
-- directement depuis le code : aucune requête, aucun quota.
-- ============================================================================

insert into public.destinations
  (id, name, country, country_code, lat, lng, iata, tags, cost_index, poi_richness, best_months, timezone)
values
${rows.join(',\n')}
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

writeFileSync(TARGET, sql, 'utf8');
console.log(`${DESTINATIONS.length} destinations écrites dans ${TARGET}`);
