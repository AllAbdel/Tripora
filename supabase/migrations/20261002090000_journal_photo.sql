-- ============================================================================
-- Le journal photo du voyage : les photos de chacun, au même endroit.
--
-- Après un voyage, les photos sont éparpillées entre cinq téléphones et
-- trois conversations, compressées par la messagerie. Le journal les range
-- par jour, visibles des seuls membres du voyage.
--
-- Chaque photo est déposée en deux fichiers dans l'espace privé `journal`,
-- rangés par voyage : la photo (`<voyage>/<id>.jpg`, 1 600 pixels au plus)
-- et sa vignette (`<voyage>/<id>.mini.jpg`, 480 pixels) — la grille ne
-- télécharge que les vignettes, ce qui compte en itinérance. L'application
-- recompresse chaque photo avant l'envoi, ce qui efface au passage ses
-- métadonnées (dont la position GPS que le téléphone y inscrit).
--
-- Gratuit et le restant : 2 Mo par fichier, 80 Mo par personne, 300 photos
-- par voyage, et plus aucun dépôt quand l'ensemble du stockage (documents
-- compris) approche le quota gratuit de Supabase (1 Go).
-- ============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('journal', 'journal', false, 2097152, array['image/jpeg'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create table public.photos_du_voyage (
  id          uuid primary key default gen_random_uuid(),
  trip_id     uuid not null references public.trips(id) on delete cascade,
  chemin      text not null unique,
  chemin_mini text not null unique,
  legende     text check (legende is null or length(btrim(legende)) between 1 and 280),
  -- Quand la photo a été prise, d'après le téléphone ; à défaut, son dépôt.
  prise_le    timestamptz,
  largeur     integer check (largeur between 1 and 4000),
  hauteur     integer check (hauteur between 1 and 4000),
  taille      bigint,
  ajoute_par  uuid references public.profiles(id) on delete set null default auth.uid(),
  ajoute_le   timestamptz not null default now()
);

create index photos_du_voyage_voyage_idx on public.photos_du_voyage (trip_id, prise_le);
create index photos_du_voyage_ajoute_par_idx on public.photos_du_voyage (ajoute_par);

-- ---------------------------------------------------------------- Quotas --
create or replace function public.limites_du_journal()
returns table (par_personne bigint, stockage_total bigint, par_voyage integer)
language sql immutable as $$
  select 80::bigint * 1024 * 1024, 900::bigint * 1024 * 1024, 300;
$$;

create or replace function public.espace_du_journal()
returns table (utilise bigint, limite bigint)
language sql stable security definer set search_path = public, storage as $$
  select
    coalesce((select sum((o.metadata->>'size')::bigint) from storage.objects o
              where o.bucket_id = 'journal' and o.owner_id = (select auth.uid())::text), 0),
    (select par_personne from public.limites_du_journal());
$$;

revoke execute on function public.espace_du_journal() from public, anon;
grant execute on function public.espace_du_journal() to authenticated;

-- Membre du voyage, sous son quota, et le stockage commun pas encore plein.
-- Le chemin a la forme des documents (« <voyage>/<fichier> ») : on réutilise
-- leur lecture du dossier.
create or replace function public.peut_deposer_une_photo(p_chemin text)
returns boolean language sql stable security definer set search_path = public, storage as $$
  select public.voyage_du_document(p_chemin) is not null
     and public.is_trip_member(public.voyage_du_document(p_chemin))
     and (select utilise < limite from public.espace_du_journal())
     and coalesce((select sum((o.metadata->>'size')::bigint) from storage.objects o
                   where o.bucket_id in ('documents', 'journal')), 0)
         < (select stockage_total from public.limites_du_journal());
$$;

revoke execute on function public.peut_deposer_une_photo(text) from public, anon;
grant execute on function public.peut_deposer_une_photo(text) to authenticated;

-- La fiche d'une photo : ses deux fichiers doivent exister, être à moi, et
-- ranger dans ce voyage. La taille vient du stockage, pas du client.
create or replace function public.photos_du_voyage_verifiees()
returns trigger language plpgsql security definer set search_path = public, storage as $$
declare
  photo record;
  mini record;
begin
  if tg_op = 'UPDATE' then
    -- Seule la légende change.
    new.trip_id := old.trip_id;
    new.chemin := old.chemin;
    new.chemin_mini := old.chemin_mini;
    new.prise_le := old.prise_le;
    new.largeur := old.largeur;
    new.hauteur := old.hauteur;
    new.taille := old.taille;
    new.ajoute_par := old.ajoute_par;
    new.ajoute_le := old.ajoute_le;
    return new;
  end if;

  if public.voyage_du_document(new.chemin) is distinct from new.trip_id
     or public.voyage_du_document(new.chemin_mini) is distinct from new.trip_id then
    raise exception 'La photo n''est pas rangée dans ce voyage'
      using errcode = 'check_violation';
  end if;

  select o.owner_id, o.metadata into photo
    from storage.objects o where o.bucket_id = 'journal' and o.name = new.chemin;
  select o.owner_id into mini
    from storage.objects o where o.bucket_id = 'journal' and o.name = new.chemin_mini;
  if photo.owner_id is distinct from (select auth.uid())::text
     or mini.owner_id is distinct from (select auth.uid())::text then
    raise exception 'Photo introuvable'
      using errcode = 'check_violation';
  end if;

  if (select count(*) from public.photos_du_voyage where trip_id = new.trip_id)
     >= (select par_voyage from public.limites_du_journal()) then
    raise exception 'Le journal de ce voyage est plein (300 photos)'
      using errcode = 'check_violation';
  end if;

  -- Une date de prise de vue dans le futur est une horloge déréglée.
  if new.prise_le is not null and new.prise_le > now() + interval '1 day' then
    new.prise_le := null;
  end if;
  new.taille := nullif(photo.metadata->>'size', '')::bigint;
  new.ajoute_par := (select auth.uid());
  return new;
end;
$$;

create trigger photos_du_voyage_verifiees before insert or update on public.photos_du_voyage
  for each row execute function public.photos_du_voyage_verifiees();

-- ------------------------------------------------------ Droits : la fiche --
alter table public.photos_du_voyage enable row level security;

create policy "journal : lu par les membres"
  on public.photos_du_voyage for select to authenticated
  using (public.is_trip_member(trip_id));

create policy "journal : ajout par les membres, à leur nom"
  on public.photos_du_voyage for insert to authenticated
  with check (ajoute_par = (select auth.uid()) and public.is_trip_member(trip_id));

create policy "journal : légende par son auteur"
  on public.photos_du_voyage for update to authenticated
  using (ajoute_par = (select auth.uid()) and public.is_trip_member(trip_id))
  with check (ajoute_par = (select auth.uid()));

create policy "journal : retiré par l'auteur ou l'organisateur"
  on public.photos_du_voyage for delete to authenticated
  using (public.is_trip_member(trip_id) and (ajoute_par = (select auth.uid()) or public.is_trip_owner(trip_id)));

revoke all on public.photos_du_voyage from anon;

-- --------------------------------------------------- Droits : le fichier --
create policy "journal : dépôt par les membres du voyage"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'journal' and public.peut_deposer_une_photo(name));

-- Tout le groupe voit toutes les photos : pas de photo privée dans un
-- journal partagé (le coffre est là pour ce qui ne regarde que soi).
create policy "journal : lu par les membres du voyage"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'journal'
    and (owner_id = (select auth.uid())::text or public.is_trip_member(public.voyage_du_document(name)))
  );

create policy "journal : retrait par l'auteur ou l'organisateur"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'journal'
    and (owner_id = (select auth.uid())::text or public.is_trip_owner(public.voyage_du_document(name)))
  );

alter table public.photos_du_voyage replica identity full;
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'photos_du_voyage'
     ) then
    alter publication supabase_realtime add table public.photos_du_voyage;
  end if;
end $$;

-- -------------------------------- Purge et suppression de compte : le journal
-- Les deux fonctions notaient les fichiers de l'espace `documents` à effacer ;
-- elles notent désormais aussi ceux du journal.

create or replace function public.purger_les_voyages_supprimes()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  purges integer;
begin
  insert into public.fichiers_a_effacer (bucket, chemin)
  select o.bucket_id, o.name
    from storage.objects o
    join public.trips t on t.id::text = split_part(o.name, '/', 1)
   where o.bucket_id in ('documents', 'journal')
     and t.deleted_at is not null
     and t.deleted_at < now() - interval '30 days'
  on conflict do nothing;

  delete from public.trips
   where deleted_at is not null
     and deleted_at < now() - interval '30 days';
  get diagnostics purges = row_count;
  return purges;
end;
$$;

revoke all on function public.purger_les_voyages_supprimes() from public, anon, authenticated;

create or replace function public.supprimer_mon_compte()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  moi uuid := auth.uid();
begin
  if moi is null then
    raise exception 'Connexion requise pour supprimer un compte' using errcode = '42501';
  end if;

  -- Les fichiers d'abord, tant qu'on sait encore à qui ils appartiennent.
  insert into public.fichiers_a_effacer (bucket, chemin)
  select o.bucket_id, o.name
    from storage.objects o
   where o.bucket_id in ('documents', 'journal')
     and (
       o.owner_id = moi::text
       or split_part(o.name, '/', 1) in (select t.id::text from public.trips t where t.owner_id = moi)
     )
  on conflict do nothing;

  -- Ses documents et ses photos dans les voyages des autres : leur fiche
  -- partirait orpheline (auteur mis à vide) vers un fichier effacé.
  delete from public.documents_du_voyage where ajoute_par = moi;
  delete from public.photos_du_voyage where ajoute_par = moi;

  -- Ses dépenses dans les voyages des autres, que la clé étrangère protège.
  delete from public.expenses where paid_by = moi or created_by = moi;

  delete from auth.users where id = moi;
end;
$$;

revoke all on function public.supprimer_mon_compte() from public, anon;
grant execute on function public.supprimer_mon_compte() to authenticated;
