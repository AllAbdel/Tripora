-- ============================================================================
-- L'organisateur ne quitte pas son propre voyage.
--
-- La politique de suppression d'une adhésion est déjà juste : chacun se
-- retire, l'organisateur peut retirer quelqu'un. Elle laisse pourtant passer
-- un cas qui casse tout — l'organisateur qui se retire lui-même.
--
-- Le voyage resterait alors debout, avec un `owner_id` qui ne correspond plus
-- à aucun membre : plus personne ne pourrait arrêter la destination (réservée
-- à l'organisateur), et lui-même perdrait l'accès à un voyage dont il reste
-- pourtant propriétaire. Deux sorties existent et suffisent : supprimer le
-- voyage, ou le laisser vivre sans y toucher.
-- ============================================================================

create or replace function public.guard_owner_stays()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  proprietaire uuid;
begin
  -- Les tâches internes et les Edge Functions n'ont pas d'utilisateur connecté.
  if auth.uid() is null then
    return old;
  end if;

  select owner_id into proprietaire from public.trips where id = old.trip_id;

  if proprietaire = old.user_id then
    raise exception
      'L''organisateur ne peut pas quitter son voyage : supprimez-le, ou laissez-le au groupe'
      using errcode = '42501';
  end if;

  return old;
end;
$$;

revoke all on function public.guard_owner_stays() from public, anon, authenticated;

drop trigger if exists trip_members_guard_owner on public.trip_members;
create trigger trip_members_guard_owner
  before delete on public.trip_members
  for each row execute function public.guard_owner_stays();
