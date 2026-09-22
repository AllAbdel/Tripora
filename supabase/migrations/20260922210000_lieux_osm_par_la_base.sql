-- ============================================================================
-- Les lieux OpenStreetMap, récoltés par la base elle-même.
--
-- La fonction serveur `places` n'a presque jamais marché : Overpass refuse les
-- adresses de sortie des Edge Functions (HTTP 406 sur overpass-api.de, délais
-- dépassés sur les miroirs). La base, elle, sort par une autre adresse, et la
-- même requête y passe — mesuré : 54 lieux pour Ubud, en quelques secondes.
--
-- pg_net est asynchrone : la requête part après le commit, la réponse arrive
-- dans `net._http_response` quelques secondes plus tard. D'où un
-- fonctionnement en deux temps, que l'application pilote en rappelant :
--
--   1er appel     rien en cache → on dépose la demande, on répond « en attente » ;
--   appels suivants la réponse est là → on la lit en SQL, on la range trente
--                 jours dans `api_cache`, et on la rend.
--
-- Trois règles de sécurité, qui justifient chacune une ligne plus bas :
--
--   - **les coordonnées viennent de `destinations`, jamais de l'appelant.**
--     Sinon n'importe quel compte ferait interroger Overpass par notre
--     serveur sur l'endroit de son choix, avec notre quota et notre réputation ;
--   - **un seul appel sortant par destination à la fois**, quel que soit le
--     nombre de membres qui ouvrent la carte en même temps ;
--   - **un plafond par personne**, en plus du plafond global : sans lui, un
--     seul compte pourrait épuiser en une minute le quota du jour de tous.
--
-- Ce qui sort d'OpenStreetMap est écrit par n'importe qui : on n'en garde que
-- les étiquettes que l'application sait lire, tronquées, et des coordonnées
-- vérifiées. L'application relit tout de même chaque lieu (`lireLieux`).
-- ============================================================================

create table public.osm_demandes (
  requete_id     bigint primary key,
  destination_id text not null references public.destinations(id) on delete cascade,
  -- Pas de clé étrangère : la ligne ne vit que sept jours, et elle ne doit
  -- pas empêcher de supprimer un compte.
  demande_par    uuid,
  demande_le     timestamptz not null default now(),
  -- Vide tant que la réponse n'est pas lue ; ensuite, comment ça a fini.
  issue          text check (issue in ('recoltee', 'echec', 'perdue'))
);
create index osm_demandes_destination_idx on public.osm_demandes(destination_id, demande_le desc);
create index osm_demandes_par_idx on public.osm_demandes(demande_par, demande_le);
create index osm_demandes_age_idx on public.osm_demandes(demande_le);

-- Table technique : aucune politique, donc aucun accès client.
alter table public.osm_demandes enable row level security;
revoke all on public.osm_demandes from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- La réponse d'Overpass, lue en SQL.
--
-- Même tri que l'ancienne fonction serveur : les lieux que Wikipédia ou
-- Wikidata connaissent passent devant avant qu'on tronque, parce qu'OSM rend
-- ses éléments dans un ordre arbitraire et que couper au fil de l'eau écartait
-- le monastère des Hiéronymites au profit d'un square anonyme.
--
-- Les arbres sont écartés : OSM étiquette les arbres remarquables
-- `tourism=attraction`, et un arbre n'est pas une visite.
-- ---------------------------------------------------------------------------
create or replace function public.lire_elements_osm(p_elements jsonb)
returns jsonb
language sql
immutable
set search_path = public
as $$
  with elements as (
    select e,
      case when jsonb_typeof(e->'lat') = 'number' then (e->>'lat')::float8
           when jsonb_typeof(e->'center'->'lat') = 'number' then (e->'center'->>'lat')::float8
      end as lat,
      case when jsonb_typeof(e->'lon') = 'number' then (e->>'lon')::float8
           when jsonb_typeof(e->'center'->'lon') = 'number' then (e->'center'->>'lon')::float8
      end as lng
    from jsonb_array_elements(
      case when jsonb_typeof(p_elements) = 'array' then p_elements else '[]'::jsonb end
    ) as e
    where jsonb_typeof(e) = 'object'
  ),
  retenus as (
    select e, lat, lng, (e->'tags' ? 'wikipedia' or e->'tags' ? 'wikidata') as connu
    from elements
    where jsonb_typeof(e->'tags') = 'object'
      and jsonb_typeof(e->'tags'->'name') = 'string'
      and btrim(e->'tags'->>'name') <> ''
      and coalesce(e->'tags'->>'natural', '') not in ('tree', 'shrub')
      and e->>'type' in ('node', 'way', 'relation')
      and coalesce(e->>'id', '') ~ '^[0-9]{1,15}$'
      and lat between -90 and 90
      and lng between -180 and 180
    order by connu desc, (e->>'id')::bigint
    -- Au-delà, la liste devient un annuaire et plus une sélection.
    limit 120
  )
  select coalesce(
    jsonb_agg(
      jsonb_strip_nulls(jsonb_build_object(
        'id', 'osm:' || (e->>'type') || '/' || (e->>'id'),
        'name', left(btrim(e->'tags'->>'name'), 120),
        'lat', lat,
        'lng', lng,
        -- Seulement ce que `classifyPoi` et la fiche savent lire.
        'tags', (
          select coalesce(jsonb_object_agg(k, left(v, 200)), '{}'::jsonb)
          from jsonb_each_text(e->'tags') as t(k, v)
          where k in ('name', 'tourism', 'historic', 'amenity', 'leisure',
                      'natural', 'shop', 'wikipedia', 'wikidata')
        ),
        'externalUrl', case when e->'tags'->>'website' like 'https://%'
                            then left(e->'tags'->>'website', 300) end
      ))
      order by connu desc, (e->>'id')::bigint
    ),
    '[]'::jsonb
  )
  from retenus;
$$;

revoke all on function public.lire_elements_osm(jsonb) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Ce que le cache contient, sous la forme que l'application attend.
--
-- L'ancienne fonction serveur rangeait le tableau nu ; celle-ci range un
-- objet. Lisbonne — la seule ville que l'ancienne ait jamais réussie, avec
-- ses fiches Wikipédia — est encore dans le cache sous l'ancienne forme, et
-- `tableau || objet` en SQL ajoute l'objet au bout du tableau au lieu de
-- fusionner. D'où cette lecture des deux formes.
-- ---------------------------------------------------------------------------
create or replace function public.lieux_en_cache(p_payload jsonb, p_origine text)
returns jsonb
language sql
immutable
set search_path = public
as $$
  select case jsonb_typeof(p_payload)
    when 'array'  then jsonb_build_object('places', p_payload)
    when 'object' then p_payload
    else jsonb_build_object('places', '[]'::jsonb)
  end || jsonb_build_object('origine', p_origine);
$$;

revoke all on function public.lieux_en_cache(jsonb, text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Le point d'entrée de l'application.
--
-- Réponses possibles, toujours un objet :
--   { places: [...], origine: 'cache' | 'frais' | 'perime' }
--   { places: [], enAttente: true }       rappeler dans quelques secondes
--   { places: [], quotaExceeded: true }   limite gratuite du jour atteinte
--   { places: [], failed: true, raison }  Overpass n'a pas répondu, ou trop tôt
--   { places: [], inconnue: true }        destination absente du catalogue
--
-- Quand une copie périmée existe, elle est rendue à la place de l'attente ou
-- de l'échec : une liste d'un mois vaut mieux qu'une liste vide.
-- ---------------------------------------------------------------------------
create or replace function public.lieux_osm(p_destination_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_moi       uuid := (select auth.uid());
  v_cle       text := 'lieux:' || p_destination_id;
  v_lat       double precision;
  v_lng       double precision;
  v_cache     public.api_cache%rowtype;
  v_perime    jsonb;
  v_demande   public.osm_demandes%rowtype;
  v_reponse   record;
  v_json      jsonb;
  v_lieux     jsonb;
  v_quota     record;
  v_autour    text;
  v_requete   text;
  v_id        bigint;
begin
  if v_moi is null then
    raise exception 'Connexion requise' using errcode = '42501';
  end if;

  select d.lat, d.lng into v_lat, v_lng from public.destinations d where d.id = p_destination_id;
  if not found then
    return jsonb_build_object('places', '[]'::jsonb, 'inconnue', true);
  end if;

  select * into v_cache from public.api_cache where key = v_cle;
  if found and v_cache.expires_at > now() then
    return public.lieux_en_cache(v_cache.payload, 'cache');
  end if;

  -- Un seul appelant à la fois par destination. Le verrou tombe au commit.
  perform pg_advisory_xact_lock(hashtext(v_cle));

  -- Celui qui tenait le verrou vient peut-être de tout récolter.
  select * into v_cache from public.api_cache where key = v_cle;
  if found and v_cache.expires_at > now() then
    return public.lieux_en_cache(v_cache.payload, 'cache');
  end if;
  if v_cache.key is not null then
    v_perime := public.lieux_en_cache(v_cache.payload, 'perime');
  end if;

  select * into v_demande from public.osm_demandes
   where destination_id = p_destination_id
   order by demande_le desc
   limit 1;

  -- ------------------------------------------------ Une demande en cours --
  if v_demande.requete_id is not null and v_demande.issue is null then
    select r.status_code, r.content, r.timed_out into v_reponse
      from net._http_response r
     where r.id = v_demande.requete_id;

    if not found then
      if v_demande.demande_le > now() - interval '2 minutes' then
        return coalesce(v_perime, jsonb_build_object('places', '[]'::jsonb, 'enAttente', true));
      end if;
      -- Le serveur de requêtes a redémarré, ou la réponse a été purgée.
      update public.osm_demandes set issue = 'perdue' where requete_id = v_demande.requete_id;
      return coalesce(v_perime, jsonb_build_object('places', '[]'::jsonb, 'failed', true, 'raison', 'perdue'));
    end if;

    if v_reponse.status_code = 200 and not coalesce(v_reponse.timed_out, false) then
      begin
        v_json := v_reponse.content::jsonb;
      exception when others then
        -- Overpass répond parfois 200 avec une page HTML d'erreur.
        v_json := null;
      end;
    end if;

    if v_json is null or jsonb_typeof(v_json->'elements') is distinct from 'array' then
      update public.osm_demandes set issue = 'echec' where requete_id = v_demande.requete_id;
      return coalesce(v_perime, jsonb_build_object(
        'places', '[]'::jsonb, 'failed', true,
        'raison', 'overpass ' || coalesce(v_reponse.status_code::text, 'sans réponse')));
    end if;

    v_lieux := public.lire_elements_osm(v_json->'elements');

    insert into public.api_cache (key, provider, payload, fetched_at, expires_at)
    values (v_cle, 'overpass', jsonb_build_object('places', v_lieux), now(), now() + interval '30 days')
    on conflict (key) do update
      set payload = excluded.payload, fetched_at = excluded.fetched_at, expires_at = excluded.expires_at;

    -- Copie durable : le cache expire dans un mois, un item d'itinéraire doit
    -- pouvoir pointer sur son lieu bien plus longtemps.
    insert into public.places (id, destination_id, name, category, lat, lng, external_url, source, fetched_at)
    select l->>'id', p_destination_id, l->>'name',
           coalesce(l->'tags'->>'tourism', l->'tags'->>'historic', l->'tags'->>'leisure',
                    l->'tags'->>'natural', l->'tags'->>'amenity', l->'tags'->>'shop', 'autre'),
           (l->>'lat')::float8, (l->>'lng')::float8, l->>'externalUrl', 'openstreetmap', now()
      from jsonb_array_elements(v_lieux) as l
    on conflict (id) do update
      set name = excluded.name, category = excluded.category, lat = excluded.lat, lng = excluded.lng,
          external_url = excluded.external_url, fetched_at = excluded.fetched_at;

    update public.osm_demandes set issue = 'recoltee' where requete_id = v_demande.requete_id;
    return jsonb_build_object('places', v_lieux, 'origine', 'frais');
  end if;

  -- --------------------------------------- Un échec récent : on patiente --
  if v_demande.requete_id is not null
     and v_demande.issue in ('echec', 'perdue')
     and v_demande.demande_le > now() - interval '15 minutes' then
    return coalesce(v_perime, jsonb_build_object('places', '[]'::jsonb, 'failed', true, 'raison', 'recent'));
  end if;

  -- ------------------------------------------------- Une nouvelle demande --
  if (select count(*) from public.osm_demandes
       where demande_par = v_moi and demande_le > now() - interval '1 day') >= 30 then
    return coalesce(v_perime, jsonb_build_object('places', '[]'::jsonb, 'failed', true, 'raison', 'limite-personnelle'));
  end if;

  -- Overpass est un service communautaire : on reste très en dessous.
  select * into v_quota from public.bump_api_quota('overpass', 120, 200);
  if v_quota.used > v_quota.hard or (v_perime is not null and v_quota.used > v_quota.soft) then
    return coalesce(v_perime, jsonb_build_object('places', '[]'::jsonb, 'quotaExceeded', true));
  end if;

  -- Restaurants et bars volontairement absents : OSM en connaît des milliers
  -- par ville, sans note ni prix fiables. Le classement se fait côté
  -- application, dans `packages/core/src/places.ts`, où il est testé.
  v_autour := format('(around:4000,%s,%s)', v_lat, v_lng);
  v_requete := '[out:json][timeout:25];(' ||
    'nwr["tourism"~"^(museum|gallery|artwork|viewpoint|attraction|zoo|aquarium|theme_park)$"]["name"]' || v_autour || ';' ||
    'nwr["historic"~"^(castle|monument|ruins|city_gate|fort|archaeological_site|church|tower|memorial)$"]["name"]' || v_autour || ';' ||
    'nwr["amenity"~"^(theatre|arts_centre|marketplace)$"]["name"]' || v_autour || ';' ||
    'nwr["leisure"~"^(park|garden|spa|beach_resort|water_park)$"]["name"]' || v_autour || ';' ||
    'nwr["natural"~"^(beach|peak|cliff|cave_entrance)$"]["name"]' || v_autour || ';' ||
    'nwr["shop"~"^(mall|department_store)$"]["name"]' || v_autour || ';' ||
    ');out center 360;';

  v_id := net.http_get(
    url := 'https://overpass-api.de/api/interpreter',
    params := jsonb_build_object('data', v_requete),
    -- Overpass demande qu'on s'identifie : c'est la contrepartie de la
    -- gratuité, et ça permet de nous joindre plutôt que de nous bloquer.
    headers := jsonb_build_object('User-Agent', 'Tripora/1.0 (application de voyage entre amis, non commerciale)'),
    timeout_milliseconds := 30000
  );

  insert into public.osm_demandes (requete_id, destination_id, demande_par)
  values (v_id, p_destination_id, v_moi);

  -- Ménage au passage : l'historique ne sert qu'aux plafonds, sur un jour.
  delete from public.osm_demandes where demande_le < now() - interval '7 days';

  return coalesce(v_perime, jsonb_build_object('places', '[]'::jsonb, 'enAttente', true));
end;
$$;

revoke all on function public.lieux_osm(text) from public, anon;
grant execute on function public.lieux_osm(text) to authenticated;
