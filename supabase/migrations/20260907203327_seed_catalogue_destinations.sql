-- ============================================================================
-- Catalogue de destinations — FICHIER GÉNÉRÉ, NE PAS MODIFIER À LA MAIN.
--
-- Source de vérité : packages/core/src/catalog/destinations.ts
-- Régénérer avec  : pnpm --filter @tripora/core seed:sql
--
-- Mise à jour : 64 destination(s) modifiée(s).
--
-- Cette table existe surtout pour que les propositions, les lieux et les votes
-- puissent y faire référence. La logique de suggestion, elle, lit le catalogue
-- directement depuis le code : aucune requête, aucun quota.
-- ============================================================================

insert into public.destinations
  (id, name, country, country_code, lat, lng, iata, tags, cost_index, poi_richness, best_months, timezone)
values
  ('feroe', 'Îles Féroé', 'Îles Féroé', 'FO', 62.0079, -6.7908, '{FAE}', '{"culture":0.5,"nature":1,"food":0.6,"nightlife":0.2,"relax":0.7,"adventure":1,"shopping":0.15,"offbeat":1}'::jsonb, 1.45, 0.5, '{6,7,8,9}', 'Atlantic/Faroe'),
  ('groenland', 'Groenland — Nuuk', 'Groenland', 'GL', 64.1836, -51.7214, '{GOH}', '{"culture":0.6,"nature":1,"food":0.5,"nightlife":0.15,"relax":0.5,"adventure":1,"shopping":0.15,"offbeat":1}'::jsonb, 1.6, 0.45, '{6,7,8,9}', 'America/Nuuk'),
  ('svalbard', 'Svalbard', 'Svalbard', 'SJ', 78.2232, 15.6267, '{LYR}', '{"culture":0.35,"nature":1,"food":0.5,"nightlife":0.15,"relax":0.4,"adventure":1,"shopping":0.15,"offbeat":1}'::jsonb, 1.7, 0.4, '{3,6,7,8,9}', 'Arctic/Longyearbyen'),
  ('skye', 'Île de Skye', 'Royaume-Uni', 'GB', 57.4125, -6.1897, '{INV}', '{"culture":0.4,"nature":1,"food":0.6,"nightlife":0.15,"relax":0.75,"adventure":1,"shopping":0.15,"offbeat":0.85}'::jsonb, 1.1, 0.5, '{5,6,7,8,9}', 'Europe/London'),
  ('shetland', 'Shetland', 'Royaume-Uni', 'GB', 60.1553, -1.1494, '{LSI}', '{"culture":0.55,"nature":1,"food":0.6,"nightlife":0.2,"relax":0.7,"adventure":0.95,"shopping":0.15,"offbeat":1}'::jsonb, 1.15, 0.45, '{5,6,7,8}', 'Europe/London'),
  ('jersey', 'Jersey', 'Jersey', 'JE', 49.2144, -2.1313, '{JER}', '{"culture":0.6,"nature":0.9,"food":0.8,"nightlife":0.4,"relax":0.9,"adventure":0.6,"shopping":0.5,"offbeat":0.7}'::jsonb, 1.3, 0.5, '{5,6,7,8,9}', 'Europe/Jersey'),
  ('ile-de-man', 'Île de Man', 'Île de Man', 'IM', 54.1509, -4.4814, '{IOM}', '{"culture":0.6,"nature":0.9,"food":0.6,"nightlife":0.35,"relax":0.8,"adventure":0.8,"shopping":0.3,"offbeat":0.9}'::jsonb, 1.15, 0.45, '{5,6,7,8,9}', 'Europe/Isle_of_Man'),
  ('saint-marin', 'Saint-Marin', 'Saint-Marin', 'SM', 43.9424, 12.4578, '{RMI,BLQ}', '{"culture":0.85,"nature":0.6,"food":0.8,"nightlife":0.3,"relax":0.7,"adventure":0.35,"shopping":0.5,"offbeat":0.8}'::jsonb, 1, 0.45, '{4,5,6,9,10}', 'Europe/Rome'),
  ('liechtenstein', 'Liechtenstein', 'Liechtenstein', 'LI', 47.141, 9.5209, '{ZRH}', '{"culture":0.6,"nature":0.95,"food":0.65,"nightlife":0.2,"relax":0.75,"adventure":0.9,"shopping":0.4,"offbeat":0.9}'::jsonb, 1.85, 0.4, '{5,6,7,8,9}', 'Europe/Zurich'),
  ('aland', 'Åland', 'Finlande', 'FI', 60.0971, 19.9348, '{MHQ,HEL}', '{"culture":0.5,"nature":0.95,"food":0.7,"nightlife":0.25,"relax":0.95,"adventure":0.7,"shopping":0.25,"offbeat":0.9}'::jsonb, 1.2, 0.4, '{6,7,8}', 'Europe/Helsinki'),
  ('sendai', 'Sendai et le Tōhoku', 'Japon', 'JP', 38.2682, 140.8694, '{SDJ}', '{"culture":0.75,"nature":0.9,"food":0.85,"nightlife":0.5,"relax":0.7,"adventure":0.8,"shopping":0.5,"offbeat":0.9}'::jsonb, 0.95, 0.55, '{4,5,9,10,11}', 'Asia/Tokyo'),
  ('suzhou', 'Suzhou', 'Chine', 'CN', 31.2989, 120.5853, '{SHA,PVG}', '{"culture":0.95,"nature":0.8,"food":0.85,"nightlife":0.4,"relax":0.85,"adventure":0.35,"shopping":0.55,"offbeat":0.8}'::jsonb, 0.6, 0.6, '{3,4,5,9,10,11}', 'Asia/Shanghai'),
  ('qingdao', 'Qingdao', 'Chine', 'CN', 36.0671, 120.3826, '{TAO}', '{"culture":0.6,"nature":0.8,"food":0.9,"nightlife":0.65,"relax":0.85,"adventure":0.5,"shopping":0.5,"offbeat":0.85}'::jsonb, 0.6, 0.5, '{5,6,9,10}', 'Asia/Shanghai'),
  ('harbin', 'Harbin', 'Chine', 'CN', 45.8038, 126.5349, '{HRB}', '{"culture":0.8,"nature":0.7,"food":0.75,"nightlife":0.5,"relax":0.4,"adventure":0.85,"shopping":0.4,"offbeat":0.95}'::jsonb, 0.5, 0.5, '{1,2,7,8,9}', 'Asia/Shanghai'),
  ('kaohsiung', 'Kaohsiung', 'Taïwan', 'TW', 22.6273, 120.3014, '{KHH}', '{"culture":0.7,"nature":0.8,"food":0.95,"nightlife":0.7,"relax":0.85,"adventure":0.6,"shopping":0.6,"offbeat":0.85}'::jsonb, 0.7, 0.55, '{10,11,12,3,4}', 'Asia/Taipei'),
  ('chiang-rai', 'Chiang Rai et Pai', 'Thaïlande', 'TH', 19.9105, 99.8406, '{CEI}', '{"culture":0.85,"nature":0.95,"food":0.9,"nightlife":0.45,"relax":0.9,"adventure":0.9,"shopping":0.4,"offbeat":0.9}'::jsonb, 0.35, 0.55, '{11,12,1,2}', 'Asia/Bangkok'),
  ('koh-chang', 'Koh Chang', 'Thaïlande', 'TH', 12.05, 102.3167, '{TDX,BKK}', '{"culture":0.25,"nature":1,"food":0.8,"nightlife":0.5,"relax":1,"adventure":0.85,"shopping":0.25,"offbeat":0.8}'::jsonb, 0.4, 0.45, '{11,12,1,2,3}', 'Asia/Bangkok'),
  ('dalat', 'Đà Lạt', 'Viêt Nam', 'VN', 11.9404, 108.4583, '{DLI}', '{"culture":0.6,"nature":0.95,"food":0.85,"nightlife":0.4,"relax":0.9,"adventure":0.9,"shopping":0.4,"offbeat":0.9}'::jsonb, 0.32, 0.5, '{11,12,1,2,3}', 'Asia/Ho_Chi_Minh'),
  ('vang-vieng', 'Vang Vieng', 'Laos', 'LA', 18.9236, 102.4479, '{VTE}', '{"culture":0.4,"nature":1,"food":0.7,"nightlife":0.6,"relax":0.85,"adventure":1,"shopping":0.25,"offbeat":0.9}'::jsonb, 0.35, 0.45, '{11,12,1,2}', 'Asia/Vientiane'),
  ('sumatra', 'Sumatra — Medan et le lac Toba', 'Indonésie', 'ID', 3.5952, 98.6722, '{KNO}', '{"culture":0.7,"nature":1,"food":0.8,"nightlife":0.3,"relax":0.8,"adventure":1,"shopping":0.3,"offbeat":1}'::jsonb, 0.35, 0.55, '{5,6,7,8,9}', 'Asia/Jakarta'),
  ('sulawesi', 'Sulawesi — Makassar et Toraja', 'Indonésie', 'ID', -5.1477, 119.4327, '{UPG}', '{"culture":0.9,"nature":0.95,"food":0.8,"nightlife":0.3,"relax":0.75,"adventure":0.95,"shopping":0.3,"offbeat":1}'::jsonb, 0.35, 0.5, '{5,6,7,8,9}', 'Asia/Makassar'),
  ('raja-ampat', 'Raja Ampat', 'Indonésie', 'ID', -0.5, 130.5, '{SOQ}', '{"culture":0.3,"nature":1,"food":0.6,"nightlife":0.15,"relax":0.9,"adventure":1,"shopping":0.1,"offbeat":1}'::jsonb, 0.7, 0.45, '{10,11,12,1,2,3,4}', 'Asia/Jayapura'),
  ('siargao', 'Siargao', 'Philippines', 'PH', 9.8482, 126.0458, '{IAO}', '{"culture":0.25,"nature":1,"food":0.7,"nightlife":0.6,"relax":0.95,"adventure":1,"shopping":0.2,"offbeat":0.9}'::jsonb, 0.45, 0.45, '{3,4,5,9,10,11}', 'Asia/Manila'),
  ('hampi', 'Hampi', 'Inde', 'IN', 15.335, 76.46, '{HBX,BLR}', '{"culture":1,"nature":0.85,"food":0.7,"nightlife":0.2,"relax":0.75,"adventure":0.85,"shopping":0.3,"offbeat":1}'::jsonb, 0.32, 0.5, '{11,12,1,2}', 'Asia/Kolkata'),
  ('darjeeling', 'Darjeeling', 'Inde', 'IN', 27.041, 88.2663, '{IXB}', '{"culture":0.75,"nature":1,"food":0.8,"nightlife":0.2,"relax":0.85,"adventure":0.9,"shopping":0.35,"offbeat":0.95}'::jsonb, 0.32, 0.5, '{3,4,5,10,11}', 'Asia/Kolkata'),
  ('rishikesh', 'Rishikesh', 'Inde', 'IN', 30.0869, 78.2676, '{DED}', '{"culture":0.85,"nature":0.95,"food":0.7,"nightlife":0.2,"relax":0.95,"adventure":0.95,"shopping":0.35,"offbeat":0.9}'::jsonb, 0.32, 0.5, '{2,3,4,9,10,11}', 'Asia/Kolkata'),
  ('paro-bhoutan', 'Paro et le Bhoutan', 'Bhoutan', 'BT', 27.4287, 89.4165, '{PBH}', '{"culture":1,"nature":1,"food":0.65,"nightlife":0.1,"relax":0.75,"adventure":0.95,"shopping":0.25,"offbeat":1}'::jsonb, 1.1, 0.55, '{3,4,5,9,10,11}', 'Asia/Thimphu'),
  ('khiva', 'Khiva', 'Ouzbékistan', 'UZ', 41.3775, 60.3619, '{UGC,TAS}', '{"culture":1,"nature":0.35,"food":0.7,"nightlife":0.15,"relax":0.6,"adventure":0.6,"shopping":0.5,"offbeat":1}'::jsonb, 0.38, 0.45, '{4,5,9,10}', 'Asia/Samarkand'),
  ('salalah', 'Salalah', 'Oman', 'OM', 17.0151, 54.0924, '{SLL}', '{"culture":0.65,"nature":0.95,"food":0.65,"nightlife":0.2,"relax":0.9,"adventure":0.9,"shopping":0.35,"offbeat":0.95}'::jsonb, 0.85, 0.45, '{7,8,9,11,12,1,2}', 'Asia/Muscat'),
  ('kampala', 'Kampala et les sources du Nil', 'Ouganda', 'UG', 0.3476, 32.5825, '{EBB}', '{"culture":0.7,"nature":1,"food":0.7,"nightlife":0.7,"relax":0.55,"adventure":1,"shopping":0.35,"offbeat":0.95}'::jsonb, 0.5, 0.6, '{6,7,8,12,1,2}', 'Africa/Kampala'),
  ('livingstone', 'Livingstone', 'Zambie', 'ZM', -17.8419, 25.8543, '{LVI}', '{"culture":0.4,"nature":1,"food":0.6,"nightlife":0.4,"relax":0.65,"adventure":1,"shopping":0.25,"offbeat":0.9}'::jsonb, 0.6, 0.5, '{5,6,7,8,9}', 'Africa/Lusaka'),
  ('okavango', 'Delta de l’Okavango', 'Botswana', 'BW', -19.9833, 23.4167, '{MUB}', '{"culture":0.35,"nature":1,"food":0.6,"nightlife":0.15,"relax":0.7,"adventure":1,"shopping":0.15,"offbeat":0.95}'::jsonb, 0.9, 0.5, '{5,6,7,8,9,10}', 'Africa/Gaborone'),
  ('malawi', 'Lac Malawi', 'Malawi', 'MW', -13.9626, 33.7741, '{LLW}', '{"culture":0.5,"nature":1,"food":0.6,"nightlife":0.3,"relax":0.95,"adventure":0.9,"shopping":0.2,"offbeat":1}'::jsonb, 0.45, 0.45, '{5,6,7,8,9}', 'Africa/Blantyre'),
  ('mozambique', 'Archipel de Bazaruto', 'Mozambique', 'MZ', -21.8333, 35.4667, '{VNX,MPM}', '{"culture":0.4,"nature":1,"food":0.75,"nightlife":0.3,"relax":1,"adventure":0.9,"shopping":0.2,"offbeat":0.95}'::jsonb, 0.6, 0.45, '{5,6,7,8,9,10}', 'Africa/Maputo'),
  ('djibouti', 'Djibouti', 'Djibouti', 'DJ', 11.5721, 43.1456, '{JIB}', '{"culture":0.45,"nature":0.95,"food":0.6,"nightlife":0.3,"relax":0.7,"adventure":1,"shopping":0.25,"offbeat":1}'::jsonb, 0.85, 0.4, '{11,12,1,2,3}', 'Africa/Djibouti'),
  ('sao-tome', 'São Tomé-et-Príncipe', 'São Tomé-et-Príncipe', 'ST', 0.3302, 6.7333, '{TMS}', '{"culture":0.6,"nature":1,"food":0.75,"nightlife":0.3,"relax":0.9,"adventure":0.9,"shopping":0.15,"offbeat":1}'::jsonb, 0.7, 0.45, '{6,7,8,9,1,2}', 'Africa/Sao_Tome'),
  ('comores', 'Comores', 'Comores', 'KM', -11.7172, 43.2473, '{HAH}', '{"culture":0.6,"nature":1,"food":0.7,"nightlife":0.2,"relax":0.9,"adventure":0.9,"shopping":0.2,"offbeat":1}'::jsonb, 0.6, 0.4, '{5,6,9,10,11}', 'Indian/Comoro'),
  ('dakhla', 'Dakhla', 'Maroc', 'MA', 23.6848, -15.958, '{VIL}', '{"culture":0.25,"nature":0.95,"food":0.65,"nightlife":0.35,"relax":0.9,"adventure":1,"shopping":0.2,"offbeat":0.95}'::jsonb, 0.5, 0.4, '{3,4,5,9,10,11}', 'Africa/Casablanca'),
  ('san-antonio', 'San Antonio', 'États-Unis', 'US', 29.4241, -98.4936, '{SAT}', '{"culture":0.8,"nature":0.5,"food":0.9,"nightlife":0.7,"relax":0.6,"adventure":0.45,"shopping":0.5,"offbeat":0.7}'::jsonb, 1.1, 0.6, '{3,4,10,11}', 'America/Chicago'),
  ('memphis', 'Memphis', 'États-Unis', 'US', 35.1495, -90.049, '{MEM}', '{"culture":0.85,"nature":0.4,"food":0.9,"nightlife":0.9,"relax":0.4,"adventure":0.3,"shopping":0.45,"offbeat":0.85}'::jsonb, 1.05, 0.55, '{4,5,9,10}', 'America/Chicago'),
  ('sedona', 'Sedona', 'États-Unis', 'US', 34.8697, -111.761, '{PHX,FLG}', '{"culture":0.45,"nature":1,"food":0.7,"nightlife":0.25,"relax":0.9,"adventure":1,"shopping":0.4,"offbeat":0.75}'::jsonb, 1.3, 0.5, '{3,4,5,9,10}', 'America/Phoenix'),
  ('big-sur', 'Big Sur et Monterey', 'États-Unis', 'US', 36.2704, -121.8081, '{MRY,SFO}', '{"culture":0.35,"nature":1,"food":0.8,"nightlife":0.2,"relax":0.9,"adventure":0.9,"shopping":0.25,"offbeat":0.75}'::jsonb, 1.4, 0.5, '{4,5,9,10}', 'America/Los_Angeles'),
  ('yellowknife', 'Yellowknife', 'Canada', 'CA', 62.454, -114.3718, '{YZF}', '{"culture":0.4,"nature":1,"food":0.55,"nightlife":0.25,"relax":0.5,"adventure":1,"shopping":0.2,"offbeat":1}'::jsonb, 1.3, 0.45, '{1,2,3,8,9,10,11}', 'America/Edmonton'),
  ('terre-neuve', 'Terre-Neuve', 'Canada', 'CA', 47.5615, -52.7126, '{YYT}', '{"culture":0.6,"nature":1,"food":0.75,"nightlife":0.5,"relax":0.7,"adventure":0.95,"shopping":0.25,"offbeat":0.95}'::jsonb, 1.15, 0.5, '{6,7,8,9}', 'America/St_Johns'),
  ('chiapas', 'Chiapas — San Cristóbal', 'Mexique', 'MX', 16.737, -92.6376, '{TGZ}', '{"culture":1,"nature":0.95,"food":0.85,"nightlife":0.5,"relax":0.75,"adventure":0.9,"shopping":0.6,"offbeat":0.95}'::jsonb, 0.4, 0.55, '{11,12,1,2,3,4}', 'America/Mexico_City'),
  ('huatulco', 'Huatulco', 'Mexique', 'MX', 15.769, -96.133, '{HUX}', '{"culture":0.3,"nature":0.95,"food":0.8,"nightlife":0.6,"relax":1,"adventure":0.8,"shopping":0.3,"offbeat":0.75}'::jsonb, 0.55, 0.45, '{11,12,1,2,3,4}', 'America/Mexico_City'),
  ('baja-la-paz', 'La Paz et la mer de Cortés', 'Mexique', 'MX', 24.1426, -110.3128, '{LAP}', '{"culture":0.35,"nature":1,"food":0.8,"nightlife":0.45,"relax":0.9,"adventure":1,"shopping":0.3,"offbeat":0.85}'::jsonb, 0.55, 0.45, '{10,11,12,3,4,5}', 'America/Mazatlan'),
  ('roatan', 'Roatán', 'Honduras', 'HN', 16.3167, -86.5333, '{RTB}', '{"culture":0.3,"nature":1,"food":0.7,"nightlife":0.55,"relax":1,"adventure":1,"shopping":0.25,"offbeat":0.85}'::jsonb, 0.6, 0.45, '{2,3,4,5,8,9}', 'America/Tegucigalpa'),
  ('granada-nicaragua', 'Granada', 'Nicaragua', 'NI', 11.9344, -85.956, '{MGA}', '{"culture":0.9,"nature":0.9,"food":0.75,"nightlife":0.5,"relax":0.8,"adventure":0.9,"shopping":0.35,"offbeat":0.95}'::jsonb, 0.4, 0.5, '{12,1,2,3,4}', 'America/Managua'),
  ('recife', 'Recife et Olinda', 'Brésil', 'BR', -8.0476, -34.877, '{REC}', '{"culture":0.9,"nature":0.85,"food":0.85,"nightlife":0.9,"relax":0.9,"adventure":0.6,"shopping":0.45,"offbeat":0.85}'::jsonb, 0.5, 0.6, '{9,10,11,12,1}', 'America/Recife'),
  ('manaus', 'Manaus et l’Amazonie', 'Brésil', 'BR', -3.119, -60.0217, '{MAO}', '{"culture":0.6,"nature":1,"food":0.7,"nightlife":0.4,"relax":0.5,"adventure":1,"shopping":0.3,"offbeat":1}'::jsonb, 0.55, 0.55, '{6,7,8,9}', 'America/Manaus'),
  ('lencois-maranhenses', 'Lençóis Maranhenses', 'Brésil', 'BR', -2.5297, -43.1275, '{SLZ}', '{"culture":0.3,"nature":1,"food":0.6,"nightlife":0.2,"relax":0.8,"adventure":1,"shopping":0.15,"offbeat":1}'::jsonb, 0.5, 0.45, '{6,7,8,9}', 'America/Fortaleza'),
  ('salta', 'Salta et le Nord-Ouest argentin', 'Argentine', 'AR', -24.7859, -65.4117, '{SLA}', '{"culture":0.85,"nature":1,"food":0.85,"nightlife":0.5,"relax":0.7,"adventure":1,"shopping":0.35,"offbeat":0.95}'::jsonb, 0.4, 0.55, '{3,4,5,9,10,11}', 'America/Argentina/Salta'),
  ('bariloche', 'Bariloche', 'Argentine', 'AR', -41.1335, -71.3103, '{BRC}', '{"culture":0.4,"nature":1,"food":0.8,"nightlife":0.5,"relax":0.8,"adventure":1,"shopping":0.35,"offbeat":0.75}'::jsonb, 0.5, 0.55, '{12,1,2,3,7,8}', 'America/Argentina/Salta'),
  ('valparaiso', 'Valparaíso', 'Chili', 'CL', -33.0472, -71.6127, '{SCL}', '{"culture":0.95,"nature":0.75,"food":0.85,"nightlife":0.8,"relax":0.7,"adventure":0.6,"shopping":0.4,"offbeat":0.95}'::jsonb, 0.6, 0.55, '{11,12,1,2,3}', 'America/Santiago'),
  ('santa-marta', 'Santa Marta et Tayrona', 'Colombie', 'CO', 11.2408, -74.199, '{SMR}', '{"culture":0.55,"nature":1,"food":0.8,"nightlife":0.65,"relax":0.95,"adventure":1,"shopping":0.3,"offbeat":0.85}'::jsonb, 0.45, 0.5, '{12,1,2,3,7,8}', 'America/Bogota'),
  ('cuenca', 'Cuenca', 'Équateur', 'EC', -2.9001, -79.0059, '{CUE,UIO}', '{"culture":0.95,"nature":0.85,"food":0.8,"nightlife":0.45,"relax":0.8,"adventure":0.8,"shopping":0.45,"offbeat":0.9}'::jsonb, 0.45, 0.5, '{6,7,8,12,1}', 'America/Guayaquil'),
  ('iquitos', 'Iquitos et l’Amazonie péruvienne', 'Pérou', 'PE', -3.7437, -73.2516, '{IQT}', '{"culture":0.6,"nature":1,"food":0.75,"nightlife":0.4,"relax":0.5,"adventure":1,"shopping":0.25,"offbeat":1}'::jsonb, 0.4, 0.5, '{6,7,8,9}', 'America/Lima'),
  ('sucre', 'Sucre', 'Bolivie', 'BO', -19.0196, -65.2619, '{SRE,LPB}', '{"culture":0.95,"nature":0.7,"food":0.75,"nightlife":0.45,"relax":0.75,"adventure":0.75,"shopping":0.35,"offbeat":1}'::jsonb, 0.35, 0.5, '{4,5,6,7,8,9}', 'America/La_Paz'),
  ('rarotonga', 'Îles Cook — Rarotonga', 'Îles Cook', 'CK', -21.2367, -159.7777, '{RAR}', '{"culture":0.55,"nature":1,"food":0.7,"nightlife":0.35,"relax":1,"adventure":0.85,"shopping":0.2,"offbeat":0.9}'::jsonb, 1.15, 0.45, '{5,6,7,8,9}', 'Pacific/Rarotonga'),
  ('samoa', 'Samoa', 'Samoa', 'WS', -13.8333, -171.7667, '{APW}', '{"culture":0.7,"nature":1,"food":0.65,"nightlife":0.3,"relax":1,"adventure":0.9,"shopping":0.2,"offbeat":1}'::jsonb, 0.9, 0.45, '{5,6,7,8,9}', 'Pacific/Apia'),
  ('tonga', 'Tonga', 'Tonga', 'TO', -21.1394, -175.2018, '{TBU}', '{"culture":0.65,"nature":1,"food":0.6,"nightlife":0.25,"relax":1,"adventure":0.95,"shopping":0.15,"offbeat":1}'::jsonb, 0.85, 0.4, '{6,7,8,9,10}', 'Pacific/Tongatapu'),
  ('vanuatu', 'Vanuatu', 'Vanuatu', 'VU', -17.7333, 168.3273, '{VLI}', '{"culture":0.65,"nature":1,"food":0.65,"nightlife":0.3,"relax":0.95,"adventure":1,"shopping":0.2,"offbeat":1}'::jsonb, 0.9, 0.45, '{5,6,7,8,9,10}', 'Pacific/Efate'),
  ('palau', 'Palaos', 'Palaos', 'PW', 7.515, 134.5825, '{ROR}', '{"culture":0.4,"nature":1,"food":0.65,"nightlife":0.2,"relax":0.95,"adventure":1,"shopping":0.2,"offbeat":1}'::jsonb, 1.1, 0.45, '{11,12,1,2,3,4}', 'Pacific/Palau')
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
