-- ============================================================================
-- Les votes de sondage ne passent plus par le temps réel.
--
-- Le temps réel applique les règles de lecture aux ajouts, pas aux
-- suppressions : il envoie à tous les abonnés la clé de la ligne retirée, et
-- celle d'un vote de sondage, c'est (option, personne). Retirer son bulletin
-- secret aurait dit à tout le groupe pour quoi on avait voté. Chaque vote
-- touche désormais `sondages.derniere_voix` (migration des votes secrets), et
-- c'est ce signal que l'application écoute.
-- ============================================================================

do $$
begin
  if exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'sondage_votes'
  ) then
    alter publication supabase_realtime drop table public.sondage_votes;
  end if;
end $$;
