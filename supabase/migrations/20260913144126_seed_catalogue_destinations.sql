-- ============================================================================
-- Catalogue de destinations — FICHIER GÉNÉRÉ, NE PAS MODIFIER À LA MAIN.
--
-- Source de vérité : packages/core/src/catalog/destinations.ts
-- Régénérer avec  : pnpm --filter @tripora/core seed:sql
--
-- Mise à jour : 17 destination(s) modifiée(s).
--
-- Cette table existe surtout pour que les propositions, les lieux et les votes
-- puissent y faire référence. La logique de suggestion, elle, lit le catalogue
-- directement depuis le code : aucune requête, aucun quota.
-- ============================================================================

insert into public.destinations
  (id, name, country, country_code, lat, lng, iata, tags, cost_index, poi_richness, best_months, timezone)
values
  ('grand-cayman', 'Grand Cayman', 'Îles Caïmans', 'KY', 19.3133, -81.2546, '{GCM}', '{"culture":0.3,"nature":0.9,"food":0.75,"nightlife":0.5,"relax":1,"adventure":0.85,"shopping":0.45,"offbeat":0.55}'::jsonb, 1.55, 0.45, '{11,12,1,2,3,4}', 'America/Cayman'),
  ('providenciales', 'Providenciales et Grace Bay', 'Îles Turques-et-Caïques', 'TC', 21.7736, -72.2661, '{PLS}', '{"culture":0.2,"nature":0.95,"food":0.7,"nightlife":0.4,"relax":1,"adventure":0.75,"shopping":0.3,"offbeat":0.6}'::jsonb, 1.5, 0.35, '{11,12,1,2,3,4,5}', 'America/Grand_Turk'),
  ('tortola', 'Tortola et les Îles Vierges', 'Îles Vierges britanniques', 'VG', 18.4286, -64.6185, '{EIS,STT}', '{"culture":0.3,"nature":0.95,"food":0.65,"nightlife":0.5,"relax":1,"adventure":0.9,"shopping":0.25,"offbeat":0.7}'::jsonb, 1.4, 0.4, '{12,1,2,3,4,5}', 'America/Tortola'),
  ('roseau', 'Roseau et la Dominique', 'Dominique', 'DM', 15.3092, -61.379, '{DOM}', '{"culture":0.5,"nature":1,"food":0.6,"nightlife":0.25,"relax":0.7,"adventure":1,"shopping":0.15,"offbeat":0.95}'::jsonb, 0.8, 0.5, '{12,1,2,3,4}', 'America/Dominica'),
  ('bequia', 'Bequia et les Grenadines', 'Saint-Vincent-et-les-Grenadines', 'VC', 13.008, -61.227, '{SVD}', '{"culture":0.45,"nature":0.95,"food":0.65,"nightlife":0.4,"relax":1,"adventure":0.85,"shopping":0.2,"offbeat":0.9}'::jsonb, 0.95, 0.4, '{12,1,2,3,4,5}', 'America/St_Vincent'),
  ('basseterre', 'Basseterre et Saint-Kitts', 'Saint-Christophe-et-Niévès', 'KN', 17.2955, -62.725, '{SKB}', '{"culture":0.7,"nature":0.9,"food":0.65,"nightlife":0.45,"relax":0.95,"adventure":0.8,"shopping":0.25,"offbeat":0.85}'::jsonb, 1, 0.45, '{12,1,2,3,4}', 'America/St_Kitts'),
  ('bermudes', 'Hamilton et les Bermudes', 'Bermudes', 'BM', 32.2949, -64.7814, '{BDA}', '{"culture":0.6,"nature":0.9,"food":0.7,"nightlife":0.45,"relax":0.95,"adventure":0.8,"shopping":0.4,"offbeat":0.7}'::jsonb, 1.7, 0.5, '{5,6,7,8,9,10}', 'Atlantic/Bermuda'),
  ('honiara', 'Honiara et les Salomon', 'Îles Salomon', 'SB', -9.4456, 159.9729, '{HIR}', '{"culture":0.6,"nature":1,"food":0.5,"nightlife":0.2,"relax":0.8,"adventure":1,"shopping":0.15,"offbeat":1}'::jsonb, 0.85, 0.4, '{5,6,7,8,9,10}', 'Pacific/Guadalcanal'),
  ('rabaul', 'Rabaul et la Nouvelle-Bretagne', 'Papouasie-Nouvelle-Guinée', 'PG', -4.199, 152.1637, '{RAB,POM}', '{"culture":0.7,"nature":1,"food":0.45,"nightlife":0.15,"relax":0.55,"adventure":1,"shopping":0.15,"offbeat":1}'::jsonb, 0.9, 0.45, '{5,6,7,8,9,10}', 'Pacific/Port_Moresby'),
  ('chuuk', 'Chuuk et son lagon', 'Micronésie', 'FM', 7.4467, 151.8431, '{TKK}', '{"culture":0.4,"nature":1,"food":0.45,"nightlife":0.15,"relax":0.75,"adventure":1,"shopping":0.1,"offbeat":1}'::jsonb, 1, 0.3, '{12,1,2,3,4}', 'Pacific/Chuuk'),
  ('tarawa', 'Tarawa et Kiribati', 'Kiribati', 'KI', 1.3291, 172.979, '{TRW}', '{"culture":0.6,"nature":0.95,"food":0.4,"nightlife":0.1,"relax":0.8,"adventure":0.9,"shopping":0.1,"offbeat":1}'::jsonb, 0.95, 0.25, '{5,6,7,8,9,10}', 'Pacific/Tarawa'),
  ('niue', 'Alofi et Niue', 'Niue', 'NU', -19.0554, -169.9187, '{IUE}', '{"culture":0.45,"nature":1,"food":0.5,"nightlife":0.1,"relax":0.95,"adventure":1,"shopping":0.1,"offbeat":1}'::jsonb, 1.05, 0.3, '{7,8,9,10}', 'Pacific/Niue'),
  ('wallis', 'Wallis et Futuna', 'Wallis-et-Futuna', 'WF', -13.2825, -176.1745, '{WLS}', '{"culture":0.8,"nature":0.95,"food":0.55,"nightlife":0.1,"relax":0.9,"adventure":0.8,"shopping":0.1,"offbeat":1}'::jsonb, 1.1, 0.3, '{5,6,7,8,9}', 'Pacific/Wallis'),
  ('kaieteur', 'Georgetown et le Kaieteur', 'Guyana', 'GY', 6.8013, -58.1551, '{GEO}', '{"culture":0.6,"nature":1,"food":0.6,"nightlife":0.3,"relax":0.4,"adventure":1,"shopping":0.2,"offbeat":1}'::jsonb, 0.6, 0.5, '{2,3,4,9,10,11}', 'America/Guyana'),
  ('lome', 'Lomé et le pays tamberma', 'Togo', 'TG', 6.1319, 1.2228, '{LFW}', '{"culture":0.9,"nature":0.7,"food":0.65,"nightlife":0.5,"relax":0.5,"adventure":0.8,"shopping":0.45,"offbeat":1}'::jsonb, 0.45, 0.55, '{11,12,1,2}', 'Africa/Lome'),
  ('banjul', 'Banjul et le fleuve Gambie', 'Gambie', 'GM', 13.4549, -16.579, '{BJL}', '{"culture":0.75,"nature":0.9,"food":0.6,"nightlife":0.45,"relax":0.8,"adventure":0.75,"shopping":0.4,"offbeat":0.95}'::jsonb, 0.5, 0.5, '{11,12,1,2,3}', 'Africa/Banjul'),
  ('achgabat', 'Achgabat et le Darvaza', 'Turkménistan', 'TM', 37.9601, 58.3261, '{ASB}', '{"culture":0.85,"nature":0.8,"food":0.55,"nightlife":0.15,"relax":0.3,"adventure":0.95,"shopping":0.3,"offbeat":1}'::jsonb, 0.5, 0.5, '{4,5,9,10}', 'Asia/Ashgabat')
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
