-- ============================================================================
-- Deux corrections signalées par l'analyse de performance de Supabase.
--
-- 1. `itineraries` portait deux règles d'accès permissives pour la lecture :
--    « lecture par les membres » (SELECT) et « écriture par les membres »
--    (ALL, donc lecture comprise), avec exactement la même condition,
--    `is_trip_member(trip_id)`. Postgres les évaluait toutes deux à chaque
--    ligne lue, pour un résultat identique. La première est retirée : les
--    droits ne changent pas d'un iota, seule la double évaluation disparaît.
--
-- 2. `signalements.trip_id` est une clé étrangère sans index. Supprimer un
--    voyage parcourait donc toute la table des signalements pour trouver ceux
--    qui le citent.
-- ============================================================================

drop policy if exists "itinéraires : lecture par les membres" on public.itineraries;

create index if not exists signalements_trip_idx on public.signalements (trip_id);
