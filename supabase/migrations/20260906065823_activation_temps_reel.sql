-- ============================================================================
-- Diffusion en temps réel.
--
-- Sans ces deux réglages, l'écoute des changements ne reçoit rien : Supabase
-- ne diffuse que les tables explicitement ajoutées à la publication.
--
-- C'est ce qui fait qu'un voyage est vraiment collaboratif : quand Thomas
-- rejoint et renseigne ses envies, l'écran d'Abdel se met à jour sans qu'il
-- ait à recharger, et les propositions sont aussitôt recalculées pour le
-- groupe élargi.
--
-- `replica identity full` fait porter à chaque événement la ligne complète et
-- pas seulement sa clé. Deux raisons : savoir *quelle* ligne a disparu lors
-- d'une suppression, et surtout permettre à la RLS de filtrer la diffusion —
-- elle a besoin de `trip_id` dans la charge utile, or la clé primaire de
-- `trip_proposals` ou de `votes` ne la contient pas. Sans cela, les
-- suppressions seraient silencieusement invisibles pour tout le monde.
-- Le surcoût en journal de transactions est négligeable sur des tables de
-- cette taille.
-- ============================================================================

alter table public.trips              replica identity full;
alter table public.trip_members       replica identity full;
alter table public.member_preferences replica identity full;
alter table public.trip_proposals     replica identity full;
alter table public.votes              replica identity full;

do $$
declare
  cible text;
begin
  foreach cible in array array[
    'trips', 'trip_members', 'member_preferences', 'trip_proposals', 'votes'
  ] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = cible
    ) then
      execute format('alter publication supabase_realtime add table public.%I', cible);
    end if;
  end loop;
end $$;
