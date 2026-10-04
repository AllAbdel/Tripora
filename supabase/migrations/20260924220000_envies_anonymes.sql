-- ============================================================================
-- Les envies du groupe, anonymes pour de bon.
--
-- « Découvrir » et « À faire » disent combien de membres ont envie d'une
-- activité, jamais qui. Jusqu'ici, c'était l'écran qui se taisait : la base,
-- elle, laissait chaque membre lire les votes des autres avec leur
-- identifiant, et un curieux pouvait les retrouver. Désormais :
--
--   - un membre ne lit que ses propres avis sur les activités (sujet
--     `place`) ; les votes sur la destination, eux, restent lisibles par
--     tout le groupe, comme avant ;
--   - les comptes (pour, contre, votants) viennent d'une fonction qui ne
--     renvoie que des totaux ;
--   - le temps réel passe par un signal sans contenu : la base ne diffuse
--     plus les avis des autres, elle dit seulement « les envies ont changé »,
--     et l'application recompte.
-- ============================================================================

drop policy if exists "votes : lecture par les membres" on public.votes;

create policy "votes : lecture par les membres, sauf les envies des autres"
  on public.votes for select to authenticated
  using (
    public.is_trip_member(trip_id)
    and (subject_type <> 'place' or user_id = (select auth.uid()))
  );

-- Les comptes, activité par activité : combien pour, combien contre, mon
-- avis, et combien de membres se sont exprimés en tout.
create or replace function public.envies_du_voyage(p_trip_id uuid)
returns table (subject_id text, pour integer, contre integer, moi text, votants integer)
language sql stable security definer set search_path = public as $$
  with avis as (
    select v.subject_id, v.user_id, v.value::text as valeur
    from public.votes v
    where v.trip_id = p_trip_id
      and v.subject_type = 'place'
      and public.is_trip_member(p_trip_id)
  ),
  total as (select count(distinct user_id)::integer as votants from avis)
  select
    a.subject_id,
    count(*) filter (where a.valeur in ('like', 'favorite'))::integer,
    count(*) filter (where a.valeur = 'dislike')::integer,
    max(case when a.user_id = (select auth.uid()) then a.valeur end),
    (select votants from total)
  from avis a
  group by a.subject_id;
$$;

revoke execute on function public.envies_du_voyage(uuid) from public, anon;
grant execute on function public.envies_du_voyage(uuid) to authenticated;

-- ------------------------------------------------------------ Le signal --
-- Une ligne par voyage, touchée à chaque avis posé, changé ou retiré. Elle
-- ne dit ni qui ni quoi : seulement quand.
create table public.envies_modifiees (
  trip_id    uuid primary key references public.trips(id) on delete cascade,
  modifie_le timestamptz not null default now()
);

alter table public.envies_modifiees enable row level security;

create policy "signal des envies : lecture par les membres"
  on public.envies_modifiees for select to authenticated
  using (public.is_trip_member(trip_id));

create or replace function public.signaler_les_envies()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  ligne public.votes;
begin
  ligne := case when tg_op = 'DELETE' then old else new end;
  if ligne.subject_type = 'place' then
    insert into public.envies_modifiees (trip_id, modifie_le)
    values (ligne.trip_id, now())
    on conflict (trip_id) do update set modifie_le = excluded.modifie_le;
  end if;
  return null;
end;
$$;

create trigger signaler_les_envies after insert or update or delete on public.votes
  for each row execute function public.signaler_les_envies();

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'envies_modifiees'
     ) then
    alter publication supabase_realtime add table public.envies_modifiees;
  end if;
end $$;
