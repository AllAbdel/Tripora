-- ============================================================================
-- Durcissement, après l'audit de sécurité du projet en ligne.
--
-- PostgREST expose automatiquement en RPC toute fonction du schéma `public`.
-- Nos fonctions internes se retrouvaient donc appelables depuis Internet par
-- n'importe qui, sur /rest/v1/rpc/<nom>. Une seule était réellement dangereuse,
-- mais toutes sont refermées ici.
--
-- La faille : `bump_api_quota` incrémente le compteur du garde-quota. Exposée,
-- elle permettait à un inconnu de faire croire que le quota gratuit du jour
-- était épuisé, et donc de couper l'IA et les prix pour tout le groupe. Elle
-- n'est appelée que par les Edge Functions, qui utilisent service_role : elle
-- n'a rien à faire dans l'API publique.
--
-- Chaque fonction est traitée selon son usage réel, vérifié dans le catalogue :
--
--   fonction               policy ?  trigger ?  qui doit pouvoir l'exécuter
--   ---------------------  --------  ---------  ---------------------------
--   bump_api_quota         non       non        service_role seul
--   add_owner_as_member    non       oui        personne (voir plus bas)
--   handle_new_user        non       oui        personne
--   touch_updated_at       non       oui        personne
--   join_trip_with_code    non       non        les connectés uniquement
--   is_trip_member         OUI       non        les connectés (via RLS)
--   is_trip_owner          OUI       non        les connectés
--   can_access_day         OUI       non        les connectés
--   can_access_expense     OUI       non        les connectés
--   can_access_itinerary   OUI       non        les connectés
--   weights_are_valid      non       non (CHECK) les connectés (voir plus bas)
--
-- Pourquoi retirer le droit d'exécution sur des fonctions de déclencheur ne
-- casse rien : PostgreSQL vérifie EXECUTE au moment du CREATE TRIGGER, pas à
-- chaque déclenchement. Vérifié par la suite de tests locale, qui crée bien un
-- profil, un voyage et son membre propriétaire une fois les droits retirés.
--
-- Une contrainte CHECK, en revanche, ne suit PAS cette règle : son droit est
-- vérifié à chaque écriture. Retirer EXECUTE sur `weights_are_valid` faisait
-- échouer toute saisie de préférences avec « permission denied for function ».
-- La suite de tests l'a attrapé avant la mise en ligne ; la fonction garde donc
-- son droit pour les connectés. Elle ne prend qu'un jsonb et renvoie un booléen :
-- l'exposer ne révèle rien.
--
-- Enfin, les fonctions citées dans une politique RLS sont évaluées avec les
-- droits de la personne qui interroge : elles gardent leur droit pour
-- `authenticated`, et le perdent seulement pour `anon`.
-- ============================================================================

-- ------------------------------------------------------- Fonctions internes --
-- Aucune raison d'être joignable depuis l'extérieur.
revoke all on function public.bump_api_quota(text, integer, integer) from public, anon, authenticated;
grant execute on function public.bump_api_quota(text, integer, integer) to service_role;

revoke all on function public.add_owner_as_member() from public, anon, authenticated;
revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.touch_updated_at() from public, anon, authenticated;

-- Validateur des poids de préférences : appelé par une contrainte CHECK, donc
-- son droit est vérifié à chaque écriture. Les connectés doivent le garder.
revoke all on function public.weights_are_valid(jsonb) from public, anon;
grant execute on function public.weights_are_valid(jsonb) to authenticated, service_role;

-- ------------------------------------------------- Rejoindre par invitation --
-- C'est bien un point d'entrée public de l'API, mais réservé aux connectés :
-- la fonction refuse déjà auth.uid() nul, autant que le refus vienne aussi de
-- la couche des droits.
revoke all on function public.join_trip_with_code(text) from public, anon;
grant execute on function public.join_trip_with_code(text) to authenticated;

-- -------------------------------------------- Fonctions d'accès (politiques) --
-- Elles restent exécutables par les connectés, sans quoi toutes les politiques
-- RLS qui s'appuient dessus refuseraient l'accès. On coupe seulement `anon`,
-- qui n'évalue jamais ces politiques (toutes sont déclarées `to authenticated`).
revoke all on function public.is_trip_member(uuid) from public, anon;
revoke all on function public.is_trip_owner(uuid) from public, anon;
revoke all on function public.can_access_day(uuid) from public, anon;
revoke all on function public.can_access_expense(uuid) from public, anon;
revoke all on function public.can_access_itinerary(uuid) from public, anon;

grant execute on function public.is_trip_member(uuid) to authenticated, service_role;
grant execute on function public.is_trip_owner(uuid) to authenticated, service_role;
grant execute on function public.can_access_day(uuid) to authenticated, service_role;
grant execute on function public.can_access_expense(uuid) to authenticated, service_role;
grant execute on function public.can_access_itinerary(uuid) to authenticated, service_role;

-- ------------------------------------------------ Chemin de recherche figé --
-- Sans search_path explicite, une fonction résout ses noms selon le chemin de
-- l'appelant, qui peut le manipuler. Les autres fonctions l'avaient déjà.
alter function public.touch_updated_at() set search_path = '';
alter function public.weights_are_valid(jsonb) set search_path = '';

-- ------------------------------------------------------- Tables techniques --
-- Elles n'ont volontairement aucune politique RLS, ce qui suffit à les rendre
-- inaccessibles. On retire en plus les droits de table : deux verrous valent
-- mieux qu'un sur des données qui ne regardent que les Edge Functions.
revoke all on table public.api_cache   from anon, authenticated;
revoke all on table public.api_quota   from anon, authenticated;
revoke all on table public.user_quota  from anon, authenticated;
revoke all on table public.ai_cache    from anon, authenticated;
revoke all on table public.fx_rates    from anon, authenticated;
