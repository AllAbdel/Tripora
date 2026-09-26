-- ============================================================================
-- Catalogue de destinations — FICHIER GÉNÉRÉ, NE PAS MODIFIER À LA MAIN.
--
-- Source de vérité : packages/core/src/catalog/destinations.ts
-- Régénérer avec  : pnpm --filter @tripora/core seed:sql
--
-- Mise à jour : 2 destination(s) modifiée(s).
--
-- Cette table existe surtout pour que les propositions, les lieux et les votes
-- puissent y faire référence. La logique de suggestion, elle, lit le catalogue
-- directement depuis le code : aucune requête, aucun quota.
-- ============================================================================

insert into public.destinations
  (id, name, country, country_code, lat, lng, iata, tags, cost_index, poi_richness, best_months, timezone)
values
  ('abha', 'Abha et l’Asir', 'Arabie saoudite', 'SA', 18.2169, 42.5053, '{AHB}', '{"culture":0.75,"nature":0.95,"food":0.65,"nightlife":0.15,"relax":0.8,"adventure":0.8,"shopping":0.35,"offbeat":0.95}'::jsonb, 0.75, 0.4, '{6,7,9,10,11}', 'Asia/Riyadh'),
  ('al-ahsa', 'L’oasis d’Al-Ahsa', 'Arabie saoudite', 'SA', 25.383, 49.587, '{HOF}', '{"culture":0.85,"nature":0.8,"food":0.7,"nightlife":0.1,"relax":0.6,"adventure":0.5,"shopping":0.5,"offbeat":0.95}'::jsonb, 0.7, 0.45, '{11,12,1,2,3}', 'Asia/Riyadh')
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
