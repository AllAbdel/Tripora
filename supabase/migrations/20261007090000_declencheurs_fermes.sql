-- ============================================================================
-- Les fonctions de déclenchement des votes secrets et des notifications ne
-- s'appellent pas depuis l'API.
--
-- Une fonction créée reçoit par défaut le droit d'exécution pour tout le
-- monde, et PostgREST l'expose alors en `/rest/v1/rpc/…`. Une fonction de
-- déclenchement n'y fait rien (Postgres refuse de l'appeler hors d'un
-- déclencheur), mais rien ne justifie qu'elle y figure : on ferme, comme pour
-- le signal des envies (migration alertes_et_journal_durcis). Les
-- déclencheurs, eux, s'exécutent avec les droits de leur propriétaire et ne
-- sont pas concernés.
-- ============================================================================

revoke execute on function public.signaler_les_votes() from public, anon, authenticated;
revoke execute on function public.signaler_une_voix() from public, anon, authenticated;
revoke execute on function public.sondage_votes_secret() from public, anon, authenticated;
revoke execute on function public.notifier_un_message() from public, anon, authenticated;
revoke execute on function public.notifier_une_depense() from public, anon, authenticated;
revoke execute on function public.notifier_une_arrivee() from public, anon, authenticated;
revoke execute on function public.notifier_un_sondage() from public, anon, authenticated;
revoke execute on function public.notifier_la_destination() from public, anon, authenticated;
revoke execute on function public.notifier_une_tache() from public, anon, authenticated;
revoke execute on function public.notifier_les_votes_complets() from public, anon, authenticated;
