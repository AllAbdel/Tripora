-- Les villes trouvées par géocodage entrent dans le catalogue, sans mentir.
--
-- Le catalogue curé porte des jugements assumés — « Barcelone, fête 0,95 ».
-- Une ville géocodée n'en a aucun, et il est hors de question d'en inventer :
-- une note fabriquée fausserait un vote de groupe, ce que Tripora s'interdit.
--
-- D'où cette colonne. Elle sépare deux populations dans la même table : les
-- villes découvertes servent à « on sait déjà où aller » — identifier un lieu,
-- en tirer des recommandations réelles — jamais à « surprends-nous », qui
-- compare et classe, et exige donc des notes homogènes.
--
-- Leurs `tags` valent `{}` : « on ne sait pas ». Mettre 0,5 partout se lirait
-- « moyenne en tout », qui est une affirmation, et fausse.
alter table public.destinations
  add column discovered boolean not null default false;

comment on column public.destinations.discovered is
  'Vraie pour une ville venue du géocodage : coordonnées fiables, notes éditoriales inconnues. Exclue du classement des propositions.';
