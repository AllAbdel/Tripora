-- ============================================================================
-- Rembourser en un geste : les moyens de paiement de chacun.
--
-- « Qui doit quoi » disait à Léa qu'elle devait 42,50 € à Tom, puis la
-- laissait demander son IBAN dans la messagerie. Chacun peut maintenant
-- indiquer comment il préfère être remboursé — PayPal.me, Revolut, Wise,
-- IBAN — et le virement s'ouvre d'un geste, montant compris quand le service
-- le permet.
--
-- Qui le voit : soi-même, et les gens avec qui l'on voyage — jamais au-delà.
-- Un IBAN n'est pas un secret (on le donne pour être payé), mais il n'a rien
-- à faire sous les yeux d'un inconnu croisé dans un trip ouvert qu'on n'a pas
-- rejoint.
-- ============================================================================

create table public.moyens_de_paiement (
  user_id     uuid primary key default auth.uid() references public.profiles(id) on delete cascade,
  -- Les identifiants, sans l'adresse du service : « tomdupont », pas
  -- « https://paypal.me/tomdupont ». L'application construit les liens.
  paypal      text check (paypal is null or paypal ~ '^[A-Za-z0-9]{1,20}$'),
  revolut     text check (revolut is null or revolut ~ '^[A-Za-z0-9._-]{3,32}$'),
  wise        text check (wise is null or wise ~ '^[A-Za-z0-9._-]{2,40}$'),
  -- Sans espaces, en majuscules ; la clé de contrôle est vérifiée côté client.
  iban        text check (iban is null or iban ~ '^[A-Z]{2}[0-9]{2}[A-Z0-9]{11,30}$'),
  titulaire   text check (titulaire is null or length(btrim(titulaire)) between 1 and 70),
  modifie_le  timestamptz not null default now()
);

create or replace function public.moyens_de_paiement_modifies()
returns trigger language plpgsql set search_path = public as $$
begin
  new.modifie_le := now();
  new.user_id := old.user_id;
  return new;
end;
$$;

create trigger moyens_de_paiement_modifies before update on public.moyens_de_paiement
  for each row execute function public.moyens_de_paiement_modifies();

alter table public.moyens_de_paiement enable row level security;

-- Soi-même, et les covoyageurs : quelqu'un avec qui l'on partage un voyage.
create policy "paiement : lecture par soi et ses covoyageurs"
  on public.moyens_de_paiement for select to authenticated
  using (
    user_id = (select auth.uid())
    or exists (
      select 1
      from public.trip_members mine
      join public.trip_members theirs on theirs.trip_id = mine.trip_id
      where mine.user_id = (select auth.uid()) and theirs.user_id = public.moyens_de_paiement.user_id
    )
  );

create policy "paiement : chacun écrit les siens"
  on public.moyens_de_paiement for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy "paiement : chacun modifie les siens"
  on public.moyens_de_paiement for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "paiement : chacun retire les siens"
  on public.moyens_de_paiement for delete to authenticated
  using (user_id = (select auth.uid()));
