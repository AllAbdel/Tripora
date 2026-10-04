-- ============================================================================
-- Tests de la récolte des lieux OpenStreetMap par la base (`lieux_osm`).
--
-- Le Postgres de test n'a pas pg_net : on le double ici, au plus juste. Une
-- file où `http_get` note ce qu'on lui demande, et une table de réponses que
-- le test remplit lui-même à la place du serveur de requêtes. Rien ne sort
-- sur le réseau.
-- ============================================================================

\set ON_ERROR_STOP on
\timing off

create schema if not exists net;
create table if not exists net._http_response (
  id           bigint primary key,
  status_code  integer,
  content_type text,
  headers      jsonb,
  content      text,
  timed_out    boolean,
  error_msg    text,
  created      timestamptz not null default now()
);
create sequence if not exists net.doublure_seq;
create table if not exists net.doublure_demandes (
  id      bigint primary key,
  url     text not null,
  params  jsonb not null,
  headers jsonb not null
);
create or replace function net.http_get(
  url text, params jsonb default '{}', headers jsonb default '{}', timeout_milliseconds int default 5000
) returns bigint language plpgsql as $$
declare v_id bigint := nextval('net.doublure_seq');
begin
  insert into net.doublure_demandes values (v_id, url, params, headers);
  return v_id;
end $$;

-- Une réponse d'Overpass réaliste, avec ce qu'il faut écarter.
create temporary table reponse_overpass as select $json${
  "elements": [
    {"type":"node","id":11,"lat":-8.5069,"lon":115.2625,
     "tags":{"name":"Musée Puri Lukisan","tourism":"museum","phone":"+62 361","website":"http://pas-sur.example"}},
    {"type":"way","id":22,"center":{"lat":-8.5188,"lon":115.2585},
     "tags":{"name":"Monkey Forest","tourism":"attraction","wikipedia":"en:Sacred Monkey Forest Sanctuary","website":"https://monkeyforestubud.com"}},
    {"type":"node","id":33,"lat":-8.51,"lon":115.26,"tags":{"name":"Banian sacré","tourism":"attraction","natural":"tree"}},
    {"type":"node","id":44,"lat":-8.51,"lon":115.26,"tags":{"tourism":"viewpoint"}},
    {"type":"node","id":55,"lat":"-8.51","lon":115.26,"tags":{"name":"Latitude en texte","tourism":"museum"}},
    {"type":"node","id":66,"lat":123,"lon":115.26,"tags":{"name":"Hors du globe","tourism":"museum"}},
    {"type":"evil","id":77,"lat":-8.51,"lon":115.26,"tags":{"name":"Type inconnu","tourism":"museum"}},
    {"type":"node","id":88,"lat":-8.52,"lon":115.27,"tags":{"name":"  Pura Taman Saraswati  ","historic":"memorial"}},
    "pas un objet"
  ]
}$json$::text as contenu;
grant select on reponse_overpass to authenticated;

-- ---------------------------------------------------------------------------
-- 1. Sans compte, rien. Et le client ne touche ni la file ni le lecteur.
-- ---------------------------------------------------------------------------
set role anon;
do $$
begin
  begin
    perform public.lieux_osm('bali');
    raise exception 'FAILLE : lieux_osm appelable sans compte';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

set role authenticated;
set request.jwt.claims = '{"sub":"eeee0001-0000-0000-0000-000000000001","role":"authenticated"}';
do $$
begin
  begin
    perform count(*) from public.osm_demandes;
    raise exception 'FAILLE : la file des demandes est lisible par un client';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.lire_elements_osm('[]');
    raise exception 'FAILLE : le lecteur interne est exposé';
  exception when insufficient_privilege then null;
  end;
end $$;

-- ---------------------------------------------------------------------------
-- 2. Une destination hors catalogue ne déclenche rien.
-- ---------------------------------------------------------------------------
do $$
declare r jsonb;
begin
  r := public.lieux_osm('atlantide');
  assert (r->>'inconnue')::boolean, format('Destination inconnue mal signalée : %s', r);
end $$;
reset role; reset request.jwt.claims;
do $$ begin
  assert (select count(*) from net.doublure_demandes) = 0, 'Aucune requête ne doit partir pour une destination inconnue';
end $$;

-- ---------------------------------------------------------------------------
-- 3. Premier appel : la demande part, avec les coordonnées du catalogue.
--    Deuxième appel avant la réponse : on attend, sans rien renvoyer.
-- ---------------------------------------------------------------------------
set role authenticated;
set request.jwt.claims = '{"sub":"eeee0001-0000-0000-0000-000000000001","role":"authenticated"}';
do $$
declare r jsonb;
begin
  r := public.lieux_osm('bali');
  assert (r->>'enAttente')::boolean, format('Le premier appel devrait être en attente : %s', r);
  r := public.lieux_osm('bali');
  assert (r->>'enAttente')::boolean, format('Toujours en attente sans réponse : %s', r);
end $$;
reset role; reset request.jwt.claims;
do $$
declare d net.doublure_demandes%rowtype;
begin
  assert (select count(*) from net.doublure_demandes) = 1,
    format('Une seule requête attendue, %s envoyées', (select count(*) from net.doublure_demandes));
  select * into d from net.doublure_demandes;
  assert d.url = 'https://overpass-api.de/api/interpreter', 'Mauvaise adresse Overpass';
  assert d.params->>'data' like '%(around:4000,-8.4095,115.1889)%',
    format('Les coordonnées doivent venir du catalogue : %s', d.params->>'data');
  assert d.headers->>'User-Agent' like 'Tripora/%', 'Tripora doit s''identifier auprès d''Overpass';
  assert (select count from public.api_quota where provider = 'overpass' and day = current_date) = 1,
    'Le quota du jour doit compter la requête, et une seule';
end $$;

-- ---------------------------------------------------------------------------
-- 4. La réponse arrive : elle est lue, triée, nettoyée, gardée trente jours.
-- ---------------------------------------------------------------------------
insert into net._http_response (id, status_code, content, timed_out)
select id, 200, (select contenu from reponse_overpass), false from net.doublure_demandes;

set role authenticated;
set request.jwt.claims = '{"sub":"eeee0002-0000-0000-0000-000000000002","role":"authenticated"}';
do $$
declare r jsonb; lieux jsonb;
begin
  r := public.lieux_osm('bali');
  assert r->>'origine' = 'frais', format('La réponse devrait être fraîche : %s', r);
  lieux := r->'places';
  assert jsonb_array_length(lieux) = 3,
    format('Trois lieux attendus (musée, forêt, temple), reçu : %s', lieux);
  -- Le lieu que Wikipédia connaît passe devant.
  assert lieux->0->>'id' = 'osm:way/22', format('Le lieu documenté doit passer devant : %s', lieux->0);
  assert (lieux->0->>'lat')::float8 = -8.5188, 'Un chemin prend les coordonnées de son centre';
  assert lieux->0->>'externalUrl' = 'https://monkeyforestubud.com', 'Le site HTTPS est gardé';
  -- Le site en HTTP ne passe pas, les étiquettes inutiles non plus.
  assert not (lieux->1 ? 'externalUrl'), 'Un site en HTTP ne doit pas être proposé';
  assert not (lieux->1->'tags' ? 'phone'), 'Seules les étiquettes lues par l''application passent';
  assert lieux->2->>'name' = 'Pura Taman Saraswati', 'Le nom est débarrassé de ses espaces';
end $$;
reset role; reset request.jwt.claims;
do $$ begin
  assert (select expires_at > now() + interval '29 days' from public.api_cache where key = 'lieux:bali'),
    'Le résultat doit être gardé un mois';
  assert (select count(*) from public.places where destination_id = 'bali' and source = 'openstreetmap') = 3,
    'Les lieux doivent être copiés durablement dans places';
  assert (select issue from public.osm_demandes where destination_id = 'bali') = 'recoltee',
    'La demande doit être marquée récoltée';
end $$;

-- ---------------------------------------------------------------------------
-- 5. Ensuite, le cache répond, sans nouvelle requête.
-- ---------------------------------------------------------------------------
set role authenticated;
set request.jwt.claims = '{"sub":"eeee0003-0000-0000-0000-000000000003","role":"authenticated"}';
do $$
declare r jsonb;
begin
  r := public.lieux_osm('bali');
  assert r->>'origine' = 'cache', format('Le cache devrait répondre : %s', r);
  assert jsonb_array_length(r->'places') = 3, 'Le cache rend les mêmes lieux';
end $$;
reset role; reset request.jwt.claims;
do $$ begin
  assert (select count(*) from net.doublure_demandes) = 1, 'Le cache ne doit déclencher aucune requête';
end $$;

-- ---------------------------------------------------------------------------
-- 6. Cache périmé : on rend l'ancienne liste, et on en redemande une.
--    Si la nouvelle échoue, l'ancienne reste rendue, et on ne relance pas
--    tout de suite.
-- ---------------------------------------------------------------------------
update public.api_cache set expires_at = now() - interval '1 minute' where key = 'lieux:bali';

set role authenticated;
set request.jwt.claims = '{"sub":"eeee0003-0000-0000-0000-000000000003","role":"authenticated"}';
do $$
declare r jsonb;
begin
  r := public.lieux_osm('bali');
  assert r->>'origine' = 'perime', format('La copie périmée doit être rendue : %s', r);
  assert jsonb_array_length(r->'places') = 3, 'La copie périmée garde ses lieux';
end $$;
reset role; reset request.jwt.claims;
do $$ begin
  assert (select count(*) from net.doublure_demandes) = 2, 'Un cache périmé doit relancer une requête';
end $$;

-- Overpass est saturé : 429.
insert into net._http_response (id, status_code, content, timed_out)
values ((select max(id) from net.doublure_demandes), 429, 'Too Many Requests', false);

set role authenticated;
set request.jwt.claims = '{"sub":"eeee0003-0000-0000-0000-000000000003","role":"authenticated"}';
do $$
declare r jsonb;
begin
  r := public.lieux_osm('bali');
  assert r->>'origine' = 'perime', format('Après un échec, la copie périmée reste : %s', r);
  r := public.lieux_osm('bali');
  assert r->>'origine' = 'perime', 'Toujours la copie périmée';
end $$;
reset role; reset request.jwt.claims;
do $$ begin
  assert (select count(*) from net.doublure_demandes) = 2, 'Pas de nouvelle requête juste après un échec';
  assert (select issue from public.osm_demandes order by demande_le desc, requete_id desc limit 1) = 'echec',
    'L''échec doit être noté';
end $$;

-- ---------------------------------------------------------------------------
-- 7. Une réponse illisible, ou jamais arrivée : échec propre, sans exception.
-- ---------------------------------------------------------------------------
set role authenticated;
set request.jwt.claims = '{"sub":"eeee0004-0000-0000-0000-000000000004","role":"authenticated"}';
do $$
declare r jsonb;
begin
  r := public.lieux_osm('lisbonne');
  assert (r->>'enAttente')::boolean, format('Lisbonne : en attente attendu, %s', r);
end $$;
reset role; reset request.jwt.claims;

-- 200, mais une page HTML : cela arrive quand Overpass est surchargé.
insert into net._http_response (id, status_code, content, timed_out)
values ((select max(id) from net.doublure_demandes), 200, '<html><body>runtime error</body></html>', false);

set role authenticated;
set request.jwt.claims = '{"sub":"eeee0004-0000-0000-0000-000000000004","role":"authenticated"}';
do $$
declare r jsonb;
begin
  r := public.lieux_osm('lisbonne');
  assert (r->>'failed')::boolean, format('Une page HTML doit être un échec propre : %s', r);
  assert jsonb_array_length(r->'places') = 0, 'Aucun lieu inventé';
end $$;
reset role; reset request.jwt.claims;

-- Une demande restée sans réponse plus de deux minutes est perdue.
set role authenticated;
set request.jwt.claims = '{"sub":"eeee0004-0000-0000-0000-000000000004","role":"authenticated"}';
select public.lieux_osm('rome') is not null as demande_rome;
reset role; reset request.jwt.claims;
update public.osm_demandes set demande_le = now() - interval '3 minutes' where destination_id = 'rome';

set role authenticated;
set request.jwt.claims = '{"sub":"eeee0004-0000-0000-0000-000000000004","role":"authenticated"}';
do $$
declare r jsonb;
begin
  r := public.lieux_osm('rome');
  assert r->>'raison' = 'perdue', format('Une demande sans réponse doit finir perdue : %s', r);
end $$;
reset role; reset request.jwt.claims;

-- ---------------------------------------------------------------------------
-- 7 bis. L'ancienne forme du cache — un tableau nu — se lit toujours.
-- ---------------------------------------------------------------------------
insert into public.api_cache (key, provider, payload, expires_at)
values ('lieux:porto', 'overpass',
        '[{"id":"osm:node/1","name":"Tour des Clercs","lat":41.1457,"lng":-8.6146,"tags":{"historic":"tower"},"imageUrl":"https://upload.wikimedia.org/x.jpg"}]',
        now() + interval '1 day');

set role authenticated;
set request.jwt.claims = '{"sub":"eeee0004-0000-0000-0000-000000000004","role":"authenticated"}';
do $$
declare r jsonb;
begin
  r := public.lieux_osm('porto');
  assert jsonb_typeof(r) = 'object', format('La réponse doit rester un objet : %s', r);
  assert r->>'origine' = 'cache', format('L''ancienne forme vient du cache : %s', r);
  assert r->'places'->0->>'imageUrl' like 'https://upload.wikimedia.org/%', 'Les fiches de l''ancienne forme sont gardées';
end $$;
reset role; reset request.jwt.claims;

-- ---------------------------------------------------------------------------
-- 8. Les plafonds : par personne, puis pour tout le monde.
-- ---------------------------------------------------------------------------
insert into public.osm_demandes (requete_id, destination_id, demande_par, issue)
select 900000 + g, 'bali', 'eeee0005-0000-0000-0000-000000000005', 'recoltee'
  from generate_series(1, 30) as g;

set role authenticated;
set request.jwt.claims = '{"sub":"eeee0005-0000-0000-0000-000000000005","role":"authenticated"}';
do $$
declare r jsonb;
begin
  r := public.lieux_osm('tokyo');
  assert r->>'raison' = 'limite-personnelle', format('Le plafond personnel doit jouer : %s', r);
end $$;
reset role; reset request.jwt.claims;

update public.api_quota set count = 200 where provider = 'overpass' and day = current_date;

set role authenticated;
set request.jwt.claims = '{"sub":"eeee0006-0000-0000-0000-000000000006","role":"authenticated"}';
do $$
declare r jsonb;
begin
  r := public.lieux_osm('tokyo');
  assert (r->>'quotaExceeded')::boolean, format('Le plafond global doit jouer : %s', r);
end $$;
reset role; reset request.jwt.claims;
do $$ begin
  assert not exists (select 1 from net.doublure_demandes d
                      join public.osm_demandes o on o.requete_id = d.id
                     where o.destination_id = 'tokyo'),
    'Aucune requête ne doit partir au-delà des plafonds';
end $$;

\echo '   lieux_osm : tous les tests passent'
