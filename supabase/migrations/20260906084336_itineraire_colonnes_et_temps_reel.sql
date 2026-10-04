-- ============================================================================
-- Ce qu'il manquait à l'itinéraire pour porter ce que le moteur produit.
--
-- Trois informations n'avaient pas de colonne, et ce sont justement celles qui
-- font la différence entre un planning et un planning *expliqué* :
--   axis        — l'envie servie, qui donne son icône et son sens au créneau
--   reason      — « Réservé pour Thomas, dont c'est la première envie »
--   for_user_id — le participant à qui le créneau est réservé
--
-- Sans elles, l'écran afficherait « Musées et monuments » sans jamais dire
-- pourquoi, et la promesse d'équité du moteur resterait invisible.
--
-- On ajoute aussi le type « soirée » : une sortie à 22 h 30 n'est ni une
-- activité de journée ni un repas.
-- ============================================================================

alter type itinerary_kind add value if not exists 'evening';

alter table public.itinerary_items
  add column if not exists axis        text,
  add column if not exists reason      text,
  add column if not exists for_user_id uuid references public.profiles(id) on delete set null;

-- Diffusion en direct : deux personnes peuvent réorganiser la même journée.
alter table public.itineraries      replica identity full;
alter table public.itinerary_days   replica identity full;
alter table public.itinerary_items  replica identity full;

do $$
declare cible text;
begin
  foreach cible in array array['itineraries', 'itinerary_days', 'itinerary_items'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = cible
    ) then
      execute format('alter publication supabase_realtime add table public.%I', cible);
    end if;
  end loop;
end $$;
