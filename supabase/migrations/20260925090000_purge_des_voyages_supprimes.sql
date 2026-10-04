-- ============================================================================
-- Un voyage supprimé disparaît vraiment, trente jours après.
--
-- La page de confidentialité le promettait : « un voyage supprimé disparaît de
-- l'application immédiatement et de la base sous trente jours ». La première
-- moitié était vraie (suppression douce, `deleted_at`), la seconde non : rien
-- n'effaçait jamais la ligne, ni ce qui en dépend, ni les documents déposés
-- dans le coffre. Une promesse de confidentialité qu'aucun code ne tient
-- n'est pas une promesse.
--
-- Chaque nuit :
--   1. les voyages supprimés depuis plus de trente jours sont effacés pour de
--      bon — tout ce qui en dépend part en cascade (membres, votes, messages,
--      dépenses, coffre…) ;
--   2. les chemins de leurs documents sont notés dans `fichiers_a_effacer` :
--      effacer la ligne de `storage.objects` en SQL laisserait le fichier
--      lui-même sur le disque, seule l'API de stockage l'efface vraiment ;
--   3. la fonction `purge-fichiers` les efface par cette API, un peu plus tard.
--
-- Les trente jours laissent le temps de revenir sur une fausse manœuvre.
-- ============================================================================

create table if not exists public.fichiers_a_effacer (
  bucket text not null,
  chemin text not null,
  depuis timestamptz not null default now(),
  primary key (bucket, chemin)
);

comment on table public.fichiers_a_effacer is
  'Fichiers de voyages purgés, à effacer par l''API de stockage (fonction purge-fichiers). Aucun accès client.';

-- Aucune politique : ni les visiteurs ni les membres n'y ont accès. Seule la
-- fonction serveur, avec la clé de service, la lit et la vide.
alter table public.fichiers_a_effacer enable row level security;
revoke all on public.fichiers_a_effacer from anon, authenticated;

create or replace function public.purger_les_voyages_supprimes()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  purges integer;
begin
  -- Les documents d'abord : une fois le voyage parti, on ne saurait plus
  -- quels fichiers lui appartenaient.
  insert into public.fichiers_a_effacer (bucket, chemin)
  select o.bucket_id, o.name
    from storage.objects o
    join public.trips t on t.id::text = split_part(o.name, '/', 1)
   where o.bucket_id = 'documents'
     and t.deleted_at is not null
     and t.deleted_at < now() - interval '30 days'
  on conflict do nothing;

  delete from public.trips
   where deleted_at is not null
     and deleted_at < now() - interval '30 days';
  get diagnostics purges = row_count;
  return purges;
end;
$$;

comment on function public.purger_les_voyages_supprimes() is
  'Efface les voyages supprimés depuis plus de 30 jours et note leurs documents à effacer. Lancée chaque nuit.';

revoke all on function public.purger_les_voyages_supprimes() from public, anon, authenticated;

-- ------------------------------------------------------------ la planification
--
-- pg_cron n'existe que sur la plateforme : sur le Postgres nu des tests, on
-- passe. L'adresse et la clé ci-dessous sont publiques (celles de
-- l'application, apps/web/.env) : appeler `purge-fichiers` ne fait qu'effacer
-- plus tôt ce qui devait l'être.
do $planification$
begin
  if not exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    raise notice 'pg_cron absent : purge non planifiée (base de test).';
    return;
  end if;

  create extension if not exists pg_cron with schema pg_catalog;

  perform cron.schedule(
    'purger-les-voyages-supprimes',
    '17 3 * * *',
    'select public.purger_les_voyages_supprimes()'
  );

  perform cron.schedule(
    'effacer-les-fichiers-purges',
    '37 3 * * *',
    $job$
    select net.http_post(
      url := 'https://eelvllvgnsohznconfpt.supabase.co/functions/v1/purge-fichiers',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVlbHZsbHZnbnNvaHpuY29uZnB0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg2MzkxMTksImV4cCI6MjEwNDIxNTExOX0.QzyYAuYadGY7aLTx2ujfXsMN7gE7bK7dgZRoJ53k2Es'
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 30000
    )
    $job$
  );
end
$planification$;
