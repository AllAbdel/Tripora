-- ============================================================================
-- Alertes de prix : suivre un vol, être prévenu quand il baisse.
--
-- On suit un trajet (aéroport de départ → destination, pour un mois) ; chaque
-- matin, la fonction `surveiller-les-prix` relève le prix dans le cache
-- Aviasales de Travelpayouts. S'il a baissé d'au moins 10 % (et d'au moins
-- 15 €) depuis le dernier prix signalé, une alerte est écrite et une
-- notification part vers les navigateurs de la personne qui suit.
--
-- Tout est personnel : on ne voit, ne crée et ne supprime que ses propres
-- suivis. Les alertes et les relevés sont écrits par le serveur seul.
-- ============================================================================

create table public.price_watches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  -- Le voyage d'où le suivi a été lancé, pour y afficher la baisse.
  trip_id uuid references public.trips(id) on delete cascade,
  origin_iata text not null check (origin_iata ~ '^[A-Z]{3}$'),
  destination_id text not null check (char_length(destination_id) between 1 and 80),
  destination_name text not null check (char_length(destination_name) between 1 and 80),
  destination_iata text[] not null
    check (cardinality(destination_iata) between 1 and 6
           and array_to_string(destination_iata, ',') ~ '^[A-Z]{3}(,[A-Z]{3})*$'),
  -- Le mois visé, AAAA-MM. Un vol « n'importe quand » n'a pas de prix stable.
  month text not null check (month ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  first_cents integer check (first_cents > 0),
  last_cents integer check (last_cents > 0),
  lowest_cents integer check (lowest_cents > 0),
  -- Le dernier prix pour lequel une alerte est partie : la suivante doit
  -- faire mieux, sinon on prévient deux fois pour la même baisse.
  notified_cents integer check (notified_cents > 0),
  checked_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, origin_iata, destination_id, month)
);
create index price_watches_a_relever_idx on public.price_watches (checked_at nulls first);
create index price_watches_trip_idx on public.price_watches (trip_id);

alter table public.price_watches enable row level security;

create policy "Ses suivis de prix" on public.price_watches
  for select using (user_id = auth.uid());
create policy "Suivre un prix" on public.price_watches
  for insert with check (
    user_id = auth.uid()
    and (trip_id is null or public.is_trip_member(trip_id))
    -- Ce qu'on suit ne se relève que par le serveur : le client n'écrit pas
    -- de prix, il ne pourrait que se tromper ou tricher sur ses alertes.
    and first_cents is null and last_cents is null and lowest_cents is null
    and notified_cents is null and checked_at is null
  );
create policy "Arrêter de suivre" on public.price_watches
  for delete using (user_id = auth.uid());

-- Supabase accorde par défaut tous les droits sur une table neuve : on
-- repart de rien, et on n'accorde que ce que les politiques couvrent.
revoke all on public.price_watches from anon, authenticated;
grant select, insert, delete on public.price_watches to authenticated;

-- Vingt suivis par personne : au-delà, ce n'est plus préparer un voyage.
create or replace function public.borner_les_suivis_de_prix()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from public.price_watches where user_id = new.user_id) >= 20 then
    raise exception 'Vingt prix suivis au plus' using errcode = 'P0020';
  end if;
  return new;
end;
$$;
revoke all on function public.borner_les_suivis_de_prix() from public, anon, authenticated;

create trigger borner_les_suivis_de_prix
  before insert on public.price_watches
  for each row execute function public.borner_les_suivis_de_prix();

-- ---------------------------------------------------------------- les alertes

create table public.price_alerts (
  id uuid primary key default gen_random_uuid(),
  watch_id uuid not null references public.price_watches(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  old_cents integer not null check (old_cents > 0),
  new_cents integer not null check (new_cents > 0),
  created_at timestamptz not null default now(),
  seen_at timestamptz
);
create index price_alerts_user_idx on public.price_alerts (user_id, created_at desc);

alter table public.price_alerts enable row level security;

create policy "Ses alertes" on public.price_alerts
  for select using (user_id = auth.uid());
create policy "Marquer ses alertes comme vues" on public.price_alerts
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

revoke all on public.price_alerts from anon, authenticated;
grant select on public.price_alerts to authenticated;
-- Seule la date de lecture se modifie : ni le prix, ni la personne.
grant update (seen_at) on public.price_alerts to authenticated;

-- ------------------------------------------------- les abonnements du navigateur

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique check (endpoint ~ '^https://' and char_length(endpoint) <= 1000),
  p256dh text not null check (char_length(p256dh) between 20 and 200),
  auth text not null check (char_length(auth) between 8 and 100),
  created_at timestamptz not null default now()
);
create index push_subscriptions_user_idx on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;

create policy "Ses abonnements" on public.push_subscriptions
  for select using (user_id = auth.uid());
create policy "Se désabonner" on public.push_subscriptions
  for delete using (user_id = auth.uid());

revoke all on public.push_subscriptions from anon, authenticated;
grant select, delete on public.push_subscriptions to authenticated;

/**
 * S'abonner depuis ce navigateur.
 *
 * Passe par une fonction plutôt que par un insert : un même navigateur peut
 * changer de compte, et son adresse d'abonnement est unique. L'abonnement
 * change alors de propriétaire — sinon les alertes du compte suivant
 * n'arriveraient jamais, ou celles du précédent arriveraient au mauvais.
 */
create or replace function public.enregistrer_abonnement_push(p_endpoint text, p_p256dh text, p_auth text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then
    raise exception 'Connexion requise' using errcode = '28000';
  end if;
  insert into public.push_subscriptions (user_id, endpoint, p256dh, auth)
  values (auth.uid(), p_endpoint, p_p256dh, p_auth)
  on conflict (endpoint) do update
    set user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth, created_at = now();
end;
$$;
revoke all on function public.enregistrer_abonnement_push(text, text, text) from public, anon;
grant execute on function public.enregistrer_abonnement_push(text, text, text) to authenticated;

-- ------------------------------------------------------------ les clés VAPID

-- La paire de clés qui signe les notifications. Créée par la fonction serveur
-- à son premier passage : la clé privée naît et reste côté serveur. RLS sans
-- politique : ni le navigateur ni personne d'autre que le serveur ne la lit.
create table public.cles_push (
  id integer primary key default 1 check (id = 1),
  publique text not null,
  privee jsonb not null,
  created_at timestamptz not null default now()
);
alter table public.cles_push enable row level security;
revoke all on public.cles_push from anon, authenticated;

-- La clé publique, elle, est faite pour être donnée au navigateur.
create or replace function public.cle_publique_push()
returns text language sql security definer stable set search_path = public as $$
  select publique from public.cles_push where id = 1;
$$;
revoke all on function public.cle_publique_push() from public;
grant execute on function public.cle_publique_push() to anon, authenticated;

-- ------------------------------------------------------------ la planification

do $planification$
begin
  if not exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    raise notice 'pg_cron absent : relevé des prix non planifié (base de test).';
    return;
  end if;

  create extension if not exists pg_cron with schema pg_catalog;

  -- Chaque matin. La fonction ne relève que les suivis vieux de plus de
  -- vingt heures : l'appeler deux fois ne coûte rien de plus.
  perform cron.schedule(
    'surveiller-les-prix',
    '41 6 * * *',
    $job$
    select net.http_post(
      url := 'https://eelvllvgnsohznconfpt.supabase.co/functions/v1/surveiller-les-prix',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVlbHZsbHZnbnNvaHpuY29uZnB0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg2MzkxMTksImV4cCI6MjEwNDIxNTExOX0.QzyYAuYadGY7aLTx2ujfXsMN7gE7bK7dgZRoJ53k2Es'
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 120000
    )
    $job$
  );
end
$planification$;
