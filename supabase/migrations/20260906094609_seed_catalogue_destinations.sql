-- ============================================================================
-- Catalogue de destinations — FICHIER GÉNÉRÉ, NE PAS MODIFIER À LA MAIN.
--
-- Source de vérité : packages/core/src/catalog/destinations.ts
-- Régénérer avec  : pnpm --filter @tripora/core seed:sql
--
-- Mise à jour : 1 destination(s) modifiée(s).
--
-- Cette table existe surtout pour que les propositions, les lieux et les votes
-- puissent y faire référence. La logique de suggestion, elle, lit le catalogue
-- directement depuis le code : aucune requête, aucun quota.
-- ============================================================================

insert into public.destinations
  (id, name, country, country_code, lat, lng, iata, tags, cost_index, poi_richness, best_months, timezone)
values
  ('tenerife', 'Tenerife', 'Espagne', 'ES', 28.0916, -16.7247, '{TCI,TFS,TFN}', '{"culture":0.3,"nature":0.95,"food":0.65,"nightlife":0.7,"relax":0.95,"adventure":0.9,"shopping":0.4,"offbeat":0.5}'::jsonb, 0.8, 0.7, '{1,2,3,4,5,6,9,10,11,12}', 'Atlantic/Canary')
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
