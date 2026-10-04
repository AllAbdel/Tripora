-- Le déclencheur visait trop large : il effaçait aussi les liens posés par une
-- migration, qui n'a pas de session et donc pas d'adresse e-mail à vérifier.
-- Ce qu'il doit empêcher, c'est qu'une **proposition d'utilisateur** arrive
-- avec le lien de son auteur — pas qu'on administre la base.
--
-- Corrigé après l'avoir constaté : la première tentative de poser le lien Wise
-- l'a vu disparaître sans erreur, ce qui est le bon comportement pour un
-- utilisateur et le mauvais pour une migration.
create or replace function public.effacer_parrainage_non_administrateur()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- Aucune session : on est dans une migration ou un travail de fond, écrits
  -- par quelqu'un qui a déjà toutes les clés. Le rôle de service contourne la
  -- RLS de toute façon ; ce déclencheur n'aurait rien protégé de plus.
  if auth.uid() is null then
    return new;
  end if;

  if not public.is_app_admin() then
    new.referral_url := null;
    new.referral_note := null;
  end if;
  return new;
end;
$$;

-- Rejouée dans l'ordre sur une base neuve, la graine précédente passait avant
-- ce correctif : ses liens étaient donc effacés en silence, exactement comme
-- l'a été la première tentative. On les repose ici, une fois le déclencheur
-- devenu juste. Idempotent : sur une base déjà à jour, rien ne change.
update public.travel_apps
set referral_url  = 'https://wise.com/invite/ahpc/abdelslama1',
    referral_note = 'Lien de parrainage : Tripora et vous recevons chacun un avantage à l’ouverture. Le lien direct est juste à côté.'
where id = 'wise' and referral_url is null;

update public.travel_apps
set referral_url  = 'https://bour.so/p/xyxvlP0GvdG',
    referral_note = 'Lien de parrainage : Tripora et vous recevons chacun une récompense si le compte est ouvert avec un premier versement. Le lien direct est juste à côté.'
where id = 'boursobank' and referral_url is null;
