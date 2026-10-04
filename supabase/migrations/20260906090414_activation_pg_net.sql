-- pg_net permet à la base d'émettre des requêtes HTTP.
-- Deux usages ici : vérifier depuis le SQL qu'une Edge Function déployée
-- répond bien (l'environnement de développement n'a pas d'accès réseau vers
-- Supabase), et plus tard rafraîchir les taux de change par tâche planifiée.
--
-- L'extension est fournie par la plateforme Supabase, pas par un PostgreSQL
-- nu : le banc de test local ne l'a pas. Rien de ce qui est testé n'en dépend,
-- alors on la saute plutôt que de faire échouer toute la suite.
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_net') then
    execute 'create extension if not exists pg_net with schema extensions';
  else
    raise notice 'pg_net indisponible ici : activation ignorée.';
  end if;
end
$$;
