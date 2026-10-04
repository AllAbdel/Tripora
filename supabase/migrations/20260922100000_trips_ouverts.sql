-- Les trips ouverts : rejoindre le voyage de quelqu'un qu'on ne connaît pas.
--
-- Jusqu'ici un voyage se rejoignait par un lien ou un code : il fallait déjà
-- connaître quelqu'un. Un trip ouvert se publie, et des inconnus peuvent
-- demander à en être.
--
-- Ouvrir un voyage à des inconnus demande un encadrement, et l'encadrement
-- doit tenir **dans la base**. Une règle appliquée seulement à l'écran n'est
-- pas une règle : n'importe qui peut écrire directement dans PostgREST avec
-- la clé publique. Toutes les vérifications vivent donc dans des fonctions
-- `security definer`, et les tables elles-mêmes sont fermées en écriture.
--
-- Trois principes ont guidé le découpage :
--
--  1. **On sait dans quoi on s'engage avant d'entrer.** La fiche publique dit
--     la mixité, les places restantes, la tranche d'âge, le budget et le
--     rythme. Elle ne dit rien d'autre : ni les membres, ni l'itinéraire, ni
--     la discussion.
--  2. **Personne n'entre sans être accepté, sauf si l'organisateur l'a décidé.**
--     Le défaut est la validation manuelle.
--  3. **L'organisateur peut toujours refermer la porte.** Exclure quelqu'un le
--     sort du voyage et l'empêche de revenir.

-- ---------------------------------------------------------------- le profil

-- Le genre et l'année de naissance ne servent qu'ici, et restent facultatifs.
-- Sans eux, on ne peut rejoindre qu'un trip mixte sans condition d'âge : c'est
-- dit à l'écran, ce n'est pas une punition cachée.
do $$ begin
  create type public.genre_declare as enum ('femme', 'homme', 'autre');
exception when duplicate_object then null; end $$;

alter table public.profiles
  add column if not exists genre public.genre_declare,
  add column if not exists annee_naissance smallint
    check (annee_naissance is null or annee_naissance between 1900 and 2100);

comment on column public.profiles.genre is
  'Déclaré par la personne, facultatif. Ne sert qu''à appliquer la mixité d''un trip ouvert.';
comment on column public.profiles.annee_naissance is
  'Facultative. Ne sert qu''à appliquer la tranche d''âge d''un trip ouvert.';

-- ---------------------------------------------------------- la publication

do $$ begin
  create type public.mixite_trip as enum ('femmes', 'hommes', 'mixte');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.rythme_trip as enum ('tranquille', 'equilibre', 'intense');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.suite_candidature as enum ('en-attente', 'acceptee', 'refusee', 'retiree');
exception when duplicate_object then null; end $$;

create table if not exists public.trip_publications (
  trip_id uuid primary key references public.trips(id) on delete cascade,

  -- Ce qu'on annonce
  resume text not null check (length(btrim(resume)) between 20 and 1000),
  rythme public.rythme_trip not null default 'equilibre',
  langues text[] not null default '{}',
  hebergement_partage boolean not null default false,

  -- Qui peut entrer
  mixite public.mixite_trip not null default 'mixte',
  places_max smallint not null check (places_max between 2 and 30),
  -- Quotas facultatifs. Une place réservée aux femmes reste libre même si
  -- trois hommes attendent : c'est tout l'intérêt de la déclarer.
  places_femmes smallint check (places_femmes >= 0),
  places_hommes smallint check (places_hommes >= 0),
  age_min smallint check (age_min between 16 and 99),
  age_max smallint check (age_max between 16 and 99),

  -- Comment on entre
  validation text not null default 'organisateur'
    check (validation in ('auto', 'organisateur')),
  presentation_minimum smallint not null default 80
    check (presentation_minimum between 0 and 500),

  -- Ce sur quoi on apparie : même destination, même point de départ.
  destination_id text not null,
  origine_nom text not null,
  origine_iata text[] not null default '{}',

  publie_le timestamptz not null default now(),
  ferme_le timestamptz,

  constraint age_coherent check (age_min is null or age_max is null or age_min <= age_max),
  constraint quotas_tiennent_dans_les_places check (
    coalesce(places_femmes, 0) + coalesce(places_hommes, 0) <= places_max
  ),
  -- Un trip « femmes » avec un quota d'hommes est une contradiction : on
  -- refuse d'enregistrer ce qu'on serait bien en peine d'appliquer ensuite.
  constraint quotas_compatibles_avec_la_mixite check (
    (mixite <> 'femmes' or coalesce(places_hommes, 0) = 0)
    and (mixite <> 'hommes' or coalesce(places_femmes, 0) = 0)
  )
);

comment on table public.trip_publications is
  'Un voyage ouvert aux inconnus, et les règles auxquelles il l''est.';

create index if not exists trip_publications_appariement
  on public.trip_publications (destination_id)
  where ferme_le is null;

-- ---------------------------------------------------------- les candidatures

create table if not exists public.trip_candidatures (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  presentation text not null check (length(btrim(presentation)) <= 1000),
  suite public.suite_candidature not null default 'en-attente',
  -- Pourquoi c'est refusé. Facultatif, et jamais montré au candidat : il sert
  -- à l'organisateur qui relit sa liste trois semaines plus tard.
  note_privee text check (length(note_privee) <= 500),
  depose_le timestamptz not null default now(),
  tranche_le timestamptz,
  unique (trip_id, user_id)
);

create index if not exists trip_candidatures_par_voyage
  on public.trip_candidatures (trip_id, suite);

-- ------------------------------------------------------------ les exclusions

create table if not exists public.trip_exclusions (
  trip_id uuid not null references public.trips(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  motif text check (length(motif) <= 500),
  exclu_le timestamptz not null default now(),
  primary key (trip_id, user_id)
);

comment on table public.trip_exclusions is
  'Qui ne peut plus entrer, ni redemander. La sortie de secours de l''organisateur.';

alter table public.trip_publications enable row level security;
alter table public.trip_candidatures enable row level security;
alter table public.trip_exclusions enable row level security;

-- ------------------------------------------------------ ce qui est public

-- La fiche d'un trip ouvert, telle qu'un inconnu a le droit de la voir.
--
-- Elle dit tout ce qu'il faut pour décider, et rien de plus : pas les membres,
-- pas l'itinéraire, pas la discussion, pas le nom de l'organisateur. On compte
-- les places prises, on n'énumère pas qui les occupe.
create or replace view public.trips_ouverts
with (security_invoker = false) as
select
  p.trip_id,
  t.title,
  t.cover_image_url,
  p.resume,
  p.mixite,
  p.rythme,
  p.langues,
  p.hebergement_partage,
  p.places_max,
  p.places_femmes,
  p.places_hommes,
  p.age_min,
  p.age_max,
  p.validation,
  p.presentation_minimum,
  p.destination_id,
  p.origine_nom,
  p.origine_iata,
  p.publie_le,
  t.start_date,
  t.end_date,
  t.window_start,
  t.window_end,
  t.target_month,
  t.duration_days,
  t.budget_per_person_cents,
  t.currency,
  t.comfort_level,
  (select count(*) from public.trip_members m where m.trip_id = p.trip_id) as membres,
  (select count(*) from public.trip_members m
     join public.profiles pr on pr.id = m.user_id
    where m.trip_id = p.trip_id and pr.genre = 'femme') as membres_femmes,
  (select count(*) from public.trip_members m
     join public.profiles pr on pr.id = m.user_id
    where m.trip_id = p.trip_id and pr.genre = 'homme') as membres_hommes
from public.trip_publications p
join public.trips t on t.id = p.trip_id
where p.ferme_le is null
  and t.deleted_at is null;

comment on view public.trips_ouverts is
  'Ce qu''un inconnu voit d''un trip ouvert : de quoi décider, pas de quoi identifier quelqu''un.';

-- Pas de lecture directe, même pour un compte connecté : la règle demandée
-- est qu'un trip ouvert n'apparaisse **que** pour la même destination et le
-- même départ. Laisser `select * from trips_ouverts` ouvert reviendrait à
-- publier l'annuaire complet et à ne garder le filtre qu'à l'écran. Tout
-- passe donc par `chercher_trips_ouverts` et `voir_le_trip_ouvert`.
revoke all on public.trips_ouverts from anon, authenticated;

-- --------------------------------------------- la règle, en un seul endroit

-- Peut-on entrer, et sinon pourquoi ?
--
-- Écrite une fois, appelée par la candidature **et** par l'acceptation : deux
-- copies de cette règle finiraient par diverger, et c'est exactement le genre
-- de divergence qui laisse passer quelqu'un là où il n'aurait pas dû.
--
-- Renvoie NULL quand tout va bien, sinon un code que l'écran sait traduire.
create or replace function public.motif_de_refus(
  p_trip_id uuid,
  p_user_id uuid
) returns text
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  pub public.trip_publications%rowtype;
  prof public.profiles%rowtype;
  age int;
  pris int;
  pris_femmes int;
  pris_hommes int;
begin
  select * into pub from public.trip_publications where trip_id = p_trip_id and ferme_le is null;
  if not found then return 'ferme'; end if;

  if exists (select 1 from public.trip_exclusions
              where trip_id = p_trip_id and user_id = p_user_id) then
    return 'exclu';
  end if;

  if exists (select 1 from public.trip_members
              where trip_id = p_trip_id and user_id = p_user_id) then
    return 'deja-membre';
  end if;

  select * into prof from public.profiles where id = p_user_id;
  if not found then return 'profil-absent'; end if;

  -- Un compte anonyme peut rejoindre le voyage d'un ami par un lien : il sait
  -- qui l'a invité. Se présenter à des inconnus demande un peu plus.
  if prof.is_anonymous then return 'compte-anonyme'; end if;

  select count(*),
         count(*) filter (where pr.genre = 'femme'),
         count(*) filter (where pr.genre = 'homme')
    into pris, pris_femmes, pris_hommes
    from public.trip_members m
    join public.profiles pr on pr.id = m.user_id
   where m.trip_id = p_trip_id;

  if pris >= pub.places_max then return 'complet'; end if;

  -- La mixité. Sans genre déclaré, seuls les trips mixtes sont accessibles :
  -- on ne peut pas garantir une règle qu'on n'est pas en mesure de vérifier.
  if pub.mixite = 'femmes' and prof.genre is distinct from 'femme' then
    return 'reserve-aux-femmes';
  end if;
  if pub.mixite = 'hommes' and prof.genre is distinct from 'homme' then
    return 'reserve-aux-hommes';
  end if;

  -- Les quotas. Une place réservée aux femmes reste libre même si le voyage
  -- se remplit par ailleurs : c'est la seule façon qu'un groupe annoncé
  -- « autant de femmes que d'hommes » le soit encore à la fin.
  if pub.places_femmes is not null and prof.genre = 'homme'
     and pris - pris_femmes >= pub.places_max - pub.places_femmes then
    return 'quota-hommes-atteint';
  end if;
  if pub.places_hommes is not null and prof.genre = 'femme'
     and pris - pris_hommes >= pub.places_max - pub.places_hommes then
    return 'quota-femmes-atteint';
  end if;

  -- L'âge. Calculé sur l'année seule : on ne demande pas la date exacte, elle
  -- n'apporterait rien ici et c'est une donnée de plus à garder.
  if pub.age_min is not null or pub.age_max is not null then
    if prof.annee_naissance is null then return 'age-inconnu'; end if;
    age := extract(year from now())::int - prof.annee_naissance;
    if pub.age_min is not null and age < pub.age_min then return 'trop-jeune'; end if;
    if pub.age_max is not null and age > pub.age_max then return 'trop-age'; end if;
  end if;

  return null;
end;
$$;

revoke all on function public.motif_de_refus(uuid, uuid) from public, anon;
grant execute on function public.motif_de_refus(uuid, uuid) to authenticated;

-- ------------------------------------------------- publier et refermer

-- Publier un voyage. Réservé à l'organisateur, et à un voyage dont la
-- destination est arrêtée : sans destination, il n'y a rien à apparier.
create or replace function public.publier_le_trip(
  p_trip_id uuid,
  p_resume text,
  p_mixite public.mixite_trip,
  p_places_max smallint,
  p_places_femmes smallint default null,
  p_places_hommes smallint default null,
  p_age_min smallint default null,
  p_age_max smallint default null,
  p_validation text default 'organisateur',
  p_rythme public.rythme_trip default 'equilibre',
  p_langues text[] default '{}',
  p_hebergement_partage boolean default false,
  p_presentation_minimum smallint default 80
) returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v public.trips%rowtype;
begin
  select * into v from public.trips where id = p_trip_id and deleted_at is null;
  if not found then raise exception 'Voyage introuvable'; end if;
  if v.owner_id <> auth.uid() then
    raise exception 'Seul l''organisateur publie son voyage';
  end if;
  if v.destination_locked_id is null then
    raise exception 'Arrêtez d''abord la destination : sans elle, personne ne peut vous trouver';
  end if;
  if v.origin_name is null then
    raise exception 'Renseignez d''abord le point de départ';
  end if;
  -- Le nombre de places ne peut pas être inférieur au groupe déjà constitué :
  -- on n'ouvre pas un voyage en annonçant moins de monde qu'il n'y en a.
  if p_places_max < (select count(*) from public.trip_members where trip_id = p_trip_id) then
    raise exception 'Le voyage compte déjà plus de participants que de places annoncées';
  end if;

  insert into public.trip_publications as pub (
    trip_id, resume, mixite, places_max, places_femmes, places_hommes,
    age_min, age_max, validation, rythme, langues, hebergement_partage,
    presentation_minimum, destination_id, origine_nom, origine_iata, ferme_le
  ) values (
    p_trip_id, p_resume, p_mixite, p_places_max, p_places_femmes, p_places_hommes,
    p_age_min, p_age_max, p_validation, p_rythme, p_langues, p_hebergement_partage,
    p_presentation_minimum, v.destination_locked_id, v.origin_name,
    coalesce(v.origin_iata, '{}'), null
  )
  on conflict (trip_id) do update set
    resume = excluded.resume,
    mixite = excluded.mixite,
    places_max = excluded.places_max,
    places_femmes = excluded.places_femmes,
    places_hommes = excluded.places_hommes,
    age_min = excluded.age_min,
    age_max = excluded.age_max,
    validation = excluded.validation,
    rythme = excluded.rythme,
    langues = excluded.langues,
    hebergement_partage = excluded.hebergement_partage,
    presentation_minimum = excluded.presentation_minimum,
    destination_id = excluded.destination_id,
    origine_nom = excluded.origine_nom,
    origine_iata = excluded.origine_iata,
    ferme_le = null;
end;
$$;

-- Refermer. Les candidatures en attente sont refusées d'un coup : les laisser
-- en suspens ferait attendre des gens pour rien.
create or replace function public.refermer_le_trip(p_trip_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not exists (select 1 from public.trips
                  where id = p_trip_id and owner_id = auth.uid() and deleted_at is null) then
    raise exception 'Seul l''organisateur referme son voyage';
  end if;
  update public.trip_publications set ferme_le = now() where trip_id = p_trip_id;
  update public.trip_candidatures
     set suite = 'refusee', tranche_le = now()
   where trip_id = p_trip_id and suite = 'en-attente';
end;
$$;

-- ------------------------------------------------------ se porter candidat

create or replace function public.postuler_au_trip(
  p_trip_id uuid,
  p_presentation text
) returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  refus text;
  deja public.suite_candidature;
  pub public.trip_publications%rowtype;
begin
  if auth.uid() is null then raise exception 'Connectez-vous d''abord'; end if;

  select * into pub from public.trip_publications
   where trip_id = p_trip_id and ferme_le is null;
  if not found then raise exception 'Ce voyage n''est plus ouvert'; end if;

  if length(btrim(coalesce(p_presentation, ''))) < pub.presentation_minimum then
    raise exception 'Présentez-vous en % caractères au minimum', pub.presentation_minimum;
  end if;

  -- La même règle que pour l'acceptation, appelée avant d'écrire quoi que ce
  -- soit : on ne laisse pas quelqu'un déposer un dossier qui sera refusé par
  -- construction, ce serait le faire attendre pour rien.
  refus := public.motif_de_refus(p_trip_id, auth.uid());
  if refus is not null then raise exception 'refus:%', refus; end if;

  -- On ne revient pas frapper à une porte qui s'est fermée sur un refus ; on
  -- peut en revanche revenir après s'être retiré soi-même.
  select suite into deja from public.trip_candidatures
   where trip_id = p_trip_id and user_id = auth.uid();
  if deja = 'en-attente' then raise exception 'refus:deja-candidat'; end if;
  if deja = 'refusee' then raise exception 'refus:deja-refuse'; end if;

  insert into public.trip_candidatures (trip_id, user_id, presentation)
  values (p_trip_id, auth.uid(), btrim(p_presentation))
  on conflict (trip_id, user_id) do update
     set presentation = excluded.presentation,
         suite = 'en-attente',
         depose_le = now(),
         tranche_le = null;

  -- Validation automatique : l'organisateur a choisi de faire confiance.
  if pub.validation = 'auto' then
    insert into public.trip_members (trip_id, user_id, role)
    values (p_trip_id, auth.uid(), 'member')
    on conflict do nothing;
    update public.trip_candidatures
       set suite = 'acceptee', tranche_le = now()
     where trip_id = p_trip_id and user_id = auth.uid();
    return 'acceptee';
  end if;

  return 'en-attente';
end;
$$;

-- Retirer sa candidature tant qu'elle n'est pas tranchée.
create or replace function public.retirer_ma_candidature(p_trip_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.trip_candidatures
     set suite = 'retiree', tranche_le = now()
   where trip_id = p_trip_id and user_id = auth.uid() and suite = 'en-attente';
end;
$$;

-- --------------------------------------------- trancher, du côté organisateur

create or replace function public.trancher_la_candidature(
  p_trip_id uuid,
  p_user_id uuid,
  p_accepter boolean,
  p_note_privee text default null
) returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  refus text;
begin
  if not exists (select 1 from public.trips
                  where id = p_trip_id and owner_id = auth.uid() and deleted_at is null) then
    raise exception 'Seul l''organisateur tranche';
  end if;

  if not p_accepter then
    update public.trip_candidatures
       set suite = 'refusee', tranche_le = now(), note_privee = p_note_privee
     where trip_id = p_trip_id and user_id = p_user_id and suite = 'en-attente';
    return 'refusee';
  end if;

  -- On revérifie au moment d'accepter, pas seulement au dépôt : entre les
  -- deux, le voyage a pu se remplir, ou un quota se boucler.
  refus := public.motif_de_refus(p_trip_id, p_user_id);
  if refus is not null then raise exception 'refus:%', refus; end if;

  insert into public.trip_members (trip_id, user_id, role)
  values (p_trip_id, p_user_id, 'member')
  on conflict do nothing;

  update public.trip_candidatures
     set suite = 'acceptee', tranche_le = now(), note_privee = p_note_privee
   where trip_id = p_trip_id and user_id = p_user_id;

  return 'acceptee';
end;
$$;

-- Exclure : sortir quelqu'un du voyage et lui fermer la porte.
create or replace function public.exclure_du_trip(
  p_trip_id uuid,
  p_user_id uuid,
  p_motif text default null
) returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not exists (select 1 from public.trips
                  where id = p_trip_id and owner_id = auth.uid() and deleted_at is null) then
    raise exception 'Seul l''organisateur exclut';
  end if;
  if p_user_id = auth.uid() then
    raise exception 'On ne s''exclut pas de son propre voyage';
  end if;

  insert into public.trip_exclusions (trip_id, user_id, motif)
  values (p_trip_id, p_user_id, p_motif)
  on conflict (trip_id, user_id) do update set motif = excluded.motif;

  delete from public.trip_members where trip_id = p_trip_id and user_id = p_user_id;
  update public.trip_candidatures
     set suite = 'refusee', tranche_le = now()
   where trip_id = p_trip_id and user_id = p_user_id and suite = 'en-attente';
end;
$$;

create or replace function public.lever_l_exclusion(p_trip_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not exists (select 1 from public.trips
                  where id = p_trip_id and owner_id = auth.uid() and deleted_at is null) then
    raise exception 'Seul l''organisateur lève une exclusion';
  end if;
  delete from public.trip_exclusions where trip_id = p_trip_id and user_id = p_user_id;
end;
$$;

-- ------------------------------------------------------------- la recherche

-- Les trips ouverts qui correspondent à ce qu'on cherche.
--
-- La règle demandée est stricte : **même destination et même point de départ**.
-- Elle est stricte pour une bonne raison — un voyage ne se partage que si on
-- prend le même avion. Proposer Bali au départ de Lyon à quelqu'un qui part de
-- Paris, c'est proposer un voyage qu'il ne fera pas.
--
-- L'appariement des départs se fait sur les codes d'aéroport, pas sur le nom :
-- « Paris », « Paris-Orly » et « Paris-Charles-de-Gaulle » partagent le code
-- de ville PAR et doivent se trouver, alors que trois noms différents ne se
-- seraient jamais rencontrés. C'est aussi pour ça que les aéroports sont
-- nommés séparément dans le catalogue des départs.
--
-- Les voyages dont on est déjà membre, ceux dont on est exclu et le sien
-- propre sont écartés : les voir ne servirait à rien.
create or replace function public.chercher_trips_ouverts(
  p_destination_id text,
  p_origine_iata text[],
  p_limite int default 30
) returns setof public.trips_ouverts
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select o.*
    from public.trips_ouverts o
    join public.trips t on t.id = o.trip_id
   where o.destination_id = p_destination_id
     and o.origine_iata && p_origine_iata
     and t.owner_id <> auth.uid()
     -- La même règle décide de ce qu'on voit et de ce qu'on peut rejoindre.
     -- Deux conditions séparées finiraient par diverger, et la liste
     -- montrerait des voyages où l'on ne peut pas entrer — ce qui est
     -- exactement l'inverse de ce qu'on cherche à faire ici : un trip réservé
     -- aux femmes n'a rien à faire dans les résultats d'un homme, même assorti
     -- d'un « vous ne pouvez pas ». La liste écarte, elle ne nargue pas.
     and public.motif_de_refus(o.trip_id, auth.uid()) is null
   order by o.publie_le desc
   limit least(greatest(coalesce(p_limite, 30), 1), 60);
$$;

-- La fiche d'un trip ouvert précis, avec le motif de refus s'il y en a un.
-- Une seule requête pour tout ce que l'écran doit dire, y compris « pourquoi
-- je ne peux pas » — qui est la moitié de ce qu'on est venu savoir.
create or replace function public.voir_le_trip_ouvert(p_trip_id uuid)
returns table (
  fiche public.trips_ouverts,
  refus text,
  ma_candidature public.suite_candidature
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select o,
         public.motif_de_refus(o.trip_id, auth.uid()),
         (select c.suite from public.trip_candidatures c
           where c.trip_id = o.trip_id and c.user_id = auth.uid())
    from public.trips_ouverts o
   where o.trip_id = p_trip_id;
$$;

-- Les candidatures reçues, pour l'organisateur. Le nom et l'avatar viennent
-- avec : on n'accepte pas quelqu'un dont on ne voit qu'un identifiant.
create or replace function public.candidatures_recues(p_trip_id uuid)
returns table (
  user_id uuid,
  nom text,
  avatar_url text,
  genre public.genre_declare,
  age int,
  presentation text,
  suite public.suite_candidature,
  depose_le timestamptz
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select c.user_id,
         p.display_name,
         p.avatar_url,
         p.genre,
         case when p.annee_naissance is null then null
              else extract(year from now())::int - p.annee_naissance end,
         c.presentation,
         c.suite,
         c.depose_le
    from public.trip_candidatures c
    join public.profiles p on p.id = c.user_id
   where c.trip_id = p_trip_id
     and exists (select 1 from public.trips t
                  where t.id = c.trip_id and t.owner_id = auth.uid())
   order by (c.suite = 'en-attente') desc, c.depose_le;
$$;

-- Mes candidatures en cours, pour les retrouver et savoir où elles en sont.
create or replace function public.mes_candidatures()
returns table (
  trip_id uuid,
  titre text,
  destination_id text,
  origine_nom text,
  suite public.suite_candidature,
  depose_le timestamptz
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select c.trip_id, t.title, pub.destination_id, pub.origine_nom, c.suite, c.depose_le
    from public.trip_candidatures c
    join public.trips t on t.id = c.trip_id
    join public.trip_publications pub on pub.trip_id = c.trip_id
   where c.user_id = auth.uid() and t.deleted_at is null
   order by c.depose_le desc;
$$;

-- --------------------------------------------------------------- les droits

-- Les tables restent fermées en écriture directe : tout passe par les
-- fonctions ci-dessus, qui sont le seul endroit où la règle est appliquée.
-- Sans ça, la clé publique suffirait à s'inscrire à un voyage réservé.
revoke all on public.trip_publications from anon, authenticated;
revoke all on public.trip_candidatures from anon, authenticated;
revoke all on public.trip_exclusions from anon, authenticated;

-- Une seule lecture directe est utile : l'organisateur relit ses propres
-- réglages pour les modifier.
grant select on public.trip_publications to authenticated;

drop policy if exists "l_organisateur_lit_sa_publication" on public.trip_publications;
create policy "l_organisateur_lit_sa_publication" on public.trip_publications
  for select to authenticated
  using (exists (select 1 from public.trips t
                  where t.id = trip_id and t.owner_id = auth.uid()));

revoke all on function public.publier_le_trip(uuid, text, public.mixite_trip, smallint, smallint, smallint, smallint, smallint, text, public.rythme_trip, text[], boolean, smallint) from public, anon;
revoke all on function public.refermer_le_trip(uuid) from public, anon;
revoke all on function public.postuler_au_trip(uuid, text) from public, anon;
revoke all on function public.retirer_ma_candidature(uuid) from public, anon;
revoke all on function public.trancher_la_candidature(uuid, uuid, boolean, text) from public, anon;
revoke all on function public.exclure_du_trip(uuid, uuid, text) from public, anon;
revoke all on function public.lever_l_exclusion(uuid, uuid) from public, anon;
revoke all on function public.chercher_trips_ouverts(text, text[], int) from public, anon;
revoke all on function public.voir_le_trip_ouvert(uuid) from public, anon;
revoke all on function public.candidatures_recues(uuid) from public, anon;
revoke all on function public.mes_candidatures() from public, anon;

grant execute on function public.publier_le_trip(uuid, text, public.mixite_trip, smallint, smallint, smallint, smallint, smallint, text, public.rythme_trip, text[], boolean, smallint) to authenticated;
grant execute on function public.refermer_le_trip(uuid) to authenticated;
grant execute on function public.postuler_au_trip(uuid, text) to authenticated;
grant execute on function public.retirer_ma_candidature(uuid) to authenticated;
grant execute on function public.trancher_la_candidature(uuid, uuid, boolean, text) to authenticated;
grant execute on function public.exclure_du_trip(uuid, uuid, text) to authenticated;
grant execute on function public.lever_l_exclusion(uuid, uuid) to authenticated;
grant execute on function public.chercher_trips_ouverts(text, text[], int) to authenticated;
grant execute on function public.voir_le_trip_ouvert(uuid) to authenticated;
grant execute on function public.candidatures_recues(uuid) to authenticated;
grant execute on function public.mes_candidatures() to authenticated;
