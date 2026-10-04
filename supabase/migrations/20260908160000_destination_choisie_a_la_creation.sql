-- ============================================================================
-- Un voyage qui sait déjà où il va ne reçoit plus de suggestions.
--
-- L'assistant de création propose deux chemins : « Surprends-nous », où le
-- moteur compare des destinations et où le groupe vote, et « On sait déjà où
-- aller », où l'on choisit soi-même. Seul le premier était réellement
-- distingué : la table gardait la destination verrouillée, mais rien ne disait
-- si elle venait d'un choix initial ou d'un vote. L'écran du voyage affichait
-- donc, sous une destination choisie à la main, la liste des propositions du
-- moteur — c'est-à-dire des villes sans rapport, et systématiquement proches
-- du départ puisque la présélection borne la distance à la durée du séjour.
-- Quelqu'un qui choisissait Bali se voyait proposer des villes françaises.
--
-- Deux colonnes suffisent :
--
--  - `destination_mode` dit d'où vient la destination. Les propositions ne
--    s'affichent que pour « suggest ».
--  - `destination_shortlist` garde toutes les étapes choisies, dans l'ordre.
--    L'écran de création annonce « un voyage peut en enchaîner plusieurs » et
--    accepte plusieurs villes ; seule la première était enregistrée, les
--    autres disparaissaient sans un mot.
--
-- Reprise de l'existant : un voyage déjà verrouillé sans avoir reçu le moindre
-- vote a forcément été choisi à la main, c'est le seul cas possible.
-- ============================================================================

alter table public.trips
  add column if not exists destination_mode text not null default 'suggest',
  add column if not exists destination_shortlist text[] not null default '{}';

alter table public.trips
  drop constraint if exists trips_destination_mode_valide;
alter table public.trips
  add constraint trips_destination_mode_valide
  check (destination_mode in ('fixed', 'suggest'));

update public.trips t
   set destination_mode = 'fixed',
       destination_shortlist = array[t.destination_locked_id]
 where t.destination_locked_id is not null
   and t.destination_mode = 'suggest'
   and not exists (select 1 from public.votes v where v.trip_id = t.id);

comment on column public.trips.destination_mode is
  'D''où vient la destination : « fixed » choisie à la création, « suggest » laissée au moteur puis au vote du groupe.';
comment on column public.trips.destination_shortlist is
  'Les étapes choisies à la création, dans l''ordre. Vide en mode « suggest ».';

-- Le mode et la liste relèvent de la même décision que la destination
-- verrouillée : c'est l'organisateur qui choisit où l'on va, ou qui laisse le
-- groupe voter. Un membre ne doit pas pouvoir faire réapparaître ni disparaître
-- les propositions.
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
      or new.destination_shortlist is distinct from old.destination_shortlist)
     and new.owner_id <> auth.uid() then
    raise exception 'Seul l''organisateur du voyage peut arrêter la destination'
      using errcode = '42501';
  end if;

  return new;
end;
$$;
