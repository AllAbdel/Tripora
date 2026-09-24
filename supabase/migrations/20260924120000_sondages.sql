-- ============================================================================
-- Les sondages du groupe.
--
-- Tripora faisait voter sur la destination et sur les activités, et c'était
-- tout. Le reste — quelles dates, quel logement parmi les trois repérés sur
-- Airbnb, où dîner ce soir, qui prend la voiture — retournait dans la
-- messagerie, où un vote se perd entre deux photos. C'est aussi ce que les
-- comparatifs reprochent aux planificateurs les plus connus : pas de sondages.
--
-- Un sondage, ce sont des options — un texte, éventuellement un lien (le
-- logement) ou des dates (du 12 au 15) — et des votes. À choix unique ou
-- multiple, ouvert aux propositions de tous, et clos par qui l'a lancé.
-- ============================================================================

create table public.sondages (
  id             uuid primary key default gen_random_uuid(),
  trip_id        uuid not null references public.trips(id) on delete cascade,
  question       text not null check (length(btrim(question)) between 1 and 200),
  -- Ce que les options décrivent, pour les afficher et en proposer d'autres.
  genre          text not null default 'texte' check (genre in ('texte', 'dates', 'liens')),
  choix_multiple boolean not null default false,
  clos           boolean not null default false,
  cree_par       uuid references public.profiles(id) on delete set null default auth.uid(),
  cree_le        timestamptz not null default now()
);

create index sondages_voyage_idx on public.sondages (trip_id, cree_le desc);
create index sondages_cree_par_idx on public.sondages (cree_par);

create table public.sondage_options (
  id           uuid primary key default gen_random_uuid(),
  sondage_id   uuid not null references public.sondages(id) on delete cascade,
  -- Recopié du sondage par un déclencheur, jamais fourni par le client : c'est
  -- lui que lisent les règles d'accès.
  trip_id      uuid not null references public.trips(id) on delete cascade,
  libelle      text not null check (length(btrim(libelle)) between 1 and 200),
  -- Le logement, le restaurant : toujours en https, ce lien est cliqué par tout
  -- le groupe.
  lien         text check (lien is null or (lien ~ '^https://' and length(lien) <= 2000)),
  du           date,
  au           date,
  position     smallint not null default 0,
  ajoutee_par  uuid references public.profiles(id) on delete set null default auth.uid(),
  ajoutee_le   timestamptz not null default now(),
  constraint sondage_options_dates check (au is null or (du is not null and au >= du))
);

create index sondage_options_sondage_idx on public.sondage_options (sondage_id, position);
create index sondage_options_voyage_idx on public.sondage_options (trip_id);
create index sondage_options_ajoutee_par_idx on public.sondage_options (ajoutee_par);

create table public.sondage_votes (
  option_id   uuid not null references public.sondage_options(id) on delete cascade,
  -- Recopiés de l'option par le déclencheur, comme plus haut.
  sondage_id  uuid not null references public.sondages(id) on delete cascade,
  trip_id     uuid not null references public.trips(id) on delete cascade,
  user_id     uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  vote_le     timestamptz not null default now(),
  primary key (option_id, user_id)
);

create index sondage_votes_sondage_idx on public.sondage_votes (sondage_id, user_id);
create index sondage_votes_voyage_idx on public.sondage_votes (trip_id);
create index sondage_votes_user_idx on public.sondage_votes (user_id);

-- ------------------------------------------------------------ Cohérence --

-- Un sondage garde son auteur et son voyage : sinon le corriger permettrait
-- de l'attribuer à un autre, ou de le glisser dans un voyage dont on n'est pas.
create or replace function public.sondages_figes()
returns trigger language plpgsql set search_path = public as $$
begin
  new.cree_par := old.cree_par;
  new.trip_id := old.trip_id;
  return new;
end;
$$;

create trigger sondages_figes before update on public.sondages
  for each row execute function public.sondages_figes();

-- Une option appartient au voyage de son sondage, quoi qu'envoie le client.
create or replace function public.sondage_options_rattachees()
returns trigger language plpgsql set search_path = public as $$
begin
  select trip_id into new.trip_id from public.sondages where id = new.sondage_id;
  return new;
end;
$$;

create trigger sondage_options_rattachees before insert on public.sondage_options
  for each row execute function public.sondage_options_rattachees();

-- Un vote : rattaché au sondage et au voyage de son option, et, pour un
-- sondage à choix unique, il remplace le vote précédent de la même personne.
-- Voter pour une autre option déplace son vote, comme on s'y attend.
create or replace function public.sondage_votes_rattaches()
returns trigger language plpgsql set search_path = public as $$
declare
  multiple boolean;
begin
  select o.sondage_id, o.trip_id into new.sondage_id, new.trip_id
  from public.sondage_options o where o.id = new.option_id;

  select s.choix_multiple into multiple from public.sondages s where s.id = new.sondage_id;
  if not coalesce(multiple, false) then
    delete from public.sondage_votes
    where sondage_id = new.sondage_id and user_id = new.user_id and option_id <> new.option_id;
  end if;
  return new;
end;
$$;

create trigger sondage_votes_rattaches before insert on public.sondage_votes
  for each row execute function public.sondage_votes_rattaches();

-- Un sondage ouvert, dans un voyage dont on est membre ?
create or replace function public.sondage_ouvert(p_sondage_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.sondages s
    where s.id = p_sondage_id and not s.clos and public.is_trip_member(s.trip_id)
  );
$$;

-- L'auteur d'un sondage, ou l'organisateur du voyage.
create or replace function public.peut_gerer_le_sondage(p_sondage_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.sondages s
    where s.id = p_sondage_id
      and public.is_trip_member(s.trip_id)
      and (s.cree_par = auth.uid() or public.is_trip_owner(s.trip_id))
  );
$$;

revoke all on function public.sondage_ouvert(uuid) from public, anon;
revoke all on function public.peut_gerer_le_sondage(uuid) from public, anon;
grant execute on function public.sondage_ouvert(uuid) to authenticated;
grant execute on function public.peut_gerer_le_sondage(uuid) to authenticated;

-- ------------------------------------------------------------------ Droits --
alter table public.sondages enable row level security;
alter table public.sondage_options enable row level security;
alter table public.sondage_votes enable row level security;

create policy "sondages : lecture par les membres"
  on public.sondages for select to authenticated
  using (public.is_trip_member(trip_id));

create policy "sondages : lancés par un membre, à son nom"
  on public.sondages for insert to authenticated
  with check (cree_par = (select auth.uid()) and public.is_trip_member(trip_id));

-- Clore, reformuler : l'auteur ou l'organisateur.
create policy "sondages : gérés par l'auteur ou l'organisateur"
  on public.sondages for update to authenticated
  using (public.is_trip_member(trip_id) and (cree_par = (select auth.uid()) or public.is_trip_owner(trip_id)))
  with check (public.is_trip_member(trip_id));

create policy "sondages : retirés par l'auteur ou l'organisateur"
  on public.sondages for delete to authenticated
  using (public.is_trip_member(trip_id) and (cree_par = (select auth.uid()) or public.is_trip_owner(trip_id)));

create policy "options : lecture par les membres"
  on public.sondage_options for select to authenticated
  using (public.is_trip_member(trip_id));

-- Tout membre peut proposer une option, tant que le sondage est ouvert.
create policy "options : proposées par un membre, sondage ouvert"
  on public.sondage_options for insert to authenticated
  with check (ajoutee_par = (select auth.uid()) and public.sondage_ouvert(sondage_id));

create policy "options : retirées par leur auteur ou celui du sondage"
  on public.sondage_options for delete to authenticated
  using (
    public.is_trip_member(trip_id)
    and (ajoutee_par = (select auth.uid()) or public.peut_gerer_le_sondage(sondage_id))
  );

create policy "votes : lecture par les membres"
  on public.sondage_votes for select to authenticated
  using (public.is_trip_member(trip_id));

-- On ne vote que pour soi, et seulement dans un sondage ouvert.
create policy "votes : chacun le sien, sondage ouvert"
  on public.sondage_votes for insert to authenticated
  with check (user_id = (select auth.uid()) and public.sondage_ouvert(sondage_id));

create policy "votes : chacun retire le sien, sondage ouvert"
  on public.sondage_votes for delete to authenticated
  using (user_id = (select auth.uid()) and public.sondage_ouvert(sondage_id));

-- Un vote posé par un ami apparaît chez les autres sans recharger.
alter table public.sondages replica identity full;
alter table public.sondage_options replica identity full;
alter table public.sondage_votes replica identity full;
do $$
declare
  nom text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach nom in array array['sondages', 'sondage_options', 'sondage_votes'] loop
      if not exists (
        select 1 from pg_publication_tables
        where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = nom
      ) then
        execute format('alter publication supabase_realtime add table public.%I', nom);
      end if;
    end loop;
  end if;
end $$;
