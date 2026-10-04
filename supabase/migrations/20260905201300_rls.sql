-- ============================================================================
-- Tripora — sécurité au niveau des lignes (RLS)
--
-- Modèle mental : « je vois un voyage si j'en suis membre, point ».
-- Tout le reste en découle. Les tables techniques n'ont aucune politique
-- permissive : sans politique, RLS activé = personne ne passe, sauf le
-- service_role des Edge Functions qui contourne RLS par conception.
-- ============================================================================

-- Fonctions d'accès en SECURITY DEFINER : elles court-circuitent la RLS des
-- tables qu'elles interrogent, ce qui évite les récursions entre politiques.
create or replace function public.can_access_itinerary(target uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select public.is_trip_member((select trip_id from public.itineraries where id = target));
$$;

create or replace function public.can_access_day(target uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select public.can_access_itinerary((select itinerary_id from public.itinerary_days where id = target));
$$;

create or replace function public.can_access_expense(target uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select public.is_trip_member((select trip_id from public.expenses where id = target));
$$;

-- Activation partout, y compris sur les tables techniques.
alter table public.profiles           enable row level security;
alter table public.trips              enable row level security;
alter table public.trip_members       enable row level security;
alter table public.trip_invites       enable row level security;
alter table public.member_preferences enable row level security;
alter table public.destinations       enable row level security;
alter table public.trip_proposals     enable row level security;
alter table public.votes              enable row level security;
alter table public.places             enable row level security;
alter table public.itineraries        enable row level security;
alter table public.itinerary_days     enable row level security;
alter table public.itinerary_items    enable row level security;
alter table public.accommodations     enable row level security;
alter table public.transport_options  enable row level security;
alter table public.expenses           enable row level security;
alter table public.expense_shares     enable row level security;
alter table public.api_cache          enable row level security;
alter table public.api_quota          enable row level security;
alter table public.user_quota         enable row level security;
alter table public.ai_cache           enable row level security;
alter table public.fx_rates           enable row level security;

-- ------------------------------------------------------------- Profils ----
-- On voit son propre profil, et celui des personnes avec qui on voyage :
-- juste ce qu'il faut pour afficher « Thomas a voté », rien de plus.
create policy "profil : lecture de soi et des covoyageurs"
  on public.profiles for select to authenticated
  using (
    id = auth.uid()
    or exists (
      select 1
      from public.trip_members mine
      join public.trip_members theirs on theirs.trip_id = mine.trip_id
      where mine.user_id = auth.uid() and theirs.user_id = public.profiles.id
    )
  );

create policy "profil : modification de soi uniquement"
  on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- ------------------------------------------------------------ Voyages -----
create policy "voyage : lecture par les membres"
  on public.trips for select to authenticated
  using (deleted_at is null and public.is_trip_member(id));

create policy "voyage : création par soi-même"
  on public.trips for insert to authenticated
  with check (owner_id = auth.uid());

create policy "voyage : modification par les membres"
  on public.trips for update to authenticated
  using (public.is_trip_member(id)) with check (public.is_trip_member(id));

-- Suppression réservée au créateur, et en douceur (deleted_at) côté application.
create policy "voyage : suppression par le créateur"
  on public.trips for delete to authenticated
  using (owner_id = auth.uid());

-- ------------------------------------------------------------ Membres -----
create policy "membres : lecture par les membres"
  on public.trip_members for select to authenticated
  using (public.is_trip_member(trip_id));

-- On rejoint un voyage par la fonction join_trip_with_code, jamais en insérant
-- une ligne à la main : c'est elle qui vérifie le code, l'expiration et l'usage.
create policy "membres : le créateur ajoute, chacun se retire"
  on public.trip_members for delete to authenticated
  using (user_id = auth.uid() or public.is_trip_owner(trip_id));

-- -------------------------------------------------------- Invitations -----
create policy "invitations : lecture par les membres"
  on public.trip_invites for select to authenticated
  using (public.is_trip_member(trip_id));

create policy "invitations : création par les membres"
  on public.trip_invites for insert to authenticated
  with check (public.is_trip_member(trip_id) and created_by = auth.uid());

create policy "invitations : révocation par le créateur du voyage"
  on public.trip_invites for update to authenticated
  using (public.is_trip_owner(trip_id)) with check (public.is_trip_owner(trip_id));

-- -------------------------------------------------------- Préférences -----
create policy "préférences : lecture par les membres"
  on public.member_preferences for select to authenticated
  using (public.is_trip_member(trip_id));

-- Chacun écrit SES préférences. Personne ne répond à la place d'un autre.
create policy "préférences : chacun les siennes (ajout)"
  on public.member_preferences for insert to authenticated
  with check (user_id = auth.uid() and public.is_trip_member(trip_id));

create policy "préférences : chacun les siennes (modification)"
  on public.member_preferences for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ------------------------------------------- Catalogue et lieux publics ---
create policy "destinations : lecture pour tous les connectés"
  on public.destinations for select to authenticated using (true);

create policy "lieux : lecture pour tous les connectés"
  on public.places for select to authenticated using (true);

-- ------------------------------------------------------- Propositions -----
create policy "propositions : lecture par les membres"
  on public.trip_proposals for select to authenticated
  using (public.is_trip_member(trip_id));
-- L'écriture est réservée aux Edge Functions : une proposition doit venir du
-- moteur de scoring, pas d'un client qui pourrait inventer une note.

-- ---------------------------------------------------------------- Votes ---
create policy "votes : lecture par les membres"
  on public.votes for select to authenticated
  using (public.is_trip_member(trip_id));

create policy "votes : chacun le sien (ajout)"
  on public.votes for insert to authenticated
  with check (user_id = auth.uid() and public.is_trip_member(trip_id));

create policy "votes : chacun le sien (modification)"
  on public.votes for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "votes : chacun le sien (retrait)"
  on public.votes for delete to authenticated
  using (user_id = auth.uid());

-- ------------------------------------------------------------ Itinéraire --
create policy "itinéraires : lecture par les membres"
  on public.itineraries for select to authenticated
  using (public.is_trip_member(trip_id));

create policy "itinéraires : écriture par les membres"
  on public.itineraries for all to authenticated
  using (public.is_trip_member(trip_id)) with check (public.is_trip_member(trip_id));

create policy "journées : accès par les membres"
  on public.itinerary_days for all to authenticated
  using (public.can_access_itinerary(itinerary_id))
  with check (public.can_access_itinerary(itinerary_id));

create policy "activités : accès par les membres"
  on public.itinerary_items for all to authenticated
  using (public.can_access_day(day_id)) with check (public.can_access_day(day_id));

-- ---------------------------------------------- Hébergement & transport ---
create policy "hébergements : accès par les membres"
  on public.accommodations for all to authenticated
  using (public.is_trip_member(trip_id)) with check (public.is_trip_member(trip_id));

create policy "transports : accès par les membres"
  on public.transport_options for all to authenticated
  using (public.is_trip_member(trip_id)) with check (public.is_trip_member(trip_id));

-- -------------------------------------------------------------- Dépenses --
create policy "dépenses : lecture par les membres"
  on public.expenses for select to authenticated
  using (public.is_trip_member(trip_id));

create policy "dépenses : ajout par les membres"
  on public.expenses for insert to authenticated
  with check (public.is_trip_member(trip_id) and created_by = auth.uid());

-- Une dépense se corrige par son auteur ou par le créateur du voyage :
-- ni plus (pas de réécriture des comptes des autres), ni moins (les fautes de
-- frappe doivent pouvoir se réparer).
create policy "dépenses : correction par l'auteur ou le créateur"
  on public.expenses for update to authenticated
  using (created_by = auth.uid() or public.is_trip_owner(trip_id))
  with check (created_by = auth.uid() or public.is_trip_owner(trip_id));

create policy "dépenses : suppression par l'auteur ou le créateur"
  on public.expenses for delete to authenticated
  using (created_by = auth.uid() or public.is_trip_owner(trip_id));

create policy "parts de dépense : accès par les membres du voyage"
  on public.expense_shares for all to authenticated
  using (public.can_access_expense(expense_id))
  with check (public.can_access_expense(expense_id));

-- ------------------------------------------------- Tables techniques ------
-- Volontairement sans aucune politique : RLS activé et zéro politique signifie
-- « aucun accès » pour anon et authenticated. Les Edge Functions utilisent la
-- clé service_role, qui n'est jamais exposée au client.
