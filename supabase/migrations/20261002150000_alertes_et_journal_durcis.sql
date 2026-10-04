-- ============================================================================
-- Ce que les conseillers de Supabase ont relevé sur les tables récentes.
--
-- 1. Les politiques des alertes de prix appelaient `auth.uid()` pour chaque
--    ligne lue. Entre parenthèses (`(select auth.uid())`), Postgres le calcule
--    une fois par requête : même règle, même résultat, sans le coût qui grandit
--    avec la table (voir 20260922201000_rls_evaluee_une_fois.sql).
-- 2. Un index manquait sous la clé étrangère des alertes vers leur suivi : un
--    suivi arrêté supprime ses alertes en cascade, et la cascade les cherchait
--    en parcourant toute la table.
-- 3. Trois fonctions de déclencheur restaient appelables par l'API. Elles n'y
--    font rien (une fonction de déclencheur refuse d'être appelée seule), mais
--    une porte qui ne mène nulle part reste une porte : on la ferme. Le
--    déclencheur, lui, continue de s'exécuter — Postgres ne vérifie ce droit
--    qu'à sa création.
-- 4. Les deux fonctions de plafonds n'avaient pas de chemin de recherche fixé.
-- ============================================================================

alter policy "Ses suivis de prix" on public.price_watches
  using (user_id = (select auth.uid()));

alter policy "Suivre un prix" on public.price_watches
  with check (
    user_id = (select auth.uid())
    and (trip_id is null or public.is_trip_member(trip_id))
    and first_cents is null and last_cents is null and lowest_cents is null
    and notified_cents is null and checked_at is null
  );

alter policy "Arrêter de suivre" on public.price_watches
  using (user_id = (select auth.uid()));

alter policy "Ses alertes" on public.price_alerts
  using (user_id = (select auth.uid()));

alter policy "Marquer ses alertes comme vues" on public.price_alerts
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

alter policy "Ses abonnements" on public.push_subscriptions
  using (user_id = (select auth.uid()));

alter policy "Se désabonner" on public.push_subscriptions
  using (user_id = (select auth.uid()));

create index if not exists price_alerts_watch_idx on public.price_alerts (watch_id);

revoke execute on function public.photos_du_voyage_verifiees() from public, anon, authenticated;
revoke execute on function public.documents_du_voyage_verifies() from public, anon, authenticated;
revoke execute on function public.signaler_les_envies() from public, anon, authenticated;

alter function public.limites_du_journal() set search_path = public;
alter function public.limites_des_documents() set search_path = public;
