-- ============================================================================
-- Tripora — schéma initial
--
-- Principes appliqués ici :
--   1. Tout est protégé par RLS. Le client parle directement à Postgres :
--      la base est la dernière ligne de défense, pas l'application.
--   2. L'appartenance à un voyage est LA règle d'accès. Elle passe par une
--      fonction SECURITY DEFINER pour éviter la récursion des politiques.
--   3. Les tables techniques (cache, quotas) sont invisibles au client :
--      seul le service_role des Edge Functions y touche.
--   4. Tout montant est un entier de centimes. Aucun numeric flottant.
--   5. Toute donnée venue d'une API porte sa source et sa date de relevé.
-- ============================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------- Types ----
create type trip_status   as enum ('draft','proposing','voting','planned','ongoing','done');
create type date_mode     as enum ('exact','window','month','weekend');
create type budget_mode   as enum ('cheapest','max_per_person','comfortable');
create type comfort_level as enum ('budget','mid','comfort');
create type group_type    as enum ('solo','couple','friends','family','custom');
create type member_role   as enum ('owner','member');
create type vote_value    as enum ('like','dislike','favorite');
create type vote_subject  as enum ('proposal','place','accommodation','transport','itinerary_item');
create type price_source  as enum ('observed','estimated','unavailable');
create type transport_mode as enum ('plane','train','bus','car','ferry');
create type expense_category as enum ('transport','accommodation','food','activities','shopping','other');
create type itinerary_kind as enum ('activity','meal','transit','rest','checkin','checkout');

-- ------------------------------------------------------------- Communs ----
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Valide un objet de poids de préférences : uniquement des nombres dans [0, 1].
-- Une contrainte CHECK ne peut pas contenir de sous-requête, d'où cette
-- fonction immutable, réutilisée pour les préférences et pour le catalogue.
create or replace function public.weights_are_valid(w jsonb)
returns boolean language sql immutable as $$
  select w is not null
     and jsonb_typeof(w) = 'object'
     and not exists (
       select 1 from jsonb_each(w) as entry(key, value)
       where jsonb_typeof(entry.value) <> 'number'
          or (entry.value)::numeric < 0
          or (entry.value)::numeric > 1
     );
$$;

-- ------------------------------------------------------------ Profils -----
create table public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'Voyageur',
  avatar_url   text,
  home_city    text,
  home_lat     double precision,
  home_lng     double precision,
  currency     char(3) not null default 'EUR',
  locale       text not null default 'fr-FR',
  is_anonymous boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();

-- Un profil est créé automatiquement à l'inscription : aucun écran de plus.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name, avatar_url, is_anonymous)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'name',
      split_part(coalesce(new.email, ''), '@', 1),
      'Voyageur'
    ),
    new.raw_user_meta_data->>'avatar_url',
    new.is_anonymous
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ------------------------------------------------------------ Voyages -----
create table public.trips (
  id                      uuid primary key default gen_random_uuid(),
  owner_id                uuid not null references public.profiles(id) on delete cascade,
  title                   text not null default 'Nouveau voyage',
  status                  trip_status not null default 'draft',

  origin_name             text,
  origin_lat              double precision,
  origin_lng              double precision,
  origin_iata             text[],

  destination_locked_id   text,          -- référence destinations.id une fois le vote tranché
  participants            smallint not null default 1 check (participants between 1 and 30),
  group_type              group_type not null default 'friends',

  date_mode               date_mode not null default 'month',
  start_date              date,
  end_date                date,
  window_start            date,
  window_end              date,
  target_month            smallint check (target_month between 1 and 12),
  duration_days           smallint not null default 4 check (duration_days between 1 and 90),

  budget_mode             budget_mode not null default 'max_per_person',
  budget_per_person_cents integer check (budget_per_person_cents >= 0),
  comfort_level           comfort_level not null default 'budget',
  currency                char(3) not null default 'EUR',

  cover_image_url         text,
  deleted_at              timestamptz,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);
create index trips_owner_idx on public.trips(owner_id) where deleted_at is null;
create trigger trips_touch before update on public.trips
  for each row execute function public.touch_updated_at();

create table public.trip_members (
  trip_id   uuid not null references public.trips(id) on delete cascade,
  user_id   uuid not null references public.profiles(id) on delete cascade,
  role      member_role not null default 'member',
  joined_at timestamptz not null default now(),
  primary key (trip_id, user_id)
);
create index trip_members_user_idx on public.trip_members(user_id);

-- Appartenance en SECURITY DEFINER : indispensable, sinon les politiques de
-- trip_members s'appellent elles-mêmes et Postgres refuse (récursion infinie).
create or replace function public.is_trip_member(target_trip uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.trip_members
    where trip_id = target_trip and user_id = auth.uid()
  );
$$;

create or replace function public.is_trip_owner(target_trip uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.trips
    where id = target_trip and owner_id = auth.uid()
  );
$$;

-- L'owner devient membre dès la création : pas d'état incohérent possible.
create or replace function public.add_owner_as_member()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.trip_members (trip_id, user_id, role)
  values (new.id, new.owner_id, 'owner')
  on conflict do nothing;
  return new;
end;
$$;
create trigger trips_add_owner after insert on public.trips
  for each row execute function public.add_owner_as_member();

-- --------------------------------------------------------- Invitations ----
create table public.trip_invites (
  id         uuid primary key default gen_random_uuid(),
  trip_id    uuid not null references public.trips(id) on delete cascade,
  code       char(8) not null unique,
  created_by uuid not null references public.profiles(id) on delete cascade,
  expires_at timestamptz not null default (now() + interval '30 days'),
  max_uses   smallint not null default 20 check (max_uses > 0),
  uses       smallint not null default 0,
  revoked    boolean not null default false,
  created_at timestamptz not null default now()
);
create index trip_invites_trip_idx on public.trip_invites(trip_id);

-- Rejoindre par code : la seule voie d'entrée dans un voyage dont on n'est pas
-- membre. Renvoie l'aperçu minimal du voyage, jamais la liste des participants.
create or replace function public.join_trip_with_code(invite_code text)
returns table (trip_id uuid, title text, cover_image_url text)
language plpgsql security definer set search_path = public as $$
-- Les colonnes de sortie (trip_id, title…) portent le même nom que des colonnes
-- de table : on demande explicitement à PL/pgSQL de privilégier la colonne.
#variable_conflict use_column
declare
  invite public.trip_invites%rowtype;
  inserted_rows integer;
begin
  if auth.uid() is null then
    raise exception 'Connexion requise pour rejoindre un voyage' using errcode = '28000';
  end if;

  select * into invite from public.trip_invites
  where code = upper(invite_code) and not revoked
  for update;

  if not found then
    raise exception 'Code d''invitation inconnu' using errcode = 'P0002';
  end if;
  if invite.expires_at < now() then
    raise exception 'Ce lien d''invitation a expiré' using errcode = 'P0003';
  end if;
  if invite.uses >= invite.max_uses then
    raise exception 'Ce lien d''invitation a atteint sa limite' using errcode = 'P0004';
  end if;

  insert into public.trip_members as tm (trip_id, user_id, role)
  values (invite.trip_id, auth.uid(), 'member')
  on conflict (trip_id, user_id) do nothing;

  -- On ne consomme un usage du lien que si la personne rejoint vraiment :
  -- rouvrir le lien deux fois ne doit pas épuiser l'invitation.
  get diagnostics inserted_rows = row_count;
  if inserted_rows > 0 then
    update public.trip_invites set uses = uses + 1 where id = invite.id;
  end if;

  return query
    select t.id, t.title, t.cover_image_url
    from public.trips t
    where t.id = invite.trip_id and t.deleted_at is null;
end;
$$;

-- --------------------------------------------------------- Préférences ----
create table public.member_preferences (
  trip_id          uuid not null references public.trips(id) on delete cascade,
  user_id          uuid not null references public.profiles(id) on delete cascade,
  -- Les 8 axes, chacun entre 0 et 1. Contrôlé côté application par Zod et ici
  -- par une contrainte : la base ne fait pas confiance au client.
  weights          jsonb not null default '{}'::jsonb,
  budget_max_cents integer check (budget_max_cents >= 0),
  avoid            text[] not null default '{}',
  must_have        text[] not null default '{}',
  submitted        boolean not null default false,
  updated_at       timestamptz not null default now(),
  primary key (trip_id, user_id),
  constraint weights_are_unit_intervals check (public.weights_are_valid(weights))
);
create trigger member_preferences_touch before update on public.member_preferences
  for each row execute function public.touch_updated_at();

-- ------------------------------------------------- Catalogue destinations --
-- Données statiques versionnées avec le code : aucun appel réseau pour lire
-- le catalogue, et donc aucun quota consommé au démarrage d'une recherche.
create table public.destinations (
  id            text primary key,
  name          text not null,
  country       text not null,
  country_code  char(2) not null,
  lat           double precision not null,
  lng           double precision not null,
  iata          text[] not null default '{}',
  tags          jsonb not null check (public.weights_are_valid(tags)),
  cost_index    numeric(4,2) not null check (cost_index > 0),
  poi_richness  numeric(3,2) not null check (poi_richness between 0 and 1),
  best_months   smallint[] not null default '{}',
  timezone      text,
  image_url     text,
  wikidata_id   text,
  updated_at    timestamptz not null default now()
);
create index destinations_country_idx on public.destinations(country_code);

-- --------------------------------------------------------- Propositions ---
create table public.trip_proposals (
  id                 uuid primary key default gen_random_uuid(),
  trip_id            uuid not null references public.trips(id) on delete cascade,
  destination_id     text not null references public.destinations(id) on delete cascade,
  rank               smallint not null default 0,
  score_total        smallint not null check (score_total between 0 and 100),
  score_breakdown    jsonb not null default '[]'::jsonb,
  cost_breakdown     jsonb not null default '{}'::jsonb,
  total_cents        integer not null default 0,
  price_source       price_source not null default 'estimated',
  price_fetched_at   timestamptz,
  price_provider     text,
  summary            text not null default '',
  ai_explanation     text,
  created_at         timestamptz not null default now(),
  unique (trip_id, destination_id)
);
create index trip_proposals_trip_idx on public.trip_proposals(trip_id, rank);

-- ---------------------------------------------------------------- Votes ---
create table public.votes (
  id           uuid primary key default gen_random_uuid(),
  trip_id      uuid not null references public.trips(id) on delete cascade,
  subject_type vote_subject not null,
  subject_id   text not null,
  user_id      uuid not null references public.profiles(id) on delete cascade,
  value        vote_value not null,
  created_at   timestamptz not null default now(),
  unique (trip_id, subject_type, subject_id, user_id)
);
create index votes_trip_idx on public.votes(trip_id, subject_type, subject_id);

-- ----------------------------------------------------------------- Lieux --
create table public.places (
  id             text primary key,
  destination_id text not null references public.destinations(id) on delete cascade,
  name           text not null,
  category       text not null,
  axis           text,
  lat            double precision not null,
  lng            double precision not null,
  address        text,
  opening_hours  jsonb,
  price_level    smallint check (price_level between 0 and 4),
  rating         numeric(2,1),
  image_url      text,
  wiki_extract   text,
  external_url   text,
  source         text not null,
  fetched_at     timestamptz not null default now()
);
create index places_destination_idx on public.places(destination_id, category);

-- ------------------------------------------------------------ Itinéraire --
create table public.itineraries (
  id           uuid primary key default gen_random_uuid(),
  trip_id      uuid not null references public.trips(id) on delete cascade,
  version      smallint not null default 1,
  generated_by text not null default 'engine' check (generated_by in ('engine','ai','user')),
  is_active    boolean not null default true,
  created_at   timestamptz not null default now(),
  unique (trip_id, version)
);

create table public.itinerary_days (
  id               uuid primary key default gen_random_uuid(),
  itinerary_id     uuid not null references public.itineraries(id) on delete cascade,
  day_index        smallint not null check (day_index >= 1),
  date             date,
  summary          text,
  weather_snapshot jsonb,
  unique (itinerary_id, day_index)
);

create table public.itinerary_items (
  id         uuid primary key default gen_random_uuid(),
  day_id     uuid not null references public.itinerary_days(id) on delete cascade,
  -- Position fractionnaire : réordonner un élément n'écrit qu'une ligne, ce qui
  -- évite les conflits quand deux personnes déplacent des activités en même temps.
  position   numeric(12,6) not null,
  place_id   text references public.places(id) on delete set null,
  kind       itinerary_kind not null default 'activity',
  title      text not null,
  start_time time,
  end_time   time,
  cost_cents integer default 0 check (cost_cents >= 0),
  notes      text,
  created_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);
create index itinerary_items_day_idx on public.itinerary_items(day_id, position);
create trigger itinerary_items_touch before update on public.itinerary_items
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------- Hébergement & transport ---
create table public.accommodations (
  id                uuid primary key default gen_random_uuid(),
  trip_id           uuid not null references public.trips(id) on delete cascade,
  name              text not null,
  lat               double precision,
  lng               double precision,
  price_cents       integer check (price_cents >= 0),
  price_per         text not null default 'night_person' check (price_per in ('night_person','night_total','stay_total')),
  price_source      price_source not null default 'estimated',
  price_fetched_at  timestamptz,
  price_provider    text,
  rating            numeric(2,1),
  capacity          smallint,
  rooms             smallint,
  distance_center_m integer,
  booking_url       text,
  chosen            boolean not null default false,
  added_by          uuid references public.profiles(id) on delete set null,
  created_at        timestamptz not null default now()
);
create index accommodations_trip_idx on public.accommodations(trip_id);

create table public.transport_options (
  id               uuid primary key default gen_random_uuid(),
  trip_id          uuid not null references public.trips(id) on delete cascade,
  mode             transport_mode not null,
  from_label       text not null,
  to_label         text not null,
  depart_at        timestamptz,
  duration_min     integer check (duration_min >= 0),
  price_cents      integer check (price_cents >= 0),
  price_source     price_source not null default 'estimated',
  price_fetched_at timestamptz,
  price_provider   text,
  booking_url      text,
  chosen           boolean not null default false,
  created_at       timestamptz not null default now()
);
create index transport_options_trip_idx on public.transport_options(trip_id);

-- -------------------------------------------------------------- Dépenses --
create table public.expenses (
  id                uuid primary key default gen_random_uuid(),
  trip_id           uuid not null references public.trips(id) on delete cascade,
  paid_by           uuid not null references public.profiles(id) on delete restrict,
  amount_cents      integer not null check (amount_cents > 0),
  currency          char(3) not null default 'EUR',
  -- Taux figé au moment de la saisie : une dépense passée ne doit jamais
  -- changer de montant parce que l'euro a bougé.
  fx_rate           numeric(16,8) not null default 1,
  amount_home_cents integer not null check (amount_home_cents > 0),
  category          expense_category not null default 'other',
  label             text not null,
  spent_on          date not null default current_date,
  created_by        uuid not null references public.profiles(id) on delete restrict,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index expenses_trip_idx on public.expenses(trip_id, spent_on);
create trigger expenses_touch before update on public.expenses
  for each row execute function public.touch_updated_at();

create table public.expense_shares (
  expense_id  uuid not null references public.expenses(id) on delete cascade,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  share_cents integer not null check (share_cents >= 0),
  primary key (expense_id, user_id)
);

-- --------------------------------------------------- Tables techniques ----
-- Aucune politique permissive : le client n'y accède jamais, seul le
-- service_role des Edge Functions les lit et les écrit.
create table public.api_cache (
  key        text primary key,
  provider   text not null,
  payload    jsonb not null,
  fetched_at timestamptz not null default now(),
  expires_at timestamptz not null
);
create index api_cache_expiry_idx on public.api_cache(expires_at);

create table public.api_quota (
  provider   text not null,
  day        date not null default current_date,
  count      integer not null default 0,
  soft_limit integer not null,
  hard_limit integer not null,
  primary key (provider, day)
);

create table public.user_quota (
  user_id   uuid not null references public.profiles(id) on delete cascade,
  day       date not null default current_date,
  ai_calls  integer not null default 0,
  primary key (user_id, day)
);

create table public.ai_cache (
  input_hash text primary key,
  task       text not null,
  provider   text not null,
  output     jsonb not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);

create table public.fx_rates (
  base  char(3) not null,
  quote char(3) not null,
  rate  numeric(16,8) not null,
  day   date not null,
  primary key (base, quote, day)
);

-- Incrément atomique du compteur de quota : deux Edge Functions concurrentes
-- ne peuvent pas dépasser la limite en se marchant dessus.
create or replace function public.bump_api_quota(p_provider text, p_soft int, p_hard int)
returns table (used int, soft int, hard int)
language plpgsql security definer set search_path = public as $$
begin
  insert into public.api_quota (provider, day, count, soft_limit, hard_limit)
  values (p_provider, current_date, 1, p_soft, p_hard)
  on conflict (provider, day)
  do update set count = public.api_quota.count + 1,
                soft_limit = excluded.soft_limit,
                hard_limit = excluded.hard_limit
  returning public.api_quota.count, public.api_quota.soft_limit, public.api_quota.hard_limit
  into used, soft, hard;
  return next;
end;
$$;
