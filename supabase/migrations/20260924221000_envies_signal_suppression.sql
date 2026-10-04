-- ============================================================================
-- Le signal des envies ne bloque plus la suppression d'un voyage.
--
-- Supprimer un voyage efface ses votes en cascade ; chaque vote effacé
-- touchait le signal `envies_modifiees` de ce voyage… en train de
-- disparaître, et la clé étrangère refusait l'écriture : la suppression
-- entière échouait. On ne signale plus rien pour un voyage qui n'existe plus
-- — il n'y a plus personne pour recompter.
-- ============================================================================

create or replace function public.signaler_les_envies()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  ligne public.votes;
begin
  ligne := case when tg_op = 'DELETE' then old else new end;
  if ligne.subject_type = 'place' then
    insert into public.envies_modifiees (trip_id, modifie_le)
    select ligne.trip_id, now()
    where exists (select 1 from public.trips t where t.id = ligne.trip_id)
    on conflict (trip_id) do update set modifie_le = excluded.modifie_le;
  end if;
  return null;
end;
$$;
