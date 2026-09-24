-- ============================================================================
-- Supprimer son compte, soi-même, depuis l'application.
--
-- La page de confidentialité disait « écrivez-nous ». C'est légal, mais ce
-- n'est plus suffisant : Google Play exige qu'une application qui crée des
-- comptes permette de les supprimer depuis l'application elle-même. Et c'est
-- surtout plus juste — partir ne devrait pas demander d'écrire à quelqu'un.
--
-- Ce que la suppression emporte, tel que la page le promet :
--   - le compte et le profil ;
--   - les voyages que la personne organise, en entier (tout part en cascade) ;
--   - dans les voyages des autres : ses préférences, ses votes, ses messages
--     (cascade), et ses dépenses — la clé étrangère des dépenses les protège
--     (`on delete restrict`), on les retire donc explicitement ;
--   - ses documents, et ceux des voyages qu'elle organise : notés dans
--     `fichiers_a_effacer`, effacés du stockage par la fonction purge-fichiers.
-- ============================================================================

create or replace function public.supprimer_mon_compte()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  moi uuid := auth.uid();
begin
  if moi is null then
    raise exception 'Connexion requise pour supprimer un compte' using errcode = '42501';
  end if;

  -- Les fichiers d'abord, tant qu'on sait encore à qui ils appartiennent.
  insert into public.fichiers_a_effacer (bucket, chemin)
  select o.bucket_id, o.name
    from storage.objects o
   where o.bucket_id = 'documents'
     and (
       o.owner_id = moi::text
       or split_part(o.name, '/', 1) in (select t.id::text from public.trips t where t.owner_id = moi)
     )
  on conflict do nothing;

  -- Ses documents dans les voyages des autres : leur fiche partirait
  -- orpheline (auteur mis à vide) vers un fichier effacé.
  delete from public.documents_du_voyage where ajoute_par = moi;

  -- Ses dépenses dans les voyages des autres, que la clé étrangère protège.
  delete from public.expenses where paid_by = moi or created_by = moi;

  -- Le reste suit le compte en cascade : profil, voyages organisés, votes,
  -- préférences, messages, moyens de paiement…
  delete from auth.users where id = moi;
end;
$$;

comment on function public.supprimer_mon_compte() is
  'Supprime le compte de la personne connectée, ses voyages organisés et ses données. Irréversible.';

revoke all on function public.supprimer_mon_compte() from public, anon;
grant execute on function public.supprimer_mon_compte() to authenticated;
