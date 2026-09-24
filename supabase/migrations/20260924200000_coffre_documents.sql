-- ============================================================================
-- Le coffre du voyage, seconde moitié : les documents.
--
-- Les billets du vol, la confirmation de l'hôtel, le bon de la visite : des
-- PDF et des captures éparpillés entre les boîtes mail de chacun. Ils vont
-- maintenant dans le coffre du voyage, lisibles par tout le groupe — ou par
-- soi seul, pour un scan de passeport.
--
-- Les fichiers vivent dans l'espace de stockage privé `documents`, rangés par
-- voyage (`<voyage>/<fichier>`) ; la table `documents_du_voyage` porte leur
-- nom, leur visibilité et leur auteur. Les politiques du stockage s'appuient
-- sur elle : on ne lit un fichier que si l'on peut lire sa fiche.
--
-- Gratuit et le restant : 10 Mo par fichier, 50 Mo par personne, et plus
-- aucun dépôt quand l'espace total approche le quota gratuit de Supabase
-- (1 Go). Mieux vaut un « coffre plein » clair qu'un projet bloqué.
-- ============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'documents', 'documents', false, 10485760,
  array['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create table public.documents_du_voyage (
  id          uuid primary key default gen_random_uuid(),
  trip_id     uuid not null references public.trips(id) on delete cascade,
  nom         text not null check (length(btrim(nom)) between 1 and 120),
  -- Le nom de l'objet dans l'espace `documents` : « <voyage>/<fichier> ».
  chemin      text not null unique,
  type_mime   text,
  taille      bigint,
  prive       boolean not null default false,
  ajoute_par  uuid references public.profiles(id) on delete set null default auth.uid(),
  ajoute_le   timestamptz not null default now()
);

create index documents_du_voyage_voyage_idx on public.documents_du_voyage (trip_id, ajoute_le);
create index documents_du_voyage_ajoute_par_idx on public.documents_du_voyage (ajoute_par);

-- ---------------------------------------------------------------- Quotas --
-- Les chiffres en un seul endroit, pour la base et pour l'écran qui les
-- affiche.
create or replace function public.limites_des_documents()
returns table (par_personne bigint, au_total bigint, par_voyage integer)
language sql immutable as $$
  select 50::bigint * 1024 * 1024, 800::bigint * 1024 * 1024, 100;
$$;

-- Ce que j'occupe, et ce que tout le monde occupe.
create or replace function public.espace_des_documents()
returns table (utilise bigint, limite bigint)
language sql stable security definer set search_path = public, storage as $$
  select
    coalesce((select sum((o.metadata->>'size')::bigint) from storage.objects o
              where o.bucket_id = 'documents' and o.owner_id = (select auth.uid())::text), 0),
    (select par_personne from public.limites_des_documents());
$$;

revoke execute on function public.espace_des_documents() from public, anon;
grant execute on function public.espace_des_documents() to authenticated;

-- Le voyage d'un chemin « <voyage>/<fichier> », ou null s'il n'en a pas la forme.
create or replace function public.voyage_du_document(p_chemin text)
returns uuid language plpgsql immutable set search_path = public as $$
declare
  dossiers text[] := storage.foldername(p_chemin);
begin
  if coalesce(array_length(dossiers, 1), 0) <> 1 then return null; end if;
  return dossiers[1]::uuid;
exception when invalid_text_representation then
  return null;
end;
$$;

-- Peut-on déposer un fichier à ce chemin ? Membre du voyage, sous son quota,
-- et l'espace commun pas encore plein. La taille du fichier en cours n'est
-- pas connue à ce moment-là : un dépôt peut dépasser d'au plus 10 Mo.
create or replace function public.peut_deposer_un_document(p_chemin text)
returns boolean language sql stable security definer set search_path = public, storage as $$
  select public.voyage_du_document(p_chemin) is not null
     and public.is_trip_member(public.voyage_du_document(p_chemin))
     and (select utilise < limite from public.espace_des_documents())
     and coalesce((select sum((o.metadata->>'size')::bigint) from storage.objects o
                   where o.bucket_id = 'documents'), 0)
         < (select au_total from public.limites_des_documents());
$$;

-- Peut-on lire ce fichier ? Celui qui l'a déposé, toujours ; les autres
-- membres, si sa fiche n'est pas privée.
create or replace function public.peut_lire_le_document(p_chemin text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.documents_du_voyage d
    where d.chemin = p_chemin
      and public.is_trip_member(d.trip_id)
      and (not d.prive or d.ajoute_par = (select auth.uid()))
  );
$$;

revoke execute on function public.peut_deposer_un_document(text) from public, anon;
revoke execute on function public.peut_lire_le_document(text) from public, anon;
grant execute on function public.peut_deposer_un_document(text) to authenticated;
grant execute on function public.peut_lire_le_document(text) to authenticated;

-- La fiche d'un document : son fichier doit exister, être à moi, et ranger
-- dans ce voyage. Taille et type viennent du fichier, pas du client.
create or replace function public.documents_du_voyage_verifies()
returns trigger language plpgsql security definer set search_path = public, storage as $$
declare
  objet record;
begin
  if tg_op = 'UPDATE' then
    -- Seuls le nom et la visibilité changent.
    new.trip_id := old.trip_id;
    new.chemin := old.chemin;
    new.type_mime := old.type_mime;
    new.taille := old.taille;
    new.ajoute_par := old.ajoute_par;
    new.ajoute_le := old.ajoute_le;
    return new;
  end if;

  if public.voyage_du_document(new.chemin) is distinct from new.trip_id then
    raise exception 'Le fichier n''est pas rangé dans ce voyage'
      using errcode = 'check_violation';
  end if;

  select o.owner_id, o.metadata into objet
    from storage.objects o
   where o.bucket_id = 'documents' and o.name = new.chemin;
  if not found or objet.owner_id is distinct from (select auth.uid())::text then
    raise exception 'Fichier introuvable'
      using errcode = 'check_violation';
  end if;

  if (select count(*) from public.documents_du_voyage where trip_id = new.trip_id)
     >= (select par_voyage from public.limites_des_documents()) then
    raise exception 'Le coffre de ce voyage est plein (100 documents)'
      using errcode = 'check_violation';
  end if;

  new.taille := nullif(objet.metadata->>'size', '')::bigint;
  new.type_mime := objet.metadata->>'mimetype';
  new.ajoute_par := (select auth.uid());
  return new;
end;
$$;

create trigger documents_du_voyage_verifies before insert or update on public.documents_du_voyage
  for each row execute function public.documents_du_voyage_verifies();

-- ------------------------------------------------------ Droits : la fiche --
alter table public.documents_du_voyage enable row level security;

create policy "documents : lecture par les membres, sauf les privés des autres"
  on public.documents_du_voyage for select to authenticated
  using (public.is_trip_member(trip_id) and (not prive or ajoute_par = (select auth.uid())));

create policy "documents : ajout par les membres, à leur nom"
  on public.documents_du_voyage for insert to authenticated
  with check (ajoute_par = (select auth.uid()) and public.is_trip_member(trip_id));

create policy "documents : renommés par leur auteur"
  on public.documents_du_voyage for update to authenticated
  using (ajoute_par = (select auth.uid()) and public.is_trip_member(trip_id))
  with check (ajoute_par = (select auth.uid()));

create policy "documents : retirés par l'auteur ou l'organisateur"
  on public.documents_du_voyage for delete to authenticated
  using (public.is_trip_member(trip_id) and (ajoute_par = (select auth.uid()) or public.is_trip_owner(trip_id)));

-- --------------------------------------------------- Droits : le fichier --
create policy "documents : dépôt par les membres du voyage"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'documents' and public.peut_deposer_un_document(name));

-- Son propre fichier se lit toujours : l'API de stockage relit la ligne
-- qu'elle vient d'insérer, avant même que la fiche existe.
create policy "documents : lecture selon la fiche"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'documents'
    and (owner_id = (select auth.uid())::text or public.peut_lire_le_document(name))
  );

create policy "documents : retrait par l'auteur ou l'organisateur"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'documents'
    and (owner_id = (select auth.uid())::text or public.is_trip_owner(public.voyage_du_document(name)))
  );

alter table public.documents_du_voyage replica identity full;
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'documents_du_voyage'
     ) then
    alter publication supabase_realtime add table public.documents_du_voyage;
  end if;
end $$;
