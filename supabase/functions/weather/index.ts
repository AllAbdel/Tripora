import { preflight, json } from '../_shared/cors.ts';
import { serviceClient } from '../_shared/supabase.ts';
import { avecCacheEtQuota, QuotaEpuise } from '../_shared/budget.ts';
import { journeesDepuisMet } from './met.ts';

/**
 * La prévision météo d'une destination, sur une dizaine de jours.
 *
 * Source : MET Norway (l'institut météorologique norvégien), gratuit, sans
 * clé, sous licence CC BY 4.0 qui permet l'usage commercial — l'offre gratuite
 * d'Open-Meteo, utilisée jusqu'ici, l'interdit, et Tripora vit de liens
 * partenaires. MET exige un `User-Agent` qui identifie l'application. Les normales
 * climatiques du catalogue répondent à « quel mois partir » ; ceci répond à
 * « qu'est-ce qu'on fait mercredi », et n'a de sens qu'à l'approche du départ.
 *
 * Les coordonnées sont arrondies au centième de degré — environ un kilomètre —
 * avant de servir de clé de cache : cinq personnes qui ouvrent le même voyage
 * déclenchent un seul appel, et la prévision ne change pas d'un pâté de
 * maisons à l'autre.
 *
 * La fonction ne renvoie que ce que MET a dit, regroupé en journées locales
 * (`met.ts`). Elle ne complète pas, ne lisse pas, n'extrapole pas : une
 * prévision inventée ferait rater un train.
 */

/** Les modèles tournent quelques fois par jour ; six heures suffisent largement. */
const TTL_SECONDES = 6 * 60 * 60;
const LIMITES = { soft: 4_000, hard: 8_000 };
const SOURCE = 'https://api.met.no/weatherapi/locationforecast/2.0/compact';
/** Ce que MET demande : le nom de l'application et de quoi la joindre. */
const AGENT = 'Tripora/1.0 (+https://github.com/AllAbdel/Tripora)';

Deno.serve(async (request) => {
  const options = preflight(request);
  if (options) return options;

  let demande: { lat?: unknown; lng?: unknown; fuseau?: unknown };
  try {
    demande = await request.json();
  } catch {
    return json({ error: 'Corps de requête illisible' }, 400);
  }

  const lat = Number(demande.lat);
  const lng = Number(demande.lng);
  if (!Number.isFinite(lat) || Math.abs(lat) > 90) return json({ error: 'Latitude invalide' }, 400);
  if (!Number.isFinite(lng) || Math.abs(lng) > 180) return json({ error: 'Longitude invalide' }, 400);

  const arrondi = (valeur: number) => Math.round(valeur * 100) / 100;
  // Le fuseau de la destination, pour couper les journées au bon endroit.
  const fuseau =
    typeof demande.fuseau === 'string' && /^[A-Za-z_]+(\/[A-Za-z0-9_+-]+){0,2}$/u.test(demande.fuseau)
      ? demande.fuseau
      : 'UTC';
  const client = serviceClient();

  try {
    const { valeur, origine } = await avecCacheEtQuota<unknown>({
      client,
      cle: `meteo-met:${arrondi(lat)},${arrondi(lng)}:${fuseau}`,
      provider: 'met-norway',
      ttlSecondes: TTL_SECONDES,
      limites: LIMITES,
      appel: () => recuperer(arrondi(lat), arrondi(lng), fuseau),
    });
    return json({ forecast: valeur, stale: origine === 'cache-perime' });
  } catch (cause) {
    if (cause instanceof QuotaEpuise) return json({ unavailable: true, reason: 'quota' });
    console.error('weather', cause);
    return json({ unavailable: true, reason: 'source' });
  }
});

async function recuperer(lat: number, lng: number, fuseau: string): Promise<unknown> {
  const url = new URL(SOURCE);
  // MET demande au plus quatre décimales ; on en garde deux, comme la clé de cache.
  url.searchParams.set('lat', String(lat));
  url.searchParams.set('lon', String(lng));

  const reponse = await fetch(url, {
    headers: { accept: 'application/json', 'user-agent': AGENT },
    signal: AbortSignal.timeout(10_000),
  });
  if (!reponse.ok) throw new Error(`MET Norway ${reponse.status}`);

  const journees = journeesDepuisMet(await reponse.json(), fuseau);
  if (journees.daily.time.length === 0) throw new Error('Réponse MET Norway inattendue');
  // La forme d'Open-Meteo, que `@tripora/core` lit et teste.
  return journees;
}
