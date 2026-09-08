-- ============================================================================
-- Catalogue de destinations — FICHIER GÉNÉRÉ, NE PAS MODIFIER À LA MAIN.
--
-- Source de vérité : packages/core/src/catalog/destinations.ts
-- Régénérer avec  : pnpm --filter @tripora/core seed:sql
--
-- Mise à jour : 23 destination(s) modifiée(s).
--
-- Cette table existe surtout pour que les propositions, les lieux et les votes
-- puissent y faire référence. La logique de suggestion, elle, lit le catalogue
-- directement depuis le code : aucune requête, aucun quota.
-- ============================================================================

insert into public.destinations
  (id, name, country, country_code, lat, lng, iata, tags, cost_index, poi_richness, best_months, timezone)
values
  ('chisinau', 'Chișinău et les caves', 'Moldavie', 'MD', 47.0105, 28.8638, '{KIV}', '{"culture":0.7,"nature":0.5,"food":0.85,"nightlife":0.55,"relax":0.5,"adventure":0.35,"shopping":0.3,"offbeat":0.9}'::jsonb, 0.45, 0.5, '{5,6,9,10}', 'Europe/Chisinau'),
  ('ruta-de-las-flores', 'Ruta de las Flores', 'Salvador', 'SV', 13.86, -89.79, '{SAL}', '{"culture":0.65,"nature":0.9,"food":0.8,"nightlife":0.35,"relax":0.7,"adventure":0.9,"shopping":0.3,"offbeat":0.9}'::jsonb, 0.55, 0.55, '{11,12,1,2,3}', 'America/El_Salvador'),
  ('tobago', 'Tobago', 'Trinité-et-Tobago', 'TT', 11.18, -60.74, '{TAB,POS}', '{"culture":0.55,"nature":0.9,"food":0.8,"nightlife":0.6,"relax":0.95,"adventure":0.75,"shopping":0.25,"offbeat":0.75}'::jsonb, 0.95, 0.45, '{1,2,3,4,5}', 'America/Port_of_Spain'),
  ('soufriere-sainte-lucie', 'Soufrière et les Pitons', 'Sainte-Lucie', 'LC', 13.8566, -61.057, '{UVF}', '{"culture":0.4,"nature":1,"food":0.7,"nightlife":0.35,"relax":0.95,"adventure":0.85,"shopping":0.2,"offbeat":0.6}'::jsonb, 1.15, 0.45, '{12,1,2,3,4}', 'America/St_Lucia'),
  ('english-harbour', 'English Harbour', 'Antigua-et-Barbuda', 'AG', 17.0064, -61.7644, '{ANU}', '{"culture":0.5,"nature":0.85,"food":0.65,"nightlife":0.5,"relax":0.95,"adventure":0.7,"shopping":0.25,"offbeat":0.55}'::jsonb, 1.2, 0.4, '{12,1,2,3,4}', 'America/Antigua'),
  ('saint-georges-grenade', 'Saint-Georges', 'Grenade', 'GD', 12.0561, -61.7486, '{GND}', '{"culture":0.55,"nature":0.9,"food":0.85,"nightlife":0.4,"relax":0.9,"adventure":0.75,"shopping":0.25,"offbeat":0.8}'::jsonb, 0.95, 0.45, '{1,2,3,4,5}', 'America/Grenada'),
  ('aruba', 'Aruba', 'Aruba', 'AW', 12.5211, -69.9683, '{AUA}', '{"culture":0.4,"nature":0.75,"food":0.7,"nightlife":0.7,"relax":1,"adventure":0.65,"shopping":0.5,"offbeat":0.45}'::jsonb, 1.15, 0.4, '{1,2,3,4,5,6}', 'America/Aruba'),
  ('bandar-seri-begawan', 'Bandar Seri Begawan', 'Brunei', 'BN', 4.9031, 114.9398, '{BWN}', '{"culture":0.75,"nature":0.9,"food":0.7,"nightlife":0.1,"relax":0.5,"adventure":0.7,"shopping":0.35,"offbeat":0.95}'::jsonb, 0.75, 0.45, '{1,2,3,6,7,8}', 'Asia/Brunei'),
  ('sundarbans', 'Les Sundarbans', 'Bangladesh', 'BD', 22.15, 89.5, '{DAC}', '{"culture":0.5,"nature":1,"food":0.7,"nightlife":0.1,"relax":0.4,"adventure":0.95,"shopping":0.2,"offbeat":1}'::jsonb, 0.4, 0.5, '{11,12,1,2}', 'Asia/Dhaka'),
  ('pamir', 'Douchanbé et le Pamir', 'Tadjikistan', 'TJ', 38.5598, 68.787, '{DYU}', '{"culture":0.6,"nature":1,"food":0.55,"nightlife":0.15,"relax":0.3,"adventure":1,"shopping":0.2,"offbeat":1}'::jsonb, 0.4, 0.55, '{6,7,8,9}', 'Asia/Dushanbe'),
  ('lesotho', 'Maseru et les hauts plateaux', 'Lesotho', 'LS', -29.31, 27.48, '{MSU}', '{"culture":0.6,"nature":1,"food":0.4,"nightlife":0.1,"relax":0.4,"adventure":1,"shopping":0.15,"offbeat":1}'::jsonb, 0.5, 0.45, '{3,4,5,9,10,11}', 'Africa/Maseru'),
  ('eswatini', 'Eswatini', 'Eswatini', 'SZ', -26.3054, 31.1367, '{SHO}', '{"culture":0.75,"nature":0.95,"food":0.45,"nightlife":0.15,"relax":0.55,"adventure":0.85,"shopping":0.3,"offbeat":0.95}'::jsonb, 0.5, 0.45, '{4,5,6,8,9,10}', 'Africa/Mbabane'),
  ('saint-pierre-et-miquelon', 'Saint-Pierre-et-Miquelon', 'France', 'PM', 46.7811, -56.1764, '{FSP}', '{"culture":0.75,"nature":0.9,"food":0.75,"nightlife":0.25,"relax":0.65,"adventure":0.6,"shopping":0.2,"offbeat":1}'::jsonb, 1, 0.4, '{6,7,8,9}', 'America/Miquelon'),
  ('saint-barthelemy', 'Saint-Barthélemy', 'France', 'BL', 17.9, -62.8333, '{SBH}', '{"culture":0.35,"nature":0.8,"food":0.9,"nightlife":0.6,"relax":1,"adventure":0.5,"shopping":0.6,"offbeat":0.5}'::jsonb, 1.7, 0.35, '{12,1,2,3,4}', 'America/St_Barthelemy'),
  ('mayotte', 'Mayotte', 'France', 'YT', -12.7806, 45.2278, '{DZA}', '{"culture":0.6,"nature":1,"food":0.55,"nightlife":0.2,"relax":0.85,"adventure":0.9,"shopping":0.2,"offbeat":0.95}'::jsonb, 0.9, 0.45, '{5,6,7,8,9,10}', 'Indian/Mayotte'),
  ('gibraltar', 'Gibraltar', 'Gibraltar', 'GI', 36.1408, -5.3536, '{GIB}', '{"culture":0.7,"nature":0.7,"food":0.6,"nightlife":0.4,"relax":0.5,"adventure":0.55,"shopping":0.55,"offbeat":0.7}'::jsonb, 0.95, 0.4, '{4,5,6,9,10}', 'Europe/Gibraltar'),
  ('kribi', 'Kribi et les chutes de la Lobé', 'Cameroun', 'CM', 2.9333, 9.9167, '{DLA}', '{"culture":0.5,"nature":0.95,"food":0.65,"nightlife":0.3,"relax":0.9,"adventure":0.8,"shopping":0.2,"offbeat":1}'::jsonb, 0.55, 0.4, '{12,1,2,6,7,8}', 'Africa/Douala'),
  ('assinie', 'Abidjan et Assinie', 'Côte d’Ivoire', 'CI', 5.36, -4.0083, '{ABJ}', '{"culture":0.6,"nature":0.75,"food":0.8,"nightlife":0.8,"relax":0.85,"adventure":0.6,"shopping":0.35,"offbeat":0.9}'::jsonb, 0.6, 0.5, '{12,1,2,7,8}', 'Africa/Abidjan'),
  ('ouidah', 'Ouidah et les cités lacustres', 'Bénin', 'BJ', 6.3667, 2.0833, '{COO}', '{"culture":0.95,"nature":0.7,"food":0.6,"nightlife":0.3,"relax":0.55,"adventure":0.7,"shopping":0.3,"offbeat":1}'::jsonb, 0.5, 0.5, '{11,12,1,2}', 'Africa/Porto-Novo'),
  ('loango', 'Libreville et Loango', 'Gabon', 'GA', 0.3901, 9.4544, '{LBV}', '{"culture":0.35,"nature":1,"food":0.5,"nightlife":0.25,"relax":0.6,"adventure":1,"shopping":0.15,"offbeat":1}'::jsonb, 0.95, 0.45, '{6,7,8,9}', 'Africa/Libreville'),
  ('paramaribo', 'Paramaribo', 'Suriname', 'SR', 5.852, -55.2038, '{PBM}', '{"culture":0.85,"nature":0.95,"food":0.85,"nightlife":0.35,"relax":0.5,"adventure":0.9,"shopping":0.25,"offbeat":1}'::jsonb, 0.6, 0.5, '{2,3,8,9,10,11}', 'America/Paramaribo'),
  ('atauro', 'Atauro et Dili', 'Timor oriental', 'TL', -8.2333, 125.6, '{DIL}', '{"culture":0.5,"nature":1,"food":0.5,"nightlife":0.15,"relax":0.8,"adventure":0.95,"shopping":0.15,"offbeat":1}'::jsonb, 0.6, 0.4, '{5,6,7,8,9,10}', 'Asia/Dili'),
  ('asuncion', 'Asunción et les missions', 'Paraguay', 'PY', -25.2637, -57.5759, '{ASU}', '{"culture":0.8,"nature":0.6,"food":0.65,"nightlife":0.45,"relax":0.4,"adventure":0.5,"shopping":0.3,"offbeat":1}'::jsonb, 0.45, 0.5, '{4,5,6,7,8,9}', 'America/Asuncion')
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
