-- Les politiques RLS évaluent `auth.uid()` une fois par requête, plus une
-- fois par ligne.
--
-- Écrite nue dans une politique, `auth.uid()` est rappelée pour chaque ligne
-- examinée : Postgres ne sait pas qu'elle rend la même valeur tout au long de
-- la requête. Enveloppée dans `(select auth.uid())`, elle devient un
-- sous-plan d'initialisation, calculé une fois. Sur la liste des voyages d'un
-- membre actif, c'est la différence entre cent appels et un.
--
-- Le conseiller de Supabase en relevait trente et une. Plutôt que de les
-- réécrire à la main — et d'en oublier une, ou d'en réécrire une de travers —
-- on parcourt les politiques existantes et on ne touche qu'à cet appel. La
-- boucle est idempotente : un appel déjà enveloppé est reconnu et laissé tel
-- quel, et la migration peut être rejouée sans rien casser.

do $$
declare
  p record;
  qual text;
  controle text;
  -- Un appel nu : pas précédé de « SELECT », qui est la forme que Postgres
  -- donne, une fois relue, à un appel déjà enveloppé.
  nu constant text := '(?<!SELECT )auth\.(uid|jwt)\(\)';
begin
  for p in
    select schemaname, tablename, policyname, pg_policies.qual as q, pg_policies.with_check as c
      from pg_policies
     where schemaname = 'public'
       and (coalesce(pg_policies.qual, '') ~ nu or coalesce(pg_policies.with_check, '') ~ nu)
  loop
    qual := regexp_replace(p.q, nu, '(select auth.\1())', 'g');
    controle := regexp_replace(p.c, nu, '(select auth.\1())', 'g');

    if p.q is not null and p.c is not null then
      execute format('alter policy %I on %I.%I using (%s) with check (%s)',
                     p.policyname, p.schemaname, p.tablename, qual, controle);
    elsif p.q is not null then
      execute format('alter policy %I on %I.%I using (%s)',
                     p.policyname, p.schemaname, p.tablename, qual);
    else
      execute format('alter policy %I on %I.%I with check (%s)',
                     p.policyname, p.schemaname, p.tablename, controle);
    end if;
  end loop;
end $$;

-- Les clés étrangères sans index.
--
-- Chacune sert deux fois : à la jointure qu'on écrit, et à la vérification
-- que Postgres fait lui-même quand on supprime la ligne visée — supprimer un
-- profil parcourt sinon, en entier, chaque table qui le référence.
create index if not exists accommodations_added_by_idx on public.accommodations (added_by);
create index if not exists expense_shares_user_idx on public.expense_shares (user_id);
create index if not exists expenses_created_by_idx on public.expenses (created_by);
create index if not exists expenses_paid_by_idx on public.expenses (paid_by);
create index if not exists itinerary_items_created_by_idx on public.itinerary_items (created_by);
create index if not exists itinerary_items_for_user_idx on public.itinerary_items (for_user_id);
create index if not exists itinerary_items_place_idx on public.itinerary_items (place_id);
create index if not exists member_preferences_user_idx on public.member_preferences (user_id);
create index if not exists travel_apps_reviewed_by_idx on public.travel_apps (reviewed_by);
create index if not exists travel_apps_submitted_by_idx on public.travel_apps (submitted_by);
create index if not exists trip_candidatures_user_idx on public.trip_candidatures (user_id);
create index if not exists trip_exclusions_user_idx on public.trip_exclusions (user_id);
create index if not exists trip_invites_created_by_idx on public.trip_invites (created_by);
create index if not exists trip_messages_author_idx on public.trip_messages (author_id);
create index if not exists trip_packing_user_idx on public.trip_packing (user_id);
create index if not exists trip_packing_profiles_user_idx on public.trip_packing_profiles (user_id);
create index if not exists trip_pins_created_by_idx on public.trip_pins (created_by);
create index if not exists trip_pins_message_idx on public.trip_pins (message_id);
create index if not exists trip_proposals_destination_idx on public.trip_proposals (destination_id);
create index if not exists votes_user_idx on public.votes (user_id);
