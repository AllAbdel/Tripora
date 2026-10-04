-- ============================================================================
-- Épingler un voyage.
--
-- Un favori n'est pas une décision du groupe : c'est un marque-page personnel.
-- Deux personnes du même voyage peuvent parfaitement en épingler des
-- différents, et personne n'a à voir ce que les autres ont épinglé. D'où une
-- table par couple (voyage, personne), et une politique qui ne laisse voir que
-- ses propres lignes — la plus stricte du projet, et la plus simple.
--
-- On n'épingle que ce qu'on peut déjà voir : la contrainte d'appartenance est
-- vérifiée à l'écriture, sinon un identifiant deviné suffirait à savoir qu'un
-- voyage existe.
-- ============================================================================

create table if not exists public.trip_favorites (
  trip_id uuid not null references public.trips (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (trip_id, user_id)
);

create index if not exists trip_favorites_par_personne
  on public.trip_favorites (user_id, created_at desc);

alter table public.trip_favorites enable row level security;

drop policy if exists "chacun voit ses favoris" on public.trip_favorites;
create policy "chacun voit ses favoris"
  on public.trip_favorites for select
  using (user_id = auth.uid());

drop policy if exists "chacun épingle ses voyages" on public.trip_favorites;
create policy "chacun épingle ses voyages"
  on public.trip_favorites for insert
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.trip_members m
      where m.trip_id = trip_favorites.trip_id and m.user_id = auth.uid()
    )
  );

drop policy if exists "chacun retire ses favoris" on public.trip_favorites;
create policy "chacun retire ses favoris"
  on public.trip_favorites for delete
  using (user_id = auth.uid());

comment on table public.trip_favorites is
  'Marque-pages personnels. Un favori n''engage que celui qui le pose, et n''est visible que de lui.';
