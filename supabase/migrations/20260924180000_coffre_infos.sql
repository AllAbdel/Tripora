-- ============================================================================
-- Le coffre du voyage, première moitié : les infos qu'on se transmet.
--
-- Le code de la boîte à clés, le wifi, l'adresse exacte, le numéro de l'hôte :
-- des messages perdus dans la discussion, qu'on cherche à 23 h devant une
-- porte fermée. Une ligne par info, lue par les membres du voyage seulement.
--
-- Tout le groupe ajoute et corrige (un code a changé, un mot de passe était
-- mal recopié) ; seuls l'auteur et l'organisateur retirent.
-- ============================================================================

create table public.infos_du_voyage (
  id          uuid primary key default gen_random_uuid(),
  trip_id     uuid not null references public.trips(id) on delete cascade,
  genre       text not null check (genre in ('adresse', 'code', 'wifi', 'contact', 'note')),
  titre       text not null check (length(btrim(titre)) between 1 and 80),
  -- Un wifi ouvert n'a pas de mot de passe ; tout le reste a une valeur.
  valeur      text not null check (length(valeur) <= 500 and (genre = 'wifi' or length(btrim(valeur)) >= 1)),
  complement  text check (complement is null or length(complement) <= 300),
  cree_par    uuid references public.profiles(id) on delete set null default auth.uid(),
  cree_le     timestamptz not null default now(),
  modifie_le  timestamptz not null default now()
);

create index infos_du_voyage_voyage_idx on public.infos_du_voyage (trip_id, genre);
create index infos_du_voyage_cree_par_idx on public.infos_du_voyage (cree_par);

-- L'auteur et le voyage ne changent jamais.
create or replace function public.infos_du_voyage_figees()
returns trigger language plpgsql set search_path = public as $$
begin
  new.cree_par := old.cree_par;
  new.trip_id := old.trip_id;
  new.cree_le := old.cree_le;
  new.modifie_le := now();
  return new;
end;
$$;

create trigger infos_du_voyage_figees before update on public.infos_du_voyage
  for each row execute function public.infos_du_voyage_figees();

-- Un coffre, pas une décharge : au-delà, c'est qu'on s'en sert pour autre chose.
create or replace function public.infos_du_voyage_bornees()
returns trigger language plpgsql set search_path = public as $$
begin
  if (select count(*) from public.infos_du_voyage where trip_id = new.trip_id) >= 100 then
    raise exception 'Le coffre de ce voyage est plein (100 infos)'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger infos_du_voyage_bornees before insert on public.infos_du_voyage
  for each row execute function public.infos_du_voyage_bornees();

-- ------------------------------------------------------------------ Droits --
alter table public.infos_du_voyage enable row level security;

create policy "coffre : lecture par les membres"
  on public.infos_du_voyage for select to authenticated
  using (public.is_trip_member(trip_id));

create policy "coffre : ajout par les membres, à leur nom"
  on public.infos_du_voyage for insert to authenticated
  with check (cree_par = (select auth.uid()) and public.is_trip_member(trip_id));

create policy "coffre : correction par les membres"
  on public.infos_du_voyage for update to authenticated
  using (public.is_trip_member(trip_id))
  with check (public.is_trip_member(trip_id));

create policy "coffre : retrait par l'auteur ou l'organisateur"
  on public.infos_du_voyage for delete to authenticated
  using (public.is_trip_member(trip_id) and (cree_par = (select auth.uid()) or public.is_trip_owner(trip_id)));

alter table public.infos_du_voyage replica identity full;
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'infos_du_voyage'
     ) then
    alter publication supabase_realtime add table public.infos_du_voyage;
  end if;
end $$;
