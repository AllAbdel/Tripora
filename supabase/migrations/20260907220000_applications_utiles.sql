-- ============================================================================
-- Les applications qui changent un voyage, et qui les propose.
--
-- Arriver quelque part sans savoir qu'il existe une application de taxi locale
-- deux fois moins chère que le taxi de rue, ou qu'une carte de transport se
-- prend en cinq minutes à l'aéroport, coûte de l'argent et de la patience. Ce
-- sont des choses qu'on apprend en rentrant, quand il est trop tard.
--
-- Trois portées, dans la même table :
--
--  - **mondiale** : ni pays ni ville renseignés (une eSIM, un traducteur).
--  - **par pays** : `country_codes` (BiTaksi en Turquie, Grab en Asie du
--    Sud-Est). C'est le cas le plus fréquent — un pays partage ses services.
--  - **par ville** : `destination_ids` (l'İstanbulkart ne sert qu'à Istanbul).
--
-- Une application peut cumuler : Bolt couvre une trentaine de pays.
--
-- Et surtout : **n'importe quel membre peut en proposer une**, parce que
-- personne ne connaît tous les pays. Une proposition arrive en `pending` et
-- n'est visible que de son auteur jusqu'à ce qu'un administrateur la publie.
-- Sans cette validation, la liste se remplirait de parrainages et d'à-peu-près,
-- et c'est précisément la confiance dans ces recommandations qui fait leur
-- valeur.
-- ============================================================================

create type app_category as enum (
  'connectivite',       -- eSIM, VPN, wifi
  'orientation',        -- cartes, hors ligne
  'transport_local',    -- taxi, VTC, transports en commun
  'transport_longue',   -- bus, train, vols entre villes
  'hebergement',
  'activites',
  'nourriture',
  'argent',
  'langue',
  'securite'
);

create table public.travel_apps (
  id            text primary key check (id ~ '^[a-z0-9-]{2,60}$'),
  name          text not null check (length(btrim(name)) between 1 and 80),
  category      app_category not null,

  -- Une phrase qui dit à quoi ça sert, et une qui dit ce qu'on y gagne.
  -- Les deux sont obligatoires : « installez Saily » sans le pourquoi ne
  -- convainc personne et ne s'évalue pas.
  tagline       text not null check (length(btrim(tagline)) between 1 and 160),
  why           text not null check (length(btrim(why)) between 1 and 600),
  -- Ce qu'il faut savoir avant de s'y fier : une limite, un piège, un coût
  -- caché. Facultatif, mais c'est souvent le champ le plus utile.
  caveat        text check (length(caveat) <= 600),

  -- Liens de téléchargement. Voir le commentaire plus bas : ce sont des
  -- recherches dans les magasins, pas des identifiants de fiche.
  ios_url       text check (ios_url is null or ios_url ~ '^https://'),
  android_url   text check (android_url is null or android_url ~ '^https://'),
  web_url       text check (web_url is null or web_url ~ '^https://'),

  -- Portée. Les deux vides = partout.
  country_codes   text[] not null default '{}',
  destination_ids text[] not null default '{}',

  status        text not null default 'pending'
                check (status in ('pending', 'published', 'rejected')),
  /** Pour classer : plus c'est haut, plus ça remonte dans sa catégorie. */
  priority      smallint not null default 0 check (priority between 0 and 100),

  submitted_by  uuid references public.profiles(id) on delete set null,
  reviewed_by   uuid references public.profiles(id) on delete set null,
  review_note   text check (length(review_note) <= 600),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index travel_apps_publiees_idx on public.travel_apps(category, priority desc)
  where status = 'published';
create index travel_apps_pays_idx on public.travel_apps using gin (country_codes);
create index travel_apps_villes_idx on public.travel_apps using gin (destination_ids);

create trigger travel_apps_touch before update on public.travel_apps
  for each row execute function public.touch_updated_at();

comment on column public.travel_apps.ios_url is
  'Lien vers le magasin. On y met une recherche par nom plutôt qu''un identifiant de fiche : un identifiant inventé mène à une mauvaise application, ce qui est pire que pas de lien du tout.';

-- ----------------------------------------------------------- Administration --
-- Désignés par adresse e-mail et non par identifiant : il faut pouvoir nommer
-- un administrateur avant qu'il se soit connecté une première fois.
create table public.app_admins (
  email      text primary key check (position('@' in email) > 1),
  added_at   timestamptz not null default now()
);

insert into public.app_admins (email) values ('abdelslam.allaouat.pro@gmail.com');

create or replace function public.is_app_admin()
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.app_admins
    where lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

-- ------------------------------------------------------------------- Droits --
alter table public.travel_apps enable row level security;
alter table public.app_admins  enable row level security;

-- La liste des administrateurs ne regarde personne, pas même eux : rien à
-- lire côté client, la fonction ci-dessus suffit et ne fuit aucune adresse.
create policy "administrateurs : aucune lecture cliente"
  on public.app_admins for select to authenticated using (false);

create policy "applications : lecture des publiées"
  on public.travel_apps for select to authenticated
  using (
    status = 'published'
    -- On voit toujours ce qu'on a proposé soi-même, pour suivre où ça en est.
    or submitted_by = auth.uid()
    or public.is_app_admin()
  );

-- Une proposition entre en attente, signée de son auteur. Les deux conditions
-- sont dans le WITH CHECK : sans elles, n'importe qui publierait directement.
create policy "applications : proposition par les connectés"
  on public.travel_apps for insert to authenticated
  with check (
    public.is_app_admin()
    or (status = 'pending' and submitted_by = auth.uid())
  );

create policy "applications : modération par l'administrateur"
  on public.travel_apps for update to authenticated
  using (public.is_app_admin()) with check (public.is_app_admin());

create policy "applications : suppression par l'administrateur"
  on public.travel_apps for delete to authenticated
  using (public.is_app_admin());
