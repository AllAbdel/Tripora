-- ============================================================================
-- Les liens de parrainage, et la barrière qui les empêche de tout corrompre.
--
-- Tripora est gratuit et le restera. Un lien de parrainage sur deux ou trois
-- applications suffit à payer un nom de domaine ; il ne justifie pas de
-- sacrifier la seule chose qui donne de la valeur à ces recommandations, à
-- savoir qu'on peut les croire.
--
-- Trois garde-fous, dont deux sont dans le code et un dans cette table :
--
--  1. **le lien de parrainage s'ajoute, il ne remplace pas.** `web_url` reste
--     le lien direct, et l'interface affiche les deux. Qui ne veut pas nous
--     faire gagner d'argent clique à côté, sans avoir à le chercher ;
--  2. **le classement l'ignore.** `packages/core/src/apps.ts` trie sur la
--     portée et l'utilité déclarée, jamais sur la présence d'un parrainage.
--     Un test le vérifie, précisément pour que ça reste vrai dans six mois ;
--  3. **seul un administrateur peut en poser un.** Sans ça, la première
--     proposition venue arriverait avec le lien de son auteur, et le catalogue
--     deviendrait ce qu'il promet de ne pas être. Le déclencheur ci-dessous
--     efface le champ pour tout le monde sauf l'administrateur.
-- ============================================================================

alter table public.travel_apps
  add column referral_url text check (referral_url is null or referral_url ~ '^https://'),
  -- Ce que Tripora y gagne, dit en clair. Obligatoire dès qu'un lien existe :
  -- afficher « lien de parrainage » sans dire ce qu'on touche n'est pas une
  -- divulgation, c'est une formalité.
  add column referral_note text check (referral_note is null or length(referral_note) <= 200);

alter table public.travel_apps
  add constraint travel_apps_parrainage_explique
  check (referral_url is null or referral_note is not null);

comment on column public.travel_apps.referral_url is
  'Lien de parrainage, en plus du lien direct et jamais à sa place. Posé uniquement par un administrateur : un déclencheur efface le champ sur toute écriture faite par quelqu''un d''autre.';

create or replace function public.effacer_parrainage_non_administrateur()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not public.is_app_admin() then
    new.referral_url := null;
    new.referral_note := null;
  end if;
  return new;
end;
$$;

create trigger travel_apps_parrainage_reserve
  before insert or update on public.travel_apps
  for each row execute function public.effacer_parrainage_non_administrateur();
