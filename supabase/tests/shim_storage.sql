-- ============================================================================
-- Doublure locale du stockage de fichiers de Supabase (schéma storage).
--
-- Ce fichier n'est JAMAIS déployé. Il recrée le strict nécessaire pour que les
-- migrations qui déclarent un espace de stockage et ses politiques se
-- rejouent sur un Postgres nu : les tables `buckets` et `objects` (avec les
-- colonnes que nos politiques lisent), et `storage.foldername()`.
--
-- Côté Supabase, c'est l'API de stockage qui insère la ligne de l'objet au
-- nom de la personne connectée, sous ses politiques RLS ; les tests font de
-- même avec un simple INSERT sous le rôle `authenticated`.
-- ============================================================================

create schema if not exists storage;

create table if not exists storage.buckets (
  id                 text primary key,
  name               text not null,
  public             boolean default false,
  file_size_limit    bigint,
  allowed_mime_types text[],
  created_at         timestamptz default now(),
  updated_at         timestamptz default now()
);

create table if not exists storage.objects (
  id         uuid primary key default gen_random_uuid(),
  bucket_id  text references storage.buckets(id),
  name       text,
  owner_id   text default (auth.uid())::text,
  metadata   jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (bucket_id, name)
);

alter table storage.objects enable row level security;

-- Même définition que Supabase : les dossiers du chemin, sans le nom du fichier.
create or replace function storage.foldername(name text)
returns text[] language plpgsql immutable as $$
declare
  _parts text[];
begin
  select string_to_array(name, '/') into _parts;
  return _parts[1:array_length(_parts, 1) - 1];
end
$$;

grant usage on schema storage to anon, authenticated, service_role;
grant select, insert, update, delete on storage.objects to authenticated, service_role;
grant select on storage.buckets to anon, authenticated, service_role;
grant execute on function storage.foldername(text) to anon, authenticated, service_role;
