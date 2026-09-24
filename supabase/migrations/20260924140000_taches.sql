-- ============================================================================
-- Qui fait quoi : les tâches du groupe.
--
-- « Qui réserve la voiture ? », « quelqu'un a pris l'assurance ? » : avant le
-- départ, un voyage à plusieurs est une liste de choses à faire que chacun
-- croit faite par un autre. La valise est à soi, « À faire » parle des
-- activités sur place ; il manquait la liste commune, avec pour chaque ligne
-- un responsable et une échéance.
--
-- N'importe quel membre coche une tâche faite ou se l'attribue : c'est une
-- liste d'entraide, pas un outil de contrôle. Seuls son auteur et
-- l'organisateur la retirent.
-- ============================================================================

create table public.taches (
  id           uuid primary key default gen_random_uuid(),
  trip_id      uuid not null references public.trips(id) on delete cascade,
  titre        text not null check (length(btrim(titre)) between 1 and 200),
  responsable  uuid references public.profiles(id) on delete set null,
  echeance     date,
  faite        boolean not null default false,
  faite_par    uuid references public.profiles(id) on delete set null,
  faite_le     timestamptz,
  cree_par     uuid references public.profiles(id) on delete set null default auth.uid(),
  cree_le      timestamptz not null default now()
);

create index taches_voyage_idx on public.taches (trip_id, faite, echeance);
create index taches_responsable_idx on public.taches (responsable);
create index taches_cree_par_idx on public.taches (cree_par);
create index taches_faite_par_idx on public.taches (faite_par);

-- Qui a coché, et quand : posé par la base, pas par le client. L'auteur et le
-- voyage ne changent jamais.
create or replace function public.taches_suivies()
returns trigger language plpgsql set search_path = public as $$
begin
  if tg_op = 'UPDATE' then
    new.cree_par := old.cree_par;
    new.trip_id := old.trip_id;
    if new.faite is distinct from old.faite then
      new.faite_par := case when new.faite then auth.uid() else null end;
      new.faite_le := case when new.faite then now() else null end;
    else
      new.faite_par := old.faite_par;
      new.faite_le := old.faite_le;
    end if;
  else
    new.faite_par := case when new.faite then auth.uid() else null end;
    new.faite_le := case when new.faite then now() else null end;
  end if;
  -- Un responsable est forcément du voyage : on ne confie rien à un inconnu.
  if new.responsable is not null and not exists (
    select 1 from public.trip_members m where m.trip_id = new.trip_id and m.user_id = new.responsable
  ) then
    raise exception 'Le responsable d''une tâche doit être membre du voyage'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger taches_suivies before insert or update on public.taches
  for each row execute function public.taches_suivies();

-- ------------------------------------------------------------------ Droits --
alter table public.taches enable row level security;

create policy "tâches : lecture par les membres"
  on public.taches for select to authenticated
  using (public.is_trip_member(trip_id));

create policy "tâches : ajout par les membres, à leur nom"
  on public.taches for insert to authenticated
  with check (cree_par = (select auth.uid()) and public.is_trip_member(trip_id));

-- Cocher, s'attribuer, corriger : tout le groupe.
create policy "tâches : mise à jour par les membres"
  on public.taches for update to authenticated
  using (public.is_trip_member(trip_id))
  with check (public.is_trip_member(trip_id));

create policy "tâches : retrait par l'auteur ou l'organisateur"
  on public.taches for delete to authenticated
  using (public.is_trip_member(trip_id) and (cree_par = (select auth.uid()) or public.is_trip_owner(trip_id)));

alter table public.taches replica identity full;
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'taches'
     ) then
    alter publication supabase_realtime add table public.taches;
  end if;
end $$;
