import { preflight, json } from '../_shared/cors.ts';
import { serviceClient } from '../_shared/supabase.ts';
import { avecCacheEtQuota, QuotaEpuise } from '../_shared/budget.ts';

/**
 * La prévision météo d'une destination, sur seize jours.
 *
 * Source : Open-Meteo, gratuit, sans clé, sans compte. Les normales
 * climatiques du catalogue répondent à « quel mois partir » ; ceci répond à
 * « qu'est-ce qu'on fait mercredi », et n'a de sens qu'à l'approche du départ.
 *
 * Les coordonnées sont arrondies au centième de degré — environ un kilomètre —
 * avant de servir de clé de cache : cinq personnes qui ouvrent le même voyage
 * déclenchent un seul appel, et la prévision ne change pas d'un pâté de
 * maisons à l'autre.
 *
 * La fonction ne renvoie que ce qu'Open-Meteo a dit. Elle ne complète pas, ne
 * lisse pas, n'extrapole pas : une prévision inventée ferait rater un train.
 */

/** Les modèles tournent quelques fois par jour ; six heures suffisent largement. */
const TTL_SECONDES = 6 * 60 * 60;
const LIMITES = { soft: 4_000, hard: 8_000 };
const SOURCE = 'https://api.open-meteo.com/v1/forecast';

Deno.serve(async (request) => {
  const options = preflight(request);
  if (options) return options;

  let demande: { lat?: unknown; lng?: unknown };
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
  const client = serviceClient();

  try {
    const { valeur, origine } = await avecCacheEtQuota<unknown>({
      client,
      cle: `weather:${arrondi(lat)},${arrondi(lng)}`,
      provider: 'open-meteo',
      ttlSecondes: TTL_SECONDES,
      limites: LIMITES,
      appel: () => recuperer(arrondi(lat), arrondi(lng)),
    });
    return json({ forecast: valeur, stale: origine === 'cache-perime' });
  } catch (cause) {
    if (cause instanceof QuotaEpuise) return json({ unavailable: true, reason: 'quota' });
    console.error('weather', cause);
    return json({ unavailable: true, reason: 'source' });
  }
});

async function recuperer(lat: number, lng: number): Promise<unknown> {
  const url = new URL(SOURCE);
  url.searchParams.set('latitude', String(lat));
  url.searchParams.set('longitude', String(lng));
  url.searchParams.set(
    'daily',
    'weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max',
  );
  // Les jours doivent être ceux de la destination, pas ceux du serveur : à
  // Tokyo, « mercredi » n'est pas le mercredi de Francfort.
  url.searchParams.set('timezone', 'auto');
  url.searchParams.set('forecast_days', '16');

  const reponse = await fetch(url, {
    headers: { accept: 'application/json' },
    signal: AbortSignal.timeout(10_000),
  });
  if (!reponse.ok) throw new Error(`Open-Meteo ${reponse.status}`);

  const brut = (await reponse.json()) as { daily?: { time?: unknown } };
  if (!brut.daily || !Array.isArray(brut.daily.time)) {
    throw new Error('Réponse Open-Meteo inattendue');
  }
  // On met en cache la réponse telle quelle : c'est `@tripora/core` qui la
  // lit, et il est testé sur la vraie forme — y compris le dernier jour vide.
  return { daily: brut.daily };
}
