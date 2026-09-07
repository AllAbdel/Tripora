import { preflight, json } from '../_shared/cors.ts';
import { serviceClient } from '../_shared/supabase.ts';
import { avecCacheEtQuota, QuotaEpuise } from '../_shared/budget.ts';

/**
 * Chercher n'importe quelle ville du monde, et la retenir.
 *
 * Le catalogue curé répond à « surprends-nous » : cinquante-cinq villes dont on
 * assume les notes, comparables entre elles, classables. Il ne répond pas à
 * « on part à Kyoto » — et il ne le devrait pas : identifier un lieu ne demande
 * aucun jugement, seulement des coordonnées justes.
 *
 * Cette fonction sépare les deux. Elle géocode librement, puis retient la ville
 * choisie dans `destinations` avec `discovered = true`. Les recommandations
 * suivent sans rien de plus : la fonction `places` ne demande qu'une latitude
 * et une longitude, elle n'a jamais eu besoin du catalogue.
 *
 * Ce qu'on n'invente pas : les notes éditoriales. Elles restent vides. Une
 * ville découverte ne peut donc pas entrer dans un classement — elle n'a rien
 * à y défendre, et une note fabriquée fausserait un vote de groupe.
 *
 * Photon d'abord (rapide, tolérant aux fautes de frappe), Nominatim en secours.
 * Les deux sont communautaires et gratuits : d'où le cache long — un nom de
 * ville ne bouge pas — et un plafond très en dessous de ce qu'ils tolèrent.
 */

const PROVIDER = 'photon';
/** Un nom de ville et ses coordonnées ne changent pas. */
const TTL_SECONDES = 180 * 24 * 60 * 60;
const LIMITES = { soft: 400, hard: 700 };
const AGENT = 'Tripora/1.0 (application de voyage entre amis, non commerciale)';
const MAX_RESULTATS = 8;

/** Ce qui est une destination possible. Une rue ou un commerce n'en est pas une. */
const LIEUX_HABITES = new Set([
  'city',
  'town',
  'village',
  'municipality',
  'borough',
  'suburb',
  'island',
  'archipelago',
  'region',
  'county',
  'state',
  'province',
  'country',
]);

interface VilleTrouvee {
  id: string;
  name: string;
  country: string;
  countryCode: string;
  lat: number;
  lng: number;
}

/**
 * Une ville retenue porte toujours ce préfixe. C'est ce qui garantit qu'aucune
 * requête ne peut écraser une entrée curée — `retain: { id: 'barcelone' }`
 * réécrirait sinon les notes de Barcelone dans le catalogue de tout le monde.
 */
const ID_DECOUVERTE = /^osm-[nwr][0-9]{1,34}$/;

Deno.serve(async (request) => {
  const options = preflight(request);
  if (options) return options;

  let corps: { q?: unknown; retain?: unknown };
  try {
    corps = await request.json();
  } catch {
    return json({ error: 'Corps de requête illisible' }, 400);
  }

  const client = serviceClient();

  // Retenir une ville écrit dans un catalogue partagé par tout le monde : on
  // exige une session, et on ne fait confiance à rien de ce qui arrive.
  if (corps.retain !== undefined) {
    if (!(await estConnecte(request, client))) {
      return json({ error: 'Connexion requise' }, 401);
    }
    const ville = validerVille(corps.retain);
    if (!ville) return json({ error: 'Ville invalide' }, 400);
    await retenir(client, ville);
    return json({ retained: ville });
  }

  const q = typeof corps.q === 'string' ? corps.q.trim() : '';
  // Deux lettres ne désignent rien et coûteraient un appel par frappe.
  if (q.length < 3) return json({ villes: [] });

  try {
    const { valeur, origine } = await avecCacheEtQuota<VilleTrouvee[]>({
      client,
      cle: `geocode:${q.toLocaleLowerCase('fr')}`,
      provider: PROVIDER,
      ttlSecondes: TTL_SECONDES,
      limites: LIMITES,
      appel: () => chercher(q),
    });
    return json({ villes: valeur, stale: origine === 'cache-perime' });
  } catch (cause) {
    if (cause instanceof QuotaEpuise) {
      return json({ villes: [], unavailable: true, reason: 'quota' });
    }
    console.error('geocode', cause);
    return json({ villes: [], unavailable: true, reason: 'source' });
  }
});

async function estConnecte(request: Request, client: ReturnType<typeof serviceClient>) {
  const entete = request.headers.get('authorization');
  if (!entete?.startsWith('Bearer ')) return false;
  const { data } = await client.auth.getUser(entete.slice(7));
  return Boolean(data.user?.id);
}

async function chercher(q: string): Promise<VilleTrouvee[]> {
  const viaPhoton = await photon(q).catch(() => null);
  if (viaPhoton && viaPhoton.length > 0) return viaPhoton;
  return await nominatim(q).catch(() => []);
}

async function photon(q: string): Promise<VilleTrouvee[]> {
  const url = new URL('https://photon.komoot.io/api');
  url.searchParams.set('q', q);
  url.searchParams.set('lang', 'fr');
  url.searchParams.set('limit', String(MAX_RESULTATS * 3));

  const reponse = await fetch(url, {
    headers: { accept: 'application/json', 'user-agent': AGENT },
    signal: AbortSignal.timeout(8000),
  });
  if (!reponse.ok) throw new Error(`Photon ${reponse.status}`);

  const brut = (await reponse.json()) as {
    features?: {
      geometry?: { coordinates?: unknown };
      properties?: Record<string, unknown>;
    }[];
  };

  const villes: VilleTrouvee[] = [];
  for (const trait of brut.features ?? []) {
    const p = trait.properties ?? {};
    if (p['osm_key'] !== 'place' || !LIEUX_HABITES.has(String(p['osm_value']))) continue;

    const coords = trait.geometry?.coordinates;
    if (!Array.isArray(coords) || coords.length < 2) continue;
    const [lng, lat] = coords as number[];

    const ville = construire({
      osmType: String(p['osm_type'] ?? ''),
      osmId: p['osm_id'],
      name: p['name'],
      country: p['country'],
      countryCode: p['countrycode'],
      lat,
      lng,
    });
    if (ville) villes.push(ville);
  }
  return dedupliquer(villes);
}

async function nominatim(q: string): Promise<VilleTrouvee[]> {
  const url = new URL('https://nominatim.openstreetmap.org/search');
  url.searchParams.set('q', q);
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('addressdetails', '1');
  url.searchParams.set('accept-language', 'fr');
  url.searchParams.set('limit', String(MAX_RESULTATS * 2));

  const reponse = await fetch(url, {
    headers: { accept: 'application/json', 'user-agent': AGENT },
    signal: AbortSignal.timeout(8000),
  });
  if (!reponse.ok) throw new Error(`Nominatim ${reponse.status}`);

  const brut = (await reponse.json()) as Record<string, unknown>[];
  const villes: VilleTrouvee[] = [];
  for (const item of brut) {
    if (item['category'] !== 'place' || !LIEUX_HABITES.has(String(item['type']))) continue;
    const adresse = (item['address'] ?? {}) as Record<string, unknown>;
    const ville = construire({
      osmType: String(item['osm_type'] ?? ''),
      osmId: item['osm_id'],
      name: item['name'],
      country: adresse['country'],
      countryCode: adresse['country_code'],
      lat: Number(item['lat']),
      lng: Number(item['lon']),
    });
    if (ville) villes.push(ville);
  }
  return dedupliquer(villes);
}

function construire(brut: {
  osmType: string;
  osmId: unknown;
  name: unknown;
  country: unknown;
  countryCode: unknown;
  lat: number;
  lng: number;
}): VilleTrouvee | null {
  const nom = typeof brut.name === 'string' ? brut.name.trim() : '';
  const id = identifiant(brut.osmType, brut.osmId);
  if (!nom || !id) return null;
  if (!Number.isFinite(brut.lat) || !Number.isFinite(brut.lng)) return null;
  if (Math.abs(brut.lat) > 90 || Math.abs(brut.lng) > 180) return null;

  const code = typeof brut.countryCode === 'string' ? brut.countryCode.toUpperCase() : '';
  return {
    id,
    name: nom.slice(0, 80),
    country: typeof brut.country === 'string' ? brut.country.slice(0, 80) : '',
    // La colonne est un char(2) : un code douteux vaut mieux vide que tronqué
    // au hasard, et l'écriture le refusera franchement plutôt qu'en silence.
    countryCode: /^[A-Z]{2}$/.test(code) ? code : '',
    lat: brut.lat,
    lng: brut.lng,
  };
}

/** `osm-n1234` : stable, et conforme à ce qu'attend la fonction `places`. */
function identifiant(osmType: string, osmId: unknown): string | null {
  const numero = Number(osmId);
  if (!Number.isInteger(numero) || numero <= 0) return null;
  const lettre = osmType.trim().toLowerCase().charAt(0);
  const id = `osm-${lettre}${numero}`;
  return ID_DECOUVERTE.test(id) ? id : null;
}

/** Les deux fournisseurs renvoient parfois la même ville sous deux objets OSM. */
function dedupliquer(villes: VilleTrouvee[]): VilleTrouvee[] {
  const vues = new Set<string>();
  const gardees: VilleTrouvee[] = [];
  for (const ville of villes) {
    const cle = `${ville.name.toLocaleLowerCase('fr')}|${ville.countryCode}`;
    if (vues.has(cle)) continue;
    vues.add(cle);
    gardees.push(ville);
    if (gardees.length >= MAX_RESULTATS) break;
  }
  return gardees;
}

function validerVille(brut: unknown): VilleTrouvee | null {
  if (typeof brut !== 'object' || brut === null) return null;
  const v = brut as Record<string, unknown>;
  if (typeof v['id'] !== 'string' || !ID_DECOUVERTE.test(v['id'])) return null;
  if (typeof v['name'] !== 'string' || v['name'].trim() === '') return null;
  const lat = Number(v['lat']);
  const lng = Number(v['lng']);
  if (!Number.isFinite(lat) || Math.abs(lat) > 90) return null;
  if (!Number.isFinite(lng) || Math.abs(lng) > 180) return null;
  const code = String(v['countryCode'] ?? '').toUpperCase();
  return {
    id: v['id'],
    name: v['name'].trim().slice(0, 80),
    country: String(v['country'] ?? '').slice(0, 80),
    countryCode: /^[A-Z]{2}$/.test(code) ? code : '',
    lat,
    lng,
  };
}

/**
 * `discovered` est forcé ici, jamais lu de la requête : aucun client ne peut
 * faire passer une ville inventée pour une entrée du catalogue curé.
 */
async function retenir(client: ReturnType<typeof serviceClient>, ville: VilleTrouvee) {
  const { error } = await client.from('destinations').upsert(
    {
      id: ville.id,
      name: ville.name,
      country: ville.country || 'Inconnu',
      country_code: ville.countryCode || 'ZZ',
      lat: ville.lat,
      lng: ville.lng,
      iata: [],
      tags: {},
      cost_index: 1,
      poi_richness: 0.5,
      best_months: [],
      discovered: true,
    },
    { onConflict: 'id', ignoreDuplicates: false },
  );
  if (error) throw error;
}
