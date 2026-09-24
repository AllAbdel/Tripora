-- ============================================================================
-- Tests de la purge des voyages supprimés.
--
-- S'appuie sur l'état laissé par les tests précédents : le voyage
-- aaaaaaaa-…-0002 a des membres, des votes, des messages, des dépenses, des
-- infos et des documents dans le coffre. C'est le plus complet : s'il part
-- sans rien bloquer, les autres partiront aussi.
-- ============================================================================

\set ON_ERROR_STOP on
\timing off

do $$
declare
  n int;
begin
  -- Supprimé hier : on garde, la personne peut encore revenir en arrière.
  update public.trips set deleted_at = now() - interval '1 day'
   where id = 'aaaaaaaa-0000-0000-0000-000000000002';
  n := public.purger_les_voyages_supprimes();
  assert n = 0, format('Un voyage supprimé hier ne doit pas être purgé (%s purgé)', n);
  assert exists (select 1 from public.trips where id = 'aaaaaaaa-0000-0000-0000-000000000002'),
    'Le voyage supprimé hier doit encore exister';

  -- Supprimé il y a 31 jours : il part, avec tout ce qui en dépend.
  update public.trips set deleted_at = now() - interval '31 days'
   where id = 'aaaaaaaa-0000-0000-0000-000000000002';
  n := public.purger_les_voyages_supprimes();
  assert n = 1, format('Le voyage supprimé il y a 31 jours doit être purgé (%s)', n);
  assert not exists (select 1 from public.trips where id = 'aaaaaaaa-0000-0000-0000-000000000002'),
    'Le voyage doit avoir disparu';
  assert not exists (select 1 from public.trip_members where trip_id = 'aaaaaaaa-0000-0000-0000-000000000002'),
    'Ses membres doivent être partis en cascade';
  assert not exists (select 1 from public.documents_du_voyage where trip_id = 'aaaaaaaa-0000-0000-0000-000000000002'),
    'Ses fiches de documents doivent être parties en cascade';

  -- Ses fichiers sont notés pour l'API de stockage.
  select count(*) into n from public.fichiers_a_effacer
   where bucket = 'documents' and chemin like 'aaaaaaaa-0000-0000-0000-000000000002/%';
  assert n >= 1, 'Les fichiers du voyage purgé doivent être notés à effacer';

  -- Les autres voyages ne sont pas touchés.
  assert exists (select 1 from public.trips where id = 'aaaaaaaa-0000-0000-0000-000000000001'),
    'Un voyage non supprimé ne doit jamais être purgé';
end $$;

-- Personne, côté application, ne lit la liste ni ne lance la purge.
set role authenticated;
set request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
do $$
begin
  begin
    perform public.purger_les_voyages_supprimes();
    raise exception 'FUITE : un membre peut lancer la purge';
  exception when insufficient_privilege then null;
  end;
  begin
    perform count(*) from public.fichiers_a_effacer;
    raise exception 'FUITE : un membre lit les fichiers à effacer';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;
reset request.jwt.claims;

select '✅ Tests de la purge passés' as resultat;
