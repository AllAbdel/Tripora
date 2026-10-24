-- La clé publique des notifications n'est demandée qu'au moment de s'abonner,
-- par une personne connectée (compte invité compris : il porte le rôle
-- `authenticated`). Les visiteurs anonymes n'en ont aucun usage : on ne leur
-- ouvre plus cette fonction SECURITY DEFINER — signalée par l'analyseur de
-- sécurité de Supabase, même si la clé, publique par nature, ne trahit rien.
revoke execute on function public.cle_publique_push() from anon;
grant execute on function public.cle_publique_push() to authenticated;
