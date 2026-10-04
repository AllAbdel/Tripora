-- ============================================================================
-- Qui a le droit de trancher.
--
-- La politique de modification d'un voyage est volontairement large : chaque
-- membre peut corriger le titre, les dates ou le budget, parce que ce sont des
-- détails d'organisation qui se règlent à plusieurs.
--
-- Arrêter la destination, en revanche, est LA décision du voyage. L'interface
-- ne montre le bouton qu'à l'organisateur ; sans ce garde-fou, la base
-- laisserait pourtant n'importe quel membre le faire en contournant l'écran.
-- Une promesse tenue seulement par l'interface n'est pas une promesse.
--
-- PostgreSQL n'a pas de RLS par colonne : le contrôle passe donc par un
-- déclencheur, qui ne regarde que les deux colonnes de décision et laisse tout
-- le reste libre.
-- ============================================================================

create or replace function public.guard_trip_decision()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  -- Les Edge Functions (service_role) et les tâches internes n'ont pas
  -- d'utilisateur connecté : elles ne sont pas concernées.
  if auth.uid() is null then
    return new;
  end if;

  if (new.destination_locked_id is distinct from old.destination_locked_id
      or new.status is distinct from old.status)
     and new.owner_id <> auth.uid() then
    raise exception 'Seul l''organisateur du voyage peut arrêter la destination'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

revoke all on function public.guard_trip_decision() from public, anon, authenticated;

drop trigger if exists trips_guard_decision on public.trips;
create trigger trips_guard_decision
  before update on public.trips
  for each row execute function public.guard_trip_decision();
