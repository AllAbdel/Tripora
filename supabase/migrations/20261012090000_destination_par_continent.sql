-- ============================================================================
-- « Surprends-nous », mais par où ?
--
-- Le moteur étudiait les vingt villes les plus proches et les moins chères du
-- départ : de France, toujours Bruxelles, Prague, Budapest, Cracovie, Berlin.
-- Le groupe peut désormais dire où chercher — l'Europe, l'Afrique, l'Asie, les
-- Amériques, l'Océanie — et le moteur ne propose que là, sans borne de
-- distance : choisir l'Asie pour un long week-end est un choix assumé, pas une
-- erreur à corriger.
--
-- Une liste vide veut dire « partout », comme avant.
--
-- C'est la même décision que le mode de destination : c'est l'organisateur
-- qui la prend, pour tout le groupe. Le déclencheur qui garde la destination
-- garde donc aussi cette colonne.
-- ============================================================================

alter table public.trips
  add column if not exists destination_regions text[] not null default '{}';

alter table public.trips
  drop constraint if exists trips_destination_regions_valides;
alter table public.trips
  add constraint trips_destination_regions_valides
  check (
    destination_regions <@ array[
      'europe', 'afrique', 'asie', 'amerique-du-nord', 'amerique-du-sud', 'oceanie'
    ]::text[]
  );

comment on column public.trips.destination_regions is
  'Où le moteur cherche les destinations en mode « suggest » : des continents (europe, afrique, asie, amerique-du-nord, amerique-du-sud, oceanie). Vide : partout.';

create or replace function public.guard_trip_decision()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
begin
  -- Les Edge Functions (service_role) n'ont pas d'utilisateur connecté.
  if auth.uid() is null then
    return new;
  end if;

  if (new.destination_locked_id is distinct from old.destination_locked_id
      or new.status is distinct from old.status
      or new.destination_mode is distinct from old.destination_mode
      or new.destination_shortlist is distinct from old.destination_shortlist
      or new.destination_regions is distinct from old.destination_regions)
     and new.owner_id <> auth.uid() then
    raise exception 'Seul l''organisateur du voyage peut arrêter la destination'
      using errcode = '42501';
  end if;

  return new;
end;
$$;
