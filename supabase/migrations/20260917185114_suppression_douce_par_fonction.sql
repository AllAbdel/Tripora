-- ============================================================================
-- La suppression d'un voyage échouait pour tout le monde, y compris pour son
-- créateur : 403 systématique, sans exception.
--
-- La suppression est douce : l'application ne fait jamais `delete`, elle pose
-- `deleted_at`. Or PostgreSQL vérifie, pour toute ligne modifiée par un rôle
-- soumis à la RLS, qu'elle reste visible aux politiques de lecture après
-- l'écriture — et ce même sans `RETURNING`. La politique de lecture exige
-- `deleted_at is null`, c'est-à-dire exactement ce que la suppression douce
-- vient de rendre faux. Chaque tentative se heurtait donc à « new row
-- violates row-level security policy », quel que soit son auteur : le
-- créateur ne pouvait pas plus supprimer son propre voyage qu'un intrus.
--
-- Vérifié en reproduisant l'échec sur la ligne réelle avant d'écrire ce
-- correctif : `update trips set deleted_at = now() ...` échoue pour le
-- créateur ; `update trips set deleted_at = deleted_at ...` (sans vraie
-- transition) réussit ; retirer la politique de lecture fait réussir le
-- premier. La transition null → non-null de `deleted_at` est bien la seule
-- cause.
--
-- Au passage, la politique de modification ne distinguait pas le créateur des
-- autres membres : n'importe quel membre pouvait tenter de poser `deleted_at`
-- sur un voyage partagé, seule l'absence de bouton côté application
-- l'en empêchait jusqu'ici.
--
-- Une fonction dédiée, en SECURITY DEFINER — le même mécanisme déjà utilisé
-- pour `is_trip_member`, `add_owner_as_member` et `guard_trip_decision` —
-- écrit `deleted_at` sans passer par la politique de lecture, et vérifie
-- elle-même que seul le créateur l'appelle sur un voyage pas déjà supprimé.
-- ============================================================================

create or replace function public.soft_delete_trip(p_trip_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.trips
    where id = p_trip_id and owner_id = auth.uid() and deleted_at is null
  ) then
    raise exception 'Seul le créateur peut supprimer ce voyage' using errcode = '42501';
  end if;

  update public.trips set deleted_at = now() where id = p_trip_id;
end;
$$;

revoke all on function public.soft_delete_trip(uuid) from public, anon;
grant execute on function public.soft_delete_trip(uuid) to authenticated, service_role;

comment on function public.soft_delete_trip(uuid) is
  'Pose deleted_at pour le créateur du voyage, en contournant la politique de lecture qui rendrait sinon toute suppression douce impossible.';
