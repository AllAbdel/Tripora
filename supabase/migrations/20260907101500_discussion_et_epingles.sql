-- ============================================================================
-- La discussion du voyage, et les endroits qu'on y épingle.
--
-- Un voyage entre amis ne se prépare pas dans un formulaire : il se prépare
-- dans une conversation. Quelqu'un tombe sur un endroit dans une vidéo, colle
-- le lien, et trois messages plus tard tout le monde a oublié où c'était.
--
-- D'où deux tables et une seule idée : ce qui est dit reste, et ce qui compte
-- se pose sur la carte.
--
--  - `trip_messages` : la conversation, à plat, par voyage.
--  - `trip_pins`     : un endroit retenu — un nom, une adresse, des
--                      coordonnées, éventuellement le lien d'où il vient.
--
-- Une épingle garde le message dont elle est issue (`message_id`), pour qu'on
-- puisse toujours remonter à « qui a proposé ça, et pourquoi ». Le lien est
-- gardé tel quel : l'application ne le suit jamais côté serveur, elle se
-- contente de l'afficher, et seuls `http` et `https` sont rendus cliquables
-- côté client.
--
-- Les coordonnées sont facultatives : on peut épingler « le resto dont parlait
-- Thomas » avant de savoir où il est. Sans coordonnées, l'épingle vit dans la
-- liste et n'apparaît pas sur la carte — plutôt que d'apparaître au mauvais
-- endroit.
-- ============================================================================

create table public.trip_messages (
  id         uuid primary key default gen_random_uuid(),
  trip_id    uuid not null references public.trips(id) on delete cascade,
  author_id  uuid not null references public.profiles(id) on delete cascade,
  body       text not null check (length(btrim(body)) between 1 and 2000),
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index trip_messages_trip_idx on public.trip_messages(trip_id, created_at);

create table public.trip_pins (
  id         uuid primary key default gen_random_uuid(),
  trip_id    uuid not null references public.trips(id) on delete cascade,
  created_by uuid not null references public.profiles(id) on delete cascade,
  label      text not null check (length(btrim(label)) between 1 and 120),
  address    text check (length(address) <= 300),
  -- Les deux ensemble ou aucune : une latitude sans longitude ne place rien.
  lat        double precision check (abs(lat) <= 90),
  lng        double precision check (abs(lng) <= 180),
  url        text check (length(url) <= 2000),
  note       text check (length(note) <= 1000),
  message_id uuid references public.trip_messages(id) on delete set null,
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint trip_pins_coordonnees_completes
    check ((lat is null) = (lng is null))
);
create index trip_pins_trip_idx on public.trip_pins(trip_id, created_at);

alter table public.trip_messages enable row level security;
alter table public.trip_pins     enable row level security;

-- ------------------------------------------------------------ Discussion ---
create policy "discussion : lecture par les membres"
  on public.trip_messages for select to authenticated
  using (public.is_trip_member(trip_id));

-- On écrit en son propre nom, dans un voyage dont on est membre. Les deux
-- conditions comptent : sans la première, on pourrait signer à la place d'un
-- autre ; sans la seconde, écrire chez des inconnus.
create policy "discussion : chacun écrit en son nom"
  on public.trip_messages for insert to authenticated
  with check (author_id = auth.uid() and public.is_trip_member(trip_id));

-- Effacer, c'est poser `deleted_at` : le fil garde sa cohérence, et une
-- épingle issue du message ne perd pas son origine.
create policy "discussion : l'auteur ou l'organisateur efface"
  on public.trip_messages for update to authenticated
  using (author_id = auth.uid() or public.is_trip_owner(trip_id))
  with check (author_id = auth.uid() or public.is_trip_owner(trip_id));

-- --------------------------------------------------------------- Épingles ---
create policy "épingles : lecture par les membres"
  on public.trip_pins for select to authenticated
  using (public.is_trip_member(trip_id));

create policy "épingles : ajout par les membres"
  on public.trip_pins for insert to authenticated
  with check (created_by = auth.uid() and public.is_trip_member(trip_id));

-- Une épingle appartient au groupe, pas à celui qui l'a posée : n'importe quel
-- membre peut corriger une adresse ou préciser un nom. C'est une carte
-- commune, et exiger l'auteur pour corriger une faute la figerait.
create policy "épingles : correction par les membres"
  on public.trip_pins for update to authenticated
  using (public.is_trip_member(trip_id))
  with check (public.is_trip_member(trip_id));

create policy "épingles : retrait par l'auteur ou l'organisateur"
  on public.trip_pins for delete to authenticated
  using (created_by = auth.uid() or public.is_trip_owner(trip_id));

-- ------------------------------------------------------------- Temps réel ---
-- Une conversation qui n'arrive pas toute seule n'est pas une conversation.
alter table public.trip_messages replica identity full;
alter table public.trip_pins     replica identity full;

do $$
declare cible text;
begin
  foreach cible in array array['trip_messages', 'trip_pins'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = cible
    ) then
      execute format('alter publication supabase_realtime add table public.%I', cible);
    end if;
  end loop;
end $$;
