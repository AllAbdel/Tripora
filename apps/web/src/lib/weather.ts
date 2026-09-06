import { parseForecast, type DailyWeather } from '@tripora/core';
import { supabase } from './supabase';

/**
 * La prévision météo d'une destination.
 *
 * Un appel par destination et par jour, partagé par tout le groupe grâce au
 * cache serveur, et gardé côté navigateur par le cache persistant : la
 * prévision de la veille reste lisible dans un train sans réseau, ce qui est
 * précisément le moment où on la consulte.
 *
 * Sans Supabase — ou sans réseau au premier chargement — il n'y a pas de
 * prévision, et l'écran s'en tient aux normales climatiques, qui sont
 * embarquées dans le code et fonctionnent toujours.
 */

export type EtatMeteo =
  | { statut: 'ok'; jours: DailyWeather[]; perime: boolean }
  | { statut: 'indisponible' };

export async function chargerMeteo(lat: number, lng: number): Promise<EtatMeteo> {
  if (!supabase) return { statut: 'indisponible' };
  try {
    const { data, error } = await supabase.functions.invoke('weather', {
      body: { lat, lng },
    });
    if (error || !data) return { statut: 'indisponible' };

    const reponse = data as { forecast?: unknown; stale?: unknown; unavailable?: unknown };
    if (reponse.unavailable) return { statut: 'indisponible' };

    const jours = parseForecast(reponse.forecast);
    if (jours.length === 0) return { statut: 'indisponible' };
    return { statut: 'ok', jours, perime: reponse.stale === true };
  } catch {
    return { statut: 'indisponible' };
  }
}

/** Une clé par point, arrondie comme côté serveur pour partager le même cache. */
export function cleMeteo(lat: number, lng: number): [string, number, number] {
  return ['meteo', Math.round(lat * 100) / 100, Math.round(lng * 100) / 100];
}
