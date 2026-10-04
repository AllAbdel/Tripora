-- ============================================================================
-- La valise de chacun, et ce que le groupe se partage.
--
-- La liste elle-même n'est pas stockée : elle se **recalcule** à partir de la
-- ville, du mois, de la durée et des envies (`packing.ts` dans le noyau). La
-- garder en base voudrait dire qu'elle se périme — une destination qui change,
-- un séjour rallongé, et la valise conseille encore des shorts pour janvier.
--
-- Ce qui se stocke, c'est donc uniquement **ce qui s'en écarte** :
--
--  - les cases cochées, qui n'appartiennent qu'à leur propriétaire ;
--  - les articles écartés, parce qu'on a déjà son adaptateur sur place ;
--  - les quantités corrigées à la main ;
--  - les articles ajoutés, que le calcul ne pouvait pas deviner ;
--  - et qui se charge d'un article **pour tout le groupe**.
--
-- Ce dernier point est le seul qui traverse les personnes. À quatre, emporter
-- quatre trousses à pharmacie et quatre adaptateurs est une erreur que
-- personne ne remarque avant d'avoir porté les sacs. Une ligne « Karim s'en
-- charge » suffit à l'éviter, et c'est pour ça que les valises des uns sont
-- lisibles par les autres — en lecture seule.
-- ============================================================================

create table public.trip_packing (
  trip_id     uuid not null references public.trips(id) on delete cascade,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  /** Identifiant du noyau (« tshirts ») ou d'un ajout personnel (« perso:… »). */
  -- Un identifiant du noyau, ou « perso:<slug> » pour un ajout à la main.
  item_id     text not null check (item_id ~ '^(perso:)?[a-z0-9-]{2,60}$'),

  checked     boolean not null default false,
  /** Écarté de la liste : on le garde en base pour ne pas le voir revenir. */
  removed     boolean not null default false,
  /** Quantité corrigée à la main. NULL = celle que le calcul propose. */
  quantity    smallint check (quantity is null or quantity between 0 and 99),

  -- Renseignés seulement pour un ajout personnel.
  label       text check (label is null or length(btrim(label)) between 1 and 80),
  category    text check (category is null or category ~ '^[a-z]{3,20}$'),

  /** Vrai quand cette personne emporte l'article pour tout le monde. */
  for_group   boolean not null default false,

  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  primary key (trip_id, user_id, item_id)
);

create index trip_packing_partage_idx on public.trip_packing(trip_id)
  where for_group;

create trigger trip_packing_touch before update on public.trip_packing
  for each row execute function public.touch_updated_at();

-- ------------------------------------------------------------- Le profil --
-- Ce que le calcul ne peut pas deviner, et qu'on ne demande qu'une fois.
--
-- Les besoins sont des **besoins**, pas des catégories de personnes : on ne
-- demande le genre de personne à personne pour proposer un soutien-gorge ou
-- des protections périodiques. Une liste fondée sur le genre se trompe pour
-- beaucoup de gens, et rate de toute façon le rasage, les lentilles ou un
-- traitement quotidien.
create table public.trip_packing_profiles (
  trip_id     uuid not null references public.trips(id) on delete cascade,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  needs       text[] not null default '{}',
  laundry     boolean not null default false,
  cabin_only  boolean not null default false,
  updated_at  timestamptz not null default now(),
  primary key (trip_id, user_id)
);

create trigger trip_packing_profiles_touch before update on public.trip_packing_profiles
  for each row execute function public.touch_updated_at();

-- ------------------------------------------------------------------ Droits --
alter table public.trip_packing          enable row level security;
alter table public.trip_packing_profiles enable row level security;

-- La valise des autres se lit — c'est ce qui permet de voir qui emporte quoi —
-- mais ne se modifie pas. Cocher à la place de quelqu'un n'aurait aucun sens.
create policy "valise : lecture par les membres du voyage"
  on public.trip_packing for select to authenticated
  using (public.is_trip_member(trip_id));

create policy "valise : chacun écrit la sienne"
  on public.trip_packing for insert to authenticated
  with check (user_id = auth.uid() and public.is_trip_member(trip_id));

create policy "valise : chacun modifie la sienne"
  on public.trip_packing for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "valise : chacun efface la sienne"
  on public.trip_packing for delete to authenticated
  using (user_id = auth.uid());

-- Le profil, lui, ne regarde que son propriétaire : savoir qui emporte un
-- traitement quotidien ou des protections périodiques n'est l'affaire de
-- personne d'autre.
create policy "profil de valise : le sien seulement"
  on public.trip_packing_profiles for select to authenticated
  using (user_id = auth.uid());

create policy "profil de valise : chacun crée le sien"
  on public.trip_packing_profiles for insert to authenticated
  with check (user_id = auth.uid() and public.is_trip_member(trip_id));

create policy "profil de valise : chacun modifie le sien"
  on public.trip_packing_profiles for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Les cases cochées et les prises en charge arrivent en direct : à deux jours
-- du départ, savoir que quelqu'un vient de prendre l'adaptateur évite d'en
-- acheter un deuxième.
alter publication supabase_realtime add table public.trip_packing;
