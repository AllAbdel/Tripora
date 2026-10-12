-- ============================================================================
-- « D'autres idées » : les destinations mises de côté.
--
-- Le groupe revoyait toujours les mêmes propositions, sans moyen d'en
-- demander d'autres. L'organisateur peut désormais mettre de côté celles que
-- personne n'a aimées : le moteur ne les étudie plus, et en propose de
-- nouvelles. Celles qui ont reçu un « j'aime » restent.
--
-- C'est une décision du groupe, comme les continents : la liste vit sur le
-- voyage, pas sur un appareil, pour que tout le monde vote sur les mêmes
-- destinations. Seul l'organisateur la change ; le déclencheur qui garde la
-- destination la garde aussi.
--
-- Bornée : le catalogue compte quelques centaines de villes ; au-delà de
-- mille identifiants, c'est une erreur ou un abus.
-- ============================================================================

alter table public.trips
  add column if not exists destination_ecartees text[] not null default '{}';

alter table public.trips
  drop constraint if exists trips_destination_ecartees_bornee;
alter table public.trips
  add constraint trips_destination_ecartees_bornee
  check (
    cardinality(destination_ecartees) <= 1000
    and octet_length(array_to_string(destination_ecartees, ',')) <= 64000
  );

comment on column public.trips.destination_ecartees is
  'Destinations mises de côté par l''organisateur (« D''autres idées ») : le moteur de suggestion ne les étudie plus. Vide : aucune.';

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
      or new.destination_regions is distinct from old.destination_regions
      or new.destination_ecartees is distinct from old.destination_ecartees)
     and new.owner_id <> auth.uid() then
    raise exception 'Seul l''organisateur du voyage peut arrêter la destination'
      using errcode = '42501';
  end if;

  return new;
end;
$$;
