/**
 * La météo réelle, quand elle existe.
 *
 * Les normales climatiques (`catalog/climate.ts`) répondent à « quel mois
 * partir » : elles sont moyennées sur trois ans et valent pour n'importe
 * quelle date. La prévision répond à une autre question — « qu'est-ce qu'on
 * fait mercredi » — et ne vaut que sur une quinzaine de jours. Les deux
 * coexistent, et l'écran choisit selon la distance au départ.
 *
 * Source : Open-Meteo, gratuit et sans clé. Comme partout ailleurs dans
 * Tripora, ces chiffres viennent d'une mesure et jamais d'un modèle de
 * langage : une prévision inventée ferait rater un train.
 */

export interface DailyWeather {
  /** Jour local à destination, au format ISO. */
  date: string;
  maxC: number;
  minC: number;
  /** Cumul de précipitations, en millimètres. */
  rainMm: number;
  windKmh: number;
  /** Code temps de l'OMM, tel que le fournit Open-Meteo. */
  code: number;
}

/** Ce à quoi ressemble le ciel, en six familles suffisantes pour décider. */
export type Sky = 'soleil' | 'eclaircies' | 'nuages' | 'brouillard' | 'pluie' | 'neige' | 'orage';

/** Ce que la journée permet de prévoir. */
export type DayVerdict = 'dehors' | 'mitige' | 'dedans';

/**
 * Les codes de l'Organisation météorologique mondiale, regroupés.
 *
 * On ne distingue pas la bruine faible de la bruine modérée : personne
 * n'organise sa journée là-dessus. Ce qui compte tient en sept familles.
 */
export function skyFor(code: number): Sky {
  if (code === 0) return 'soleil';
  if (code === 1 || code === 2) return 'eclaircies';
  if (code === 3) return 'nuages';
  if (code === 45 || code === 48) return 'brouillard';
  if (code >= 95) return 'orage';
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'neige';
  return 'pluie';
}

const LIBELLES: Readonly<Record<Sky, string>> = {
  soleil: 'grand soleil',
  eclaircies: 'éclaircies',
  nuages: 'ciel couvert',
  brouillard: 'brouillard',
  pluie: 'pluie',
  neige: 'neige',
  orage: 'orage',
};

const EMOJIS: Readonly<Record<Sky, string>> = {
  soleil: '☀️',
  eclaircies: '🌤️',
  nuages: '☁️',
  brouillard: '🌫️',
  pluie: '🌧️',
  neige: '❄️',
  orage: '⛈️',
};

export function weatherLabel(code: number): string {
  return LIBELLES[skyFor(code)];
}

export function weatherEmoji(code: number): string {
  return EMOJIS[skyFor(code)];
}

/**
 * Peut-on prévoir sa journée dehors ?
 *
 * Les seuils sont volontairement grossiers : l'objectif est de dire « prévoyez
 * l'intérieur mercredi », pas de simuler une station météo. Un demi-millimètre
 * de pluie ne gâche pas une journée ; huit, si.
 */
export function dayVerdict(jour: DailyWeather): DayVerdict {
  const ciel = skyFor(jour.code);
  if (ciel === 'orage' || ciel === 'neige') return 'dedans';
  if (jour.rainMm >= 8 || jour.windKmh >= 50 || jour.maxC < 5) return 'dedans';
  if (jour.rainMm >= 1 || ciel === 'brouillard' || jour.maxC < 12 || jour.maxC > 35) {
    return 'mitige';
  }
  return 'dehors';
}

/** « pluie, 18 ° » — la phrase courte d'un jour d'itinéraire. */
export function describeDay(jour: DailyWeather): string {
  return `${weatherLabel(jour.code)}, ${Math.round(jour.maxC)} °`;
}

/**
 * Nettoie ce qu'Open-Meteo renvoie.
 *
 * Le dernier jour de la fenêtre arrive systématiquement à `null` sur tous les
 * champs — la prévision existe pour seize jours mais le seizième n'est pas
 * encore calculé. Sans ce filtre, l'écran affiche « NaN ° » le jour où le
 * voyage tombe pile au bord.
 */
export function parseForecast(brut: unknown): DailyWeather[] {
  if (typeof brut !== 'object' || brut === null) return [];
  const daily = (brut as { daily?: unknown }).daily;
  if (typeof daily !== 'object' || daily === null) return [];

  const bloc = daily as Record<string, unknown>;
  const dates = bloc.time;
  if (!Array.isArray(dates)) return [];

  const jours: DailyWeather[] = [];
  for (const [index, date] of dates.entries()) {
    if (typeof date !== 'string') continue;
    const maxC = nombre(bloc.temperature_2m_max, index);
    const minC = nombre(bloc.temperature_2m_min, index);
    const code = nombre(bloc.weather_code, index);
    // Sans température ni code, la ligne ne dit rien : on la laisse tomber
    // plutôt que d'afficher un jour vide.
    if (maxC === null || minC === null || code === null) continue;
    jours.push({
      date,
      maxC,
      minC,
      code,
      rainMm: nombre(bloc.precipitation_sum, index) ?? 0,
      windKmh: nombre(bloc.wind_speed_10m_max, index) ?? 0,
    });
  }
  return jours;
}

function nombre(colonne: unknown, index: number): number | null {
  if (!Array.isArray(colonne)) return null;
  const valeur = colonne[index];
  return typeof valeur === 'number' && Number.isFinite(valeur) ? valeur : null;
}

/**
 * La prévision couvre-t-elle le voyage, au moins en partie ?
 *
 * Sert à choisir entre la prévision et les normales : à trois semaines du
 * départ, la prévision n'existe pas et les moyennes sont la seule réponse
 * honnête.
 */
export function forecastCovers(
  jours: readonly DailyWeather[],
  startDate: string | undefined,
  durationDays: number,
): boolean {
  if (!startDate || jours.length === 0) return false;
  const debut = Date.parse(`${startDate}T00:00:00Z`);
  if (Number.isNaN(debut)) return false;
  const fin = debut + Math.max(0, durationDays - 1) * 86_400_000;
  return jours.some((jour) => {
    const quand = Date.parse(`${jour.date}T00:00:00Z`);
    return !Number.isNaN(quand) && quand >= debut && quand <= fin;
  });
}

/** Les jours de la prévision qui tombent pendant le voyage, dans l'ordre. */
export function forecastForTrip(
  jours: readonly DailyWeather[],
  startDate: string | undefined,
  durationDays: number,
): DailyWeather[] {
  if (!startDate) return [];
  const debut = Date.parse(`${startDate}T00:00:00Z`);
  if (Number.isNaN(debut)) return [];
  const fin = debut + Math.max(0, durationDays - 1) * 86_400_000;
  return jours
    .filter((jour) => {
      const quand = Date.parse(`${jour.date}T00:00:00Z`);
      return !Number.isNaN(quand) && quand >= debut && quand <= fin;
    })
    .sort((a, b) => a.date.localeCompare(b.date));
}
