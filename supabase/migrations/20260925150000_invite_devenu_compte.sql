-- ============================================================================
-- Un compte invité qui devient un vrai compte.
--
-- Un ami qui rejoint un voyage par un code entre avec un compte invité : un
-- identifiant aléatoire, sur son seul appareil. Rattacher Google ou une
-- adresse e-mail à ce même compte le rend permanent, sans changer
-- d'identifiant — ses voyages, ses votes et ses dépenses restent les siens.
--
-- Supabase bascule alors `auth.users.is_anonymous` à faux. Le profil, lui,
-- gardait la valeur recopiée à la création : les trips ouverts continuaient
-- de refuser « compte-anonyme » à quelqu'un qui venait justement de créer son
-- compte pour s'y présenter. Ce déclencheur suit le changement.
--
-- Au passage, un profil encore sans nom prend celui que donne Google, ou le
-- début de l'adresse e-mail. Un nom déjà choisi n'est jamais écrasé : c'est
-- sous ce nom que le groupe le connaît.
-- ============================================================================

create or replace function public.synchroniser_le_profil_du_compte()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles as profil
     set is_anonymous = new.is_anonymous,
         display_name = case
           when coalesce(nullif(trim(profil.display_name), ''), 'Voyageur') = 'Voyageur'
             then coalesce(
               nullif(trim(new.raw_user_meta_data->>'full_name'), ''),
               nullif(trim(new.raw_user_meta_data->>'name'), ''),
               nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
               profil.display_name
             )
           else profil.display_name
         end,
         avatar_url = coalesce(profil.avatar_url, new.raw_user_meta_data->>'avatar_url')
   where profil.id = new.id;
  return new;
end;
$$;

-- Réservée au déclencheur : personne ne l'appelle à la main.
revoke all on function public.synchroniser_le_profil_du_compte() from public, anon, authenticated;

drop trigger if exists on_auth_user_devenu_compte on auth.users;
create trigger on_auth_user_devenu_compte
  after update of is_anonymous on auth.users
  for each row
  when (old.is_anonymous is distinct from new.is_anonymous)
  execute function public.synchroniser_le_profil_du_compte();
