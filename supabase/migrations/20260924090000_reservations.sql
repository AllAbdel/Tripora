-- ============================================================================
-- Ce qui est réservé : l'hôtel, la visite, le train.
--
-- Tripora proposait des liens vers Booking ou GetYourGuide, puis perdait la
-- trace de ce qui s'y passait. La réservation vivait dans la boîte mail de
-- celui qui l'avait faite, et le groupe demandait sur la messagerie « c'est
-- quoi l'adresse de l'hôtel déjà ? » la veille du départ.
--
-- Aucune de ces plateformes n'ouvre d'API qui laisserait une application tierce
-- lire les réservations d'un client. Ce qu'elles envoient toutes, en revanche,
-- c'est un e-mail de confirmation — souvent avec, cachées dedans, les données
-- structurées que Gmail utilise pour ses cartes de voyage. L'application le
-- lit et remplit la fiche ; on la vérifie et on l'enregistre. Ce tableau garde
-- le résultat, que tout le groupe voit.
--
-- Les dates et heures sont celles **du lieu**, sans fuseau : l'arrivée à
-- l'hôtel est à 15 h à Bali, quel que soit le téléphone qui la lit. C'est la
-- convention de l'itinéraire, et celle de l'e-mail de confirmation.
-- ============================================================================

create table public.reservations (
  id          uuid primary key default gen_random_uuid(),
  trip_id     uuid not null references public.trips(id) on delete cascade,
  type        text not null check (type in ('hebergement', 'activite', 'transport', 'restaurant', 'autre')),
  -- Un identifiant court (« booking », « getyourguide ») ou « autre ».
  fournisseur text not null default 'autre' check (fournisseur ~ '^[a-z0-9-]{2,30}$'),
  titre       text not null check (length(btrim(titre)) between 1 and 200),

  debut_le    date not null,
  debut_a     time,
  fin_le      date,
  fin_a       time,

  adresse     text check (adresse is null or length(adresse) <= 300),
  lat         double precision check (lat is null or lat between -90 and 90),
  lng         double precision check (lng is null or lng between -180 and 180),

  -- Le numéro de confirmation : ce qu'on donne à l'accueil.
  reference   text check (reference is null or length(reference) <= 80),
  -- Le lien pour gérer la réservation. Jamais autre chose que du https : ce
  -- lien est cliqué par tout le groupe.
  lien        text check (lien is null or (lien ~ '^https://' and length(lien) <= 2000)),

  prix_cents  integer check (prix_cents is null or prix_cents between 0 and 100000000),
  devise      char(3) not null default 'EUR' check (devise ~ '^[A-Z]{3}$'),
  notes       text check (notes is null or length(notes) <= 2000),

  cree_par    uuid references public.profiles(id) on delete set null default auth.uid(),
  cree_le     timestamptz not null default now(),
  modifie_le  timestamptz not null default now(),

  constraint reservations_fin_apres_debut check (fin_le is null or fin_le >= debut_le)
);

create index reservations_voyage_idx on public.reservations (trip_id, debut_le);
create index reservations_cree_par_idx on public.reservations (cree_par);

create or replace function public.reservations_modifiees()
returns trigger language plpgsql set search_path = public as $$
begin
  new.modifie_le := now();
  -- Ni l'auteur ni le voyage ne changent : sinon « corriger » sa réservation
  -- permettrait de l'attribuer à un autre, ou de la glisser dans un voyage
  -- dont on n'est pas.
  new.cree_par := old.cree_par;
  new.trip_id := old.trip_id;
  return new;
end;
$$;

create trigger reservations_modifie_le before update on public.reservations
  for each row execute function public.reservations_modifiees();

-- ------------------------------------------------------------------ Droits --
alter table public.reservations enable row level security;

-- Tout le groupe lit : c'est tout l'intérêt.
create policy "réservations : lecture par les membres"
  on public.reservations for select to authenticated
  using (public.is_trip_member(trip_id));

-- Chacun ajoute les siennes, à son nom.
create policy "réservations : ajout par les membres"
  on public.reservations for insert to authenticated
  with check (cree_par = (select auth.uid()) and public.is_trip_member(trip_id));

-- On corrige et on retire ce qu'on a ajouté soi-même ; l'organisateur peut
-- aussi faire le ménage. Personne ne réécrit la réservation d'un autre.
create policy "réservations : modification par l'auteur ou l'organisateur"
  on public.reservations for update to authenticated
  using (
    public.is_trip_member(trip_id)
    and (cree_par = (select auth.uid()) or public.is_trip_owner(trip_id))
  )
  with check (public.is_trip_member(trip_id));

create policy "réservations : suppression par l'auteur ou l'organisateur"
  on public.reservations for delete to authenticated
  using (
    public.is_trip_member(trip_id)
    and (cree_par = (select auth.uid()) or public.is_trip_owner(trip_id))
  );

-- Une réservation ajoutée par un ami apparaît chez les autres sans recharger.
alter table public.reservations replica identity full;
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'reservations'
     ) then
    alter publication supabase_realtime add table public.reservations;
  end if;
end $$;
