-- Trips ouverts : fermer une fuite, et donner de quoi se protéger.
--
-- 1. LA FUITE. `motif_de_refus(trip, user)` était exécutable par tout compte
--    connecté, avec l'identifiant de n'importe qui. Elle répond « réservé aux
--    femmes », « trop jeune », « exclu »… : en la sondant contre quelques trips
--    ouverts, on apprenait le genre déclaré, la tranche d'âge et les exclusions
--    de n'importe quel utilisateur — précisément les données dont l'écran de
--    profil promet qu'elles ne servent qu'à appliquer une règle.
--
--    Elle n'a jamais eu besoin d'être publique : ses trois appelants sont des
--    fonctions `security definer`, qui s'exécutent avec les droits de leur
--    propriétaire. On retire donc le droit d'exécution aux comptes connectés.
--
-- 2. BLOQUER. Quand on fait se rencontrer des inconnus, le premier geste de
--    protection doit être immédiat et ne dépendre de personne : on bloque, et
--    les deux personnes cessent de se voir dans les trips ouverts, dans les
--    deux sens. On ne prévient pas la personne bloquée — lui dire, c'est lui
--    donner une raison de chercher un autre chemin.
--
-- 3. SIGNALER. Le second geste remonte à l'administration, qui peut retirer
--    quelqu'un des trips ouverts. On ne signale que quelqu'un avec qui on a
--    eu affaire — un voyage en commun ou une candidature —, pour que le
--    signalement ne devienne pas une arme contre des inconnus. Pas de
--    suspension automatique au nombre : un groupe de quatre personnes pourrait
--    sinon exclure n'importe qui en se coordonnant.
--
-- 4. FREINER. Cinq candidatures en attente au plus, quinze par jour. Au-delà,
--    ce n'est plus quelqu'un qui cherche un voyage, c'est quelqu'un qui
--    démarche.

-- ------------------------------------------------------------------ 1. la fuite
revoke execute on function public.motif_de_refus(uuid, uuid) from authenticated;

-- ------------------------------------------------------------------ 2. bloquer
create table if not exists public.blocages (
  bloqueur uuid not null references public.profiles(id) on delete cascade,
  bloque uuid not null references public.profiles(id) on delete cascade,
  cree_le timestamptz not null default now(),
  primary key (bloqueur, bloque),
  constraint on_ne_se_bloque_pas_soi_meme check (bloqueur <> bloque)
);
create index if not exists blocages_par_bloque on public.blocages (bloque);
alter table public.blocages enable row level security;
revoke all on public.blocages from anon, authenticated;

comment on table public.blocages is
  'Qui ne veut plus voir qui. Symétrique dans ses effets, jamais annoncé à la personne bloquée.';

-- ---------------------------------------------------------------- 3. signaler
do $$ begin
  create type public.motif_de_signalement as enum (
    'comportement', 'harcelement', 'faux-profil', 'arnaque', 'contenu', 'autre'
  );
exception when duplicate_object then null; end $$;

create table if not exists public.signalements (
  id uuid primary key default gen_random_uuid(),
  auteur uuid not null references public.profiles(id) on delete cascade,
  vise uuid not null references public.profiles(id) on delete cascade,
  trip_id uuid references public.trips(id) on delete set null,
  motif public.motif_de_signalement not null,
  detail text check (length(detail) <= 1000),
  cree_le timestamptz not null default now(),
  traite_le timestamptz,
  decision text check (decision in ('classe', 'suspendu')),
  constraint on_ne_se_signale_pas_soi_meme check (auteur <> vise)
);
create index if not exists signalements_a_traiter on public.signalements (cree_le) where traite_le is null;
create index if not exists signalements_par_vise on public.signalements (vise);
create index if not exists signalements_par_auteur on public.signalements (auteur, cree_le);
alter table public.signalements enable row level security;
revoke all on public.signalements from anon, authenticated;

alter table public.profiles
  add column if not exists suspendu_des_trips_ouverts timestamptz;

comment on column public.profiles.suspendu_des_trips_ouverts is
  'Posé par l''administration après signalement. Retire la personne des trips ouverts, sans toucher à ses voyages entre amis.';

-- Deux personnes ont-elles eu affaire l'une à l'autre ? Un voyage en commun,
-- ou une candidature dans un sens ou dans l'autre. C'est la condition pour
-- pouvoir signaler : sans elle, n'importe qui pourrait viser n'importe qui.
create or replace function public.ont_eu_affaire(p_a uuid, p_b uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
           select 1 from public.trip_members ma
             join public.trip_members mb on mb.trip_id = ma.trip_id
            where ma.user_id = p_a and mb.user_id = p_b)
      or exists (
           select 1 from public.trip_candidatures c
             join public.trips t on t.id = c.trip_id
            where (c.user_id = p_a and t.owner_id = p_b)
               or (c.user_id = p_b and t.owner_id = p_a));
$$;
revoke all on function public.ont_eu_affaire(uuid, uuid) from public, anon, authenticated;

-- --------------------------------------------- la règle d'admission, complétée
create or replace function public.motif_de_refus(p_trip_id uuid, p_user_id uuid)
returns text language plpgsql stable security definer set search_path = public, pg_temp as $$
declare
  pub public.trip_publications%rowtype;
  prof public.profiles%rowtype;
  age int; pris int; pris_femmes int; pris_hommes int;
begin
  select * into pub from public.trip_publications where trip_id = p_trip_id and ferme_le is null;
  if not found then return 'ferme'; end if;
  if exists (select 1 from public.trip_exclusions where trip_id = p_trip_id and user_id = p_user_id) then
    return 'exclu';
  end if;
  if exists (select 1 from public.trip_members where trip_id = p_trip_id and user_id = p_user_id) then
    return 'deja-membre';
  end if;
  select * into prof from public.profiles where id = p_user_id;
  if not found then return 'profil-absent'; end if;
  if prof.is_anonymous then return 'compte-anonyme'; end if;
  if prof.suspendu_des_trips_ouverts is not null then return 'suspendu'; end if;

  -- Un blocage dans un sens ou dans l'autre, avec n'importe quel membre. Le
  -- motif est volontairement neutre : « indisponible », jamais « bloqué ».
  if exists (
    select 1 from public.trip_members m
      join public.blocages b
        on (b.bloqueur = m.user_id and b.bloque = p_user_id)
        or (b.bloqueur = p_user_id and b.bloque = m.user_id)
     where m.trip_id = p_trip_id
  ) then
    return 'indisponible';
  end if;

  select count(*), count(*) filter (where pr.genre = 'femme'), count(*) filter (where pr.genre = 'homme')
    into pris, pris_femmes, pris_hommes
    from public.trip_members m join public.profiles pr on pr.id = m.user_id
   where m.trip_id = p_trip_id;

  if pris >= pub.places_max then return 'complet'; end if;
  if pub.mixite = 'femmes' and prof.genre is distinct from 'femme' then return 'reserve-aux-femmes'; end if;
  if pub.mixite = 'hommes' and prof.genre is distinct from 'homme' then return 'reserve-aux-hommes'; end if;
  if pub.places_femmes is not null and prof.genre = 'homme'
     and pris - pris_femmes >= pub.places_max - pub.places_femmes then
    return 'quota-hommes-atteint';
  end if;
  if pub.places_hommes is not null and prof.genre = 'femme'
     and pris - pris_hommes >= pub.places_max - pub.places_hommes then
    return 'quota-femmes-atteint';
  end if;
  if pub.age_min is not null or pub.age_max is not null then
    if prof.annee_naissance is null then return 'age-inconnu'; end if;
    age := extract(year from now())::int - prof.annee_naissance;
    if pub.age_min is not null and age < pub.age_min then return 'trop-jeune'; end if;
    if pub.age_max is not null and age > pub.age_max then return 'trop-age'; end if;
  end if;
  return null;
end; $$;
-- Recréer une fonction conserve ses droits, mais on le redit : c'est le point
-- de toute la migration, il ne doit pas dépendre d'un détail de Postgres.
revoke execute on function public.motif_de_refus(uuid, uuid) from public, anon, authenticated;

-- --------------------------------------------------------- 4. freiner, puis postuler
create or replace function public.postuler_au_trip(p_trip_id uuid, p_presentation text)
returns text language plpgsql security definer set search_path = public, pg_temp as $$
declare
  refus text; deja public.suite_candidature; pub public.trip_publications%rowtype;
  en_attente int; aujourdhui int;
begin
  if auth.uid() is null then raise exception 'Connectez-vous d''abord'; end if;
  select * into pub from public.trip_publications where trip_id = p_trip_id and ferme_le is null;
  if not found then raise exception 'Ce voyage n''est plus ouvert'; end if;
  if length(btrim(coalesce(p_presentation, ''))) < pub.presentation_minimum then
    raise exception 'Présentez-vous en % caractères au minimum', pub.presentation_minimum;
  end if;
  refus := public.motif_de_refus(p_trip_id, auth.uid());
  if refus is not null then raise exception 'refus:%', refus; end if;

  select count(*) filter (where suite = 'en-attente'),
         count(*) filter (where depose_le > now() - interval '24 hours')
    into en_attente, aujourdhui
    from public.trip_candidatures where user_id = auth.uid();
  if en_attente >= 5 then raise exception 'refus:trop-en-attente'; end if;
  if aujourdhui >= 15 then raise exception 'refus:trop-aujourdhui'; end if;

  select suite into deja from public.trip_candidatures where trip_id = p_trip_id and user_id = auth.uid();
  if deja = 'en-attente' then raise exception 'refus:deja-candidat'; end if;
  if deja = 'refusee' then raise exception 'refus:deja-refuse'; end if;

  insert into public.trip_candidatures (trip_id, user_id, presentation)
  values (p_trip_id, auth.uid(), btrim(p_presentation))
  on conflict (trip_id, user_id) do update
     set presentation = excluded.presentation, suite = 'en-attente',
         depose_le = now(), tranche_le = null;

  if pub.validation = 'auto' then
    insert into public.trip_members (trip_id, user_id, role)
    values (p_trip_id, auth.uid(), 'member') on conflict do nothing;
    update public.trip_candidatures set suite = 'acceptee', tranche_le = now()
     where trip_id = p_trip_id and user_id = auth.uid();
    return 'acceptee';
  end if;
  return 'en-attente';
end; $$;

-- Publier : une personne suspendue ne publie plus.
create or replace function public.publier_le_trip(
  p_trip_id uuid, p_resume text, p_mixite public.mixite_trip, p_places_max smallint,
  p_places_femmes smallint default null, p_places_hommes smallint default null,
  p_age_min smallint default null, p_age_max smallint default null,
  p_validation text default 'organisateur', p_rythme public.rythme_trip default 'equilibre',
  p_langues text[] default '{}', p_hebergement_partage boolean default false,
  p_presentation_minimum smallint default 80
) returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare v public.trips%rowtype;
begin
  select * into v from public.trips where id = p_trip_id and deleted_at is null;
  if not found then raise exception 'Voyage introuvable'; end if;
  if v.owner_id <> auth.uid() then raise exception 'Seul l''organisateur publie son voyage'; end if;
  if exists (select 1 from public.profiles where id = auth.uid() and suspendu_des_trips_ouverts is not null) then
    raise exception 'refus:suspendu';
  end if;
  if v.destination_locked_id is null then
    raise exception 'Arrêtez d''abord la destination : sans elle, personne ne peut vous trouver';
  end if;
  if v.origin_name is null then raise exception 'Renseignez d''abord le point de départ'; end if;
  if p_places_max < (select count(*) from public.trip_members where trip_id = p_trip_id) then
    raise exception 'Le voyage compte déjà plus de participants que de places annoncées';
  end if;

  insert into public.trip_publications as pub (
    trip_id, resume, mixite, places_max, places_femmes, places_hommes, age_min, age_max,
    validation, rythme, langues, hebergement_partage, presentation_minimum,
    destination_id, origine_nom, origine_iata, ferme_le
  ) values (
    p_trip_id, p_resume, p_mixite, p_places_max, p_places_femmes, p_places_hommes,
    p_age_min, p_age_max, p_validation, p_rythme, p_langues, p_hebergement_partage,
    p_presentation_minimum, v.destination_locked_id, v.origin_name, coalesce(v.origin_iata, '{}'), null
  )
  on conflict (trip_id) do update set
    resume = excluded.resume, mixite = excluded.mixite, places_max = excluded.places_max,
    places_femmes = excluded.places_femmes, places_hommes = excluded.places_hommes,
    age_min = excluded.age_min, age_max = excluded.age_max, validation = excluded.validation,
    rythme = excluded.rythme, langues = excluded.langues,
    hebergement_partage = excluded.hebergement_partage,
    presentation_minimum = excluded.presentation_minimum,
    destination_id = excluded.destination_id, origine_nom = excluded.origine_nom,
    origine_iata = excluded.origine_iata, ferme_le = null;
end; $$;

-- La recherche écarte aussi les trips d'une personne suspendue.
create or replace function public.chercher_trips_ouverts(
  p_destination_id text, p_origine_iata text[], p_limite int default 30
) returns setof public.trips_ouverts
language sql stable security definer set search_path = public, pg_temp as $$
  select o.* from public.trips_ouverts o
    join public.trips t on t.id = o.trip_id
    join public.profiles organisateur on organisateur.id = t.owner_id
   where o.destination_id = p_destination_id
     and o.origine_iata && p_origine_iata
     and t.owner_id <> auth.uid()
     and organisateur.suspendu_des_trips_ouverts is null
     and public.motif_de_refus(o.trip_id, auth.uid()) is null
   order by o.publie_le desc
   limit least(greatest(coalesce(p_limite, 30), 1), 60);
$$;

-- --------------------------------------------------- les gestes, côté personne
create or replace function public.bloquer(p_user_id uuid)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if auth.uid() is null then raise exception 'Connectez-vous d''abord'; end if;
  if p_user_id = auth.uid() then raise exception 'On ne se bloque pas soi-même'; end if;
  insert into public.blocages (bloqueur, bloque) values (auth.uid(), p_user_id)
  on conflict do nothing;
  -- Une candidature en attente de la personne bloquée chez moi n'a plus lieu
  -- d'attendre : on la tranche, sans que rien ne dise pourquoi.
  update public.trip_candidatures c
     set suite = 'refusee', tranche_le = now()
    from public.trips t
   where t.id = c.trip_id and t.owner_id = auth.uid()
     and c.user_id = p_user_id and c.suite = 'en-attente';
end; $$;

create or replace function public.debloquer(p_user_id uuid)
returns void language sql security definer set search_path = public, pg_temp as $$
  delete from public.blocages where bloqueur = auth.uid() and bloque = p_user_id;
$$;

create or replace function public.mes_blocages()
returns table (user_id uuid, nom text, depuis timestamptz)
language sql stable security definer set search_path = public, pg_temp as $$
  select b.bloque, p.display_name, b.cree_le
    from public.blocages b join public.profiles p on p.id = b.bloque
   where b.bloqueur = auth.uid()
   order by b.cree_le desc;
$$;

create or replace function public.signaler_quelquun(
  p_user_id uuid,
  p_motif public.motif_de_signalement,
  p_detail text default null,
  p_trip_id uuid default null,
  p_bloquer boolean default true
) returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if auth.uid() is null then raise exception 'Connectez-vous d''abord'; end if;
  if p_user_id = auth.uid() then raise exception 'On ne se signale pas soi-même'; end if;
  if not public.ont_eu_affaire(auth.uid(), p_user_id) then
    raise exception 'refus:sans-lien';
  end if;
  if (select count(*) from public.signalements
       where auteur = auth.uid() and cree_le > now() - interval '24 hours') >= 10 then
    raise exception 'refus:trop-de-signalements';
  end if;
  -- Un seul signalement en attente par personne visée : le répéter ne le rend
  -- pas plus urgent, ça encombre la file de ceux qui le liront.
  if exists (select 1 from public.signalements
              where auteur = auth.uid() and vise = p_user_id and traite_le is null) then
    raise exception 'refus:deja-signale';
  end if;

  insert into public.signalements (auteur, vise, trip_id, motif, detail)
  values (auth.uid(), p_user_id, p_trip_id, p_motif, nullif(btrim(coalesce(p_detail, '')), ''));

  if p_bloquer then perform public.bloquer(p_user_id); end if;
end; $$;

-- --------------------------------------------------- l'administration
create or replace function public.signalements_a_traiter()
returns table (
  id uuid, auteur_nom text, vise uuid, vise_nom text, motif public.motif_de_signalement,
  detail text, cree_le timestamptz, deja_signale int
)
language sql stable security definer set search_path = public, pg_temp as $$
  select s.id, a.display_name, s.vise, v.display_name, s.motif, s.detail, s.cree_le,
         (select count(distinct s2.auteur)::int from public.signalements s2 where s2.vise = s.vise)
    from public.signalements s
    join public.profiles a on a.id = s.auteur
    join public.profiles v on v.id = s.vise
   where s.traite_le is null and public.is_app_admin()
   order by s.cree_le;
$$;

create or replace function public.trancher_le_signalement(p_id uuid, p_suspendre boolean)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare cible uuid;
begin
  if not public.is_app_admin() then raise exception 'Réservé à l''administration'; end if;
  update public.signalements
     set traite_le = now(), decision = case when p_suspendre then 'suspendu' else 'classe' end
   where id = p_id and traite_le is null
  returning vise into cible;
  if cible is null then return; end if;
  if p_suspendre then
    update public.profiles set suspendu_des_trips_ouverts = now() where id = cible;
    -- Ses trips ouverts se referment, ses candidatures en attente tombent.
    update public.trip_publications pub set ferme_le = now()
      from public.trips t where t.id = pub.trip_id and t.owner_id = cible and pub.ferme_le is null;
    update public.trip_candidatures set suite = 'retiree', tranche_le = now()
     where user_id = cible and suite = 'en-attente';
    -- Les autres signalements visant la même personne sont réglés du même coup.
    update public.signalements set traite_le = now(), decision = 'suspendu'
     where vise = cible and traite_le is null;
  end if;
end; $$;

-- --------------------------------------------------------------- les droits
revoke all on function public.bloquer(uuid) from public, anon;
revoke all on function public.debloquer(uuid) from public, anon;
revoke all on function public.mes_blocages() from public, anon;
revoke all on function public.signaler_quelquun(uuid, public.motif_de_signalement, text, uuid, boolean) from public, anon;
revoke all on function public.signalements_a_traiter() from public, anon;
revoke all on function public.trancher_le_signalement(uuid, boolean) from public, anon;

grant execute on function public.bloquer(uuid) to authenticated;
grant execute on function public.debloquer(uuid) to authenticated;
grant execute on function public.mes_blocages() to authenticated;
grant execute on function public.signaler_quelquun(uuid, public.motif_de_signalement, text, uuid, boolean) to authenticated;
grant execute on function public.signalements_a_traiter() to authenticated;
grant execute on function public.trancher_le_signalement(uuid, boolean) to authenticated;
