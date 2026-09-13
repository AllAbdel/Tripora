-- ============================================================================
-- Retirer de l'API ce qui n'a rien à y faire.
--
-- PostgREST publie automatiquement toute fonction du schéma `public` sous
-- `/rest/v1/rpc/<nom>`. Deux d'entre elles y étaient sans raison, appelables
-- par n'importe qui, y compris sans session :
--
--  - `effacer_parrainage_non_administrateur` est une fonction de déclencheur.
--    Appelée hors de son contexte, Postgres la refuse — elle n'était donc pas
--    exploitable — mais une porte inutile reste une porte, et celle-ci
--    annonçait au passage qu'un mécanisme de parrainage réservé existe.
--
--  - `is_app_admin` répond « êtes-vous administrateur ? ». L'écran de
--    modération en a besoin, un visiteur sans session non : sa réponse est
--    toujours « non » pour lui, et la question seule renseigne sur la
--    structure du projet.
--
-- Ce qui reste volontairement joignable, pour que la prochaine relecture ne le
-- prenne pas pour un oubli :
--
--  - `join_trip_with_code` : c'est le point d'entrée d'une invitation, appelé
--    par le client. Il vérifie lui-même le code, sa date d'expiration et son
--    nombre d'usages.
--  - `is_trip_member`, `is_trip_owner`, `can_access_day`, `can_access_expense`,
--    `can_access_itinerary` : ce sont les briques des politiques RLS. Postgres
--    évalue une politique avec les droits de l'appelant, donc leur retirer
--    l'exécution casserait l'accès aux voyages pour tout le monde. Les laisser
--    joignables ne révèle rien : elles répondent « êtes-vous membre de ce
--    voyage ? », ce que la table des membres dit déjà à qui la lit.
-- ============================================================================

revoke all on function public.effacer_parrainage_non_administrateur() from public, anon, authenticated;
revoke all on function public.is_app_admin() from public, anon;

comment on function public.is_app_admin() is
  'Réservée aux sessions ouvertes : l''écran de modération s''en sert, un visiteur sans session n''a pas la question à poser.';
