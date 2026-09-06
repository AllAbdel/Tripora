-- Plafond d'appels IA par personne et par jour.
--
-- `bump_api_quota` protège déjà le fournisseur : il empêche le groupe entier de
-- brûler le quota gratuit. Il ne protège pas le groupe de l'un de ses membres.
-- Une page laissée ouverte qui relance l'assistant en boucle épuiserait le
-- quota commun avant midi, et couperait l'IA pour tous les autres.
--
-- D'où un second compteur, individuel. Il ne remplace pas le premier : les deux
-- se cumulent, du plus fin au plus large.
--
-- Comme `bump_api_quota`, la fonction est réservée à service_role : appelable
-- par le client, elle laisserait n'importe qui gonfler le compteur d'autrui.

create or replace function public.bump_user_ai_quota(p_user_id uuid, p_limit int)
returns table (used int, allowed boolean)
language plpgsql security definer set search_path = public as $$
begin
  insert into public.user_quota (user_id, day, ai_calls)
  values (p_user_id, current_date, 1)
  on conflict (user_id, day)
  do update set ai_calls = public.user_quota.ai_calls + 1
  returning public.user_quota.ai_calls into used;

  allowed := used <= p_limit;
  return next;
end;
$$;

revoke all on function public.bump_user_ai_quota(uuid, integer) from public, anon, authenticated;
grant execute on function public.bump_user_ai_quota(uuid, integer) to service_role;

-- Le cache d'IA se purge tout seul : une réponse expirée n'a plus de valeur, et
-- la table n'a aucune raison de grossir indéfiniment sur un plan gratuit.
create index if not exists ai_cache_expires_at_idx on public.ai_cache (expires_at);
