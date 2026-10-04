-- ============================================================================
-- Les votes secrets.
--
-- Deux choses, l'une pour tous les voyages, l'autre au choix de qui lance un
-- sondage.
--
-- 1. Le vote sur la destination devient anonyme pour de bon. L'écran ne
--    montrait déjà que des totaux (« 3 sur 5 sont pour »), mais la base
--    laissait chaque membre lire les votes des autres avec leur identifiant :
--    un curieux pouvait savoir qui avait dit non à sa ville. Comme pour les
--    envies (migration des envies anonymes) : chacun ne lit que ses votes,
--    les totaux viennent d'une fonction, et le temps réel passe par un
--    signal sans contenu.
--
-- 2. Un sondage peut être lancé « à bulletin secret ». Personne — ni son
--    auteur, ni l'organisateur — ne voit qui a voté quoi, et le décompte
--    reste caché tant que le sondage est ouvert : des totaux qui bougent en
--    direct trahiraient le choix de qui vient de voter. On sait seulement
--    combien de personnes ont voté. À la clôture, les résultats s'affichent
--    pour tout le groupe ; un vote secret clos ne se rouvre pas, sans quoi
--    de nouveaux votes se liraient par différence.
-- ============================================================================

-- ---------------------------------------------------------- 1. Destination --

drop policy if exists "votes : lecture par les membres, sauf les envies des autres" on public.votes;

create policy "votes : chacun ne lit que les siens"
  on public.votes for select to authenticated
  using (user_id = (select auth.uid()) and public.is_trip_member(trip_id));

-- Les totaux du vote sur la destination, destination par destination : combien
-- d'« j'aime », de « mon préféré », de « pas pour moi », mon propre vote, et
-- combien de membres se sont exprimés en tout.
create or replace function public.votes_du_voyage(p_trip_id uuid)
returns table (subject_id text, aime integer, prefere integer, contre integer, moi text, votants integer)
language sql stable security definer set search_path = public as $$
  with avis as (
    select v.subject_id, v.user_id, v.value::text as valeur
    from public.votes v
    where v.trip_id = p_trip_id
      and v.subject_type = 'proposal'
      and public.is_trip_member(p_trip_id)
  ),
  total as (select count(distinct user_id)::integer as votants from avis)
  select
    a.subject_id,
    count(*) filter (where a.valeur = 'like')::integer,
    count(*) filter (where a.valeur = 'favorite')::integer,
    count(*) filter (where a.valeur = 'dislike')::integer,
    max(case when a.user_id = (select auth.uid()) then a.valeur end),
    (select votants from total)
  from avis a
  group by a.subject_id;
$$;

revoke execute on function public.votes_du_voyage(uuid) from public, anon;
grant execute on function public.votes_du_voyage(uuid) to authenticated;

-- Le signal : une ligne par voyage, touchée à chaque vote sur la destination.
-- Elle ne dit ni qui ni quoi, seulement quand.
create table public.votes_modifies (
  trip_id    uuid primary key references public.trips(id) on delete cascade,
  modifie_le timestamptz not null default now()
);

alter table public.votes_modifies enable row level security;

create policy "signal des votes : lecture par les membres"
  on public.votes_modifies for select to authenticated
  using (public.is_trip_member(trip_id));

revoke all on public.votes_modifies from anon;
grant select on public.votes_modifies to authenticated;

create or replace function public.signaler_les_votes()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  ligne public.votes;
begin
  ligne := case when tg_op = 'DELETE' then old else new end;
  -- Rien pour un voyage en train de disparaître : supprimer un voyage efface
  -- ses votes en cascade, et la clé étrangère refuserait le signal (voir la
  -- migration du signal des envies).
  if ligne.subject_type = 'proposal' then
    insert into public.votes_modifies (trip_id, modifie_le)
    select ligne.trip_id, now()
    where exists (select 1 from public.trips t where t.id = ligne.trip_id)
    on conflict (trip_id) do update set modifie_le = excluded.modifie_le;
  end if;
  return null;
end;
$$;

create trigger signaler_les_votes after insert or update or delete on public.votes
  for each row execute function public.signaler_les_votes();

-- ------------------------------------------------------- 2. Sondages secrets --

alter table public.sondages add column secret boolean not null default false;
-- Quand quelqu'un a voté pour la dernière fois : le signal qui fait
-- rafraîchir les autres (voir plus bas).
alter table public.sondages add column derniere_voix timestamptz;
-- Recopié du sondage par le déclencheur, jamais fourni par le client : c'est
-- lui que lit la règle de lecture.
alter table public.sondage_votes add column secret boolean not null default false;

-- Un sondage garde son auteur, son voyage et sa nature : basculer un sondage
-- secret en public après coup dévoilerait les votes. Et un vote secret clos ne
-- se rouvre pas.
create or replace function public.sondages_figes()
returns trigger language plpgsql set search_path = public as $$
begin
  new.cree_par := old.cree_par;
  new.trip_id := old.trip_id;
  new.secret := old.secret;
  if old.secret and old.clos and not new.clos then
    raise exception 'Un vote secret clos ne se rouvre pas : ses résultats sont déjà connus.'
      using errcode = 'P0030';
  end if;
  return new;
end;
$$;

create or replace function public.sondage_votes_rattaches()
returns trigger language plpgsql set search_path = public as $$
declare
  multiple boolean;
begin
  select o.sondage_id, o.trip_id into new.sondage_id, new.trip_id
  from public.sondage_options o where o.id = new.option_id;

  select s.choix_multiple, s.secret into multiple, new.secret
  from public.sondages s where s.id = new.sondage_id;
  new.secret := coalesce(new.secret, false);
  if not coalesce(multiple, false) then
    delete from public.sondage_votes
    where sondage_id = new.sondage_id and user_id = new.user_id and option_id <> new.option_id;
  end if;
  return new;
end;
$$;

drop policy if exists "votes : lecture par les membres" on public.sondage_votes;

create policy "votes : lecture par les membres, sauf les bulletins secrets des autres"
  on public.sondage_votes for select to authenticated
  using (public.is_trip_member(trip_id) and (not secret or user_id = (select auth.uid())));

-- Le signal des votes : la ligne du sondage est touchée, sans rien dire de
-- plus, et les membres qui l'écoutent recomptent.
--
-- Les votes eux-mêmes ne sont plus diffusés en temps réel, secrets ou non.
-- Le temps réel applique les règles de lecture aux ajouts, pas aux
-- suppressions : il envoie à tous les abonnés la clé de la ligne retirée, et
-- celle d'un vote, c'est (option, personne). Retirer son bulletin secret
-- aurait dit à tout le groupe pour quoi on avait voté.
create or replace function public.signaler_une_voix()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  ligne public.sondage_votes;
begin
  ligne := case when tg_op = 'DELETE' then old else new end;
  update public.sondages set derniere_voix = now() where id = ligne.sondage_id;
  return null;
end;
$$;

create trigger signaler_une_voix after insert or delete on public.sondage_votes
  for each row execute function public.signaler_une_voix();

-- Le décompte des sondages secrets d'un voyage, option par option : combien de
-- personnes ont voté (toujours), et les voix de chaque option — seulement une
-- fois le sondage clos. Ni qui, ni quoi, tant qu'il est ouvert.
create or replace function public.decompte_des_sondages_secrets(p_trip_id uuid)
returns table (sondage_id uuid, option_id uuid, voix integer, votants integer)
language sql stable security definer set search_path = public as $$
  select
    s.id,
    o.id,
    case when s.clos
      then (select count(*)::integer from public.sondage_votes v where v.option_id = o.id)
    end,
    (select count(distinct v.user_id)::integer from public.sondage_votes v where v.sondage_id = s.id)
  from public.sondages s
  join public.sondage_options o on o.sondage_id = s.id
  where s.trip_id = p_trip_id
    and s.secret
    and public.is_trip_member(p_trip_id);
$$;

revoke execute on function public.decompte_des_sondages_secrets(uuid) from public, anon;
grant execute on function public.decompte_des_sondages_secrets(uuid) to authenticated;

-- ------------------------------------------------------------ Temps réel --

do $$
begin
  if exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'sondage_votes'
  ) then
    alter publication supabase_realtime drop table public.sondage_votes;
  end if;
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'votes_modifies'
     ) then
    alter publication supabase_realtime add table public.votes_modifies;
  end if;
end $$;
