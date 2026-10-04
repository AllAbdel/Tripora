-- Les erreurs de l'application, remontées par les navigateurs et les téléphones.
--
-- Sans elles, un écran qui plante chez quelqu'un ne laisse aucune trace : on
-- l'apprend par hasard, ou jamais. La table ne garde que le strict nécessaire
-- pour corriger — le message technique, la pile d'appels, la page sans ses
-- identifiants, la version, la langue, le navigateur — et rien qui désigne une
-- personne : ni compte, ni adresse IP (PostgREST ne l'écrit nulle part), ni
-- contenu de voyage. Le client nettoie avant d'envoyer (`remonterLesErreurs.ts`).
--
-- Écrire, oui ; relire, jamais : seul le tableau de bord (rôle de service) lit
-- la table. Un garde-fou ignore les envois au-delà de mille par heure, pour
-- qu'une boucle d'erreurs ou un abus ne puisse pas remplir la base gratuite,
-- et une tâche quotidienne efface ce qui a plus de trente jours.

create table public.erreurs_client (
  id bigint generated always as identity primary key,
  cree_le timestamptz not null default now(),
  message text not null check (char_length(message) between 1 and 500),
  pile text check (pile is null or char_length(pile) <= 4000),
  page text check (page is null or char_length(page) <= 200),
  version text check (version is null or char_length(version) <= 40),
  plateforme text check (plateforme is null or plateforme in ('web', 'android', 'ios')),
  langue text check (langue is null or char_length(langue) <= 10),
  navigateur text check (navigateur is null or char_length(navigateur) <= 60)
);

comment on table public.erreurs_client is
  'Erreurs remontées par l''application, sans donnée personnelle. Écriture seule pour anon/authenticated ; effacées après 30 jours.';

create index erreurs_client_cree_le_idx on public.erreurs_client (cree_le);

alter table public.erreurs_client enable row level security;

revoke all on public.erreurs_client from anon, authenticated;
grant insert (message, pile, page, version, plateforme, langue, navigateur) on public.erreurs_client to anon, authenticated;

create policy "remonter une erreur"
  on public.erreurs_client
  for insert
  to anon, authenticated
  with check (char_length(message) <= 500);

-- Le garde-fou : au-delà de mille erreurs dans l'heure, les suivantes sont
-- ignorées sans bruit (le client n'attend pas de réponse).
create function public.limiter_les_erreurs_client()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select count(*) from public.erreurs_client where cree_le > now() - interval '1 hour') >= 1000 then
    return null;
  end if;
  return new;
end;
$$;

revoke execute on function public.limiter_les_erreurs_client() from public, anon, authenticated;

create trigger limiter_les_erreurs_client
  before insert on public.erreurs_client
  for each row execute function public.limiter_les_erreurs_client();

-- pg_cron n'existe que sur la plateforme : sur le Postgres nu des tests, on passe.
do $planification$
begin
  if not exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    raise notice 'pg_cron absent : purge des erreurs non planifiée (base de test).';
    return;
  end if;

  create extension if not exists pg_cron with schema pg_catalog;

  perform cron.schedule(
    'purger-les-erreurs-client',
    '47 3 * * *',
    $job$delete from public.erreurs_client where cree_le < now() - interval '30 days'$job$
  );
end;
$planification$;
