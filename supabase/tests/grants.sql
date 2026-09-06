-- Droits de table équivalents à ceux que Supabase applique par défaut.
-- La RLS reste le vrai filtre : ces GRANT ouvrent la porte, les politiques
-- décident qui passe.
grant usage on schema public to anon, authenticated, service_role;
grant all on all tables in schema public to anon, authenticated, service_role;
grant all on all sequences in schema public to anon, authenticated, service_role;
grant execute on all functions in schema public to anon, authenticated, service_role;
