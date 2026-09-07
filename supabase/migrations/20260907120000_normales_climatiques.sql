-- ============================================================================
-- Les normales climatiques des cinq cents destinations.
--
-- Jusqu'ici elles vivaient uniquement dans `packages/core/src/catalog/climate.ts`,
-- relevées à la main pour cinquante-cinq villes. Le catalogue en compte
-- désormais cinq cents, et ces chiffres ne s'inventent pas : ce sont des
-- mesures, tirées des archives Open-Meteo.
--
-- D'où cette colonne. La fonction `climate-normals` la remplit une fois par
-- ville, à partir des trois dernières années complètes. L'application les lit
-- pour les seules candidates qu'elle s'apprête à noter, et les injecte dans le
-- moteur par `sources.climate` — le point d'entrée existait déjà, prévu pour
-- « des données plus fines » que les normales embarquées.
--
-- Format identique au fichier : trente-six nombres, douze triplets
-- [maximum moyen, minimum moyen, jours de pluie], de janvier à décembre. Un
-- jour de pluie compte à partir d'un millimètre.
--
-- Les normales embarquées restent : elles servent de repli hors ligne, et
-- rien ne dépend du réseau pour que le classement fonctionne.
-- ============================================================================

alter table public.destinations
  add column climate jsonb
  check (
    climate is null
    or (jsonb_typeof(climate) = 'array' and jsonb_array_length(climate) = 36)
  );

comment on column public.destinations.climate is
  'Normales mensuelles mesurées (archives Open-Meteo) : 12 triplets [max, min, jours de pluie]. Nulle tant que la ville n''a pas été relevée.';
