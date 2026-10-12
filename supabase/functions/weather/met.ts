/**
 * La prévision de MET Norway, ramenée à la forme que lit `@tripora/core`.
 *
 * Pourquoi MET Norway : l'institut météorologique norvégien publie ses
 * prévisions mondiales sous licence CC BY 4.0, usage commercial compris. L'offre
 * gratuite d'Open-Meteo, elle, est réservée à un usage non commercial — et
 * Tripora vit de liens partenaires.
 *
 * MET donne une série horaire (puis par tranches de six heures au-delà de deux
 * jours et demi), en heure UTC, avec un symbole par tranche. L'application
 * attend des journées locales : maximum, minimum, cumul de pluie, vent le plus
 * fort et un code de l'OMM. On regroupe donc par jour **à destination** (le
 * mercredi de Tokyo n'est pas celui d'Oslo), sans rien inventer : un jour qui
 * n'a pas assez de mesures est laissé de côté plutôt que deviné.
 *
 * Aucune dépendance : testé hors ligne par `met.test.ts`.
 */

interface Tranche {
  summary?: { symbol_code?: unknown };
  details?: { precipitation_amount?: unknown; air_temperature_max?: unknown; air_temperature_min?: unknown };
}

interface Point {
  time?: unknown;
  data?: {
    instant?: { details?: { air_temperature?: unknown; wind_speed?: unknown } };
    next_1_hours?: Tranche;
    next_6_hours?: Tranche;
  };
}

/** La forme d'Open-Meteo, que `parseForecast` sait lire. */
export interface JourneesOpenMeteo {
  daily: {
    time: string[];
    weather_code: number[];
    temperature_2m_max: number[];
    temperature_2m_min: number[];
    precipitation_sum: number[];
    wind_speed_10m_max: number[];
  };
}

/**
 * Les symboles de MET, vers le code de l'OMM le plus proche — ceux que
 * l'application regroupe en sept ciels. `_day`, `_night`, `_polartwilight`
 * ne changent rien au temps qu'il fait.
 */
export function codeOmm(symbole: string): number {
  const nom = symbole.replace(/_(day|night|polartwilight)$/u, '');
  if (nom.includes('thunder')) return 95;
  if (nom.includes('sleet')) return 67;
  if (nom.includes('snow')) return nom.includes('heavy') ? 75 : nom.includes('light') ? 71 : 73;
  if (nom.includes('showers')) return nom.includes('heavy') ? 82 : nom.includes('light') ? 80 : 81;
  if (nom.includes('rain')) return nom.includes('heavy') ? 65 : nom.includes('light') ? 61 : 63;
  if (nom === 'fog') return 45;
  if (nom === 'cloudy') return 3;
  if (nom === 'partlycloudy') return 2;
  if (nom === 'fair') return 1;
  if (nom === 'clearsky') return 0;
  return 3;
}

/** Plus le code est grave, plus il l'emporte sur la journée : une averse gâche plus qu'un nuage. */
function gravite(code: number): number {
  if (code >= 95) return 9;
  if (code >= 71 && code <= 77) return 8;
  if (code === 65 || code === 82 || code === 67) return 7;
  if (code >= 61 || code >= 80) return 6;
  if (code === 45) return 4;
  return code;
}

/**
 * Une heure de pluie ne fait pas une journée de pluie : le symbole le plus
 * grave est ramené à ce que dit le cumul. Moins de 0,3 mm, c'est un ciel
 * couvert ; moins de 2 mm, une pluie faible.
 */
function selonLeCumul(code: number, pluie: number): number {
  const pluvieux = (code >= 61 && code <= 65) || (code >= 80 && code <= 82);
  if (!pluvieux) return code;
  if (pluie < 0.3) return 3;
  if (pluie < 2) return code >= 80 ? 80 : 61;
  return code;
}

function nombre(valeur: unknown): number | null {
  return typeof valeur === 'number' && Number.isFinite(valeur) ? valeur : null;
}

/** Le jour local (AAAA-MM-JJ) d'un instant UTC, à destination. */
function jourLocal(instant: Date, fuseau: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: fuseau, year: 'numeric', month: '2-digit', day: '2-digit' }).format(
    instant,
  );
}

interface Cumul {
  temperatures: number[];
  max: number | null;
  min: number | null;
  pluie: number;
  vent: number;
  code: number | null;
  heures: number;
}

export function journeesDepuisMet(brut: unknown, fuseau = 'UTC'): JourneesOpenMeteo {
  const vide: JourneesOpenMeteo = {
    daily: {
      time: [],
      weather_code: [],
      temperature_2m_max: [],
      temperature_2m_min: [],
      precipitation_sum: [],
      wind_speed_10m_max: [],
    },
  };
  const serie = (brut as { properties?: { timeseries?: unknown } } | null)?.properties?.timeseries;
  if (!Array.isArray(serie)) return vide;
  let zone = fuseau;
  try {
    jourLocal(new Date(), zone);
  } catch {
    zone = 'UTC';
  }

  const jours = new Map<string, Cumul>();
  for (const point of serie as Point[]) {
    if (typeof point.time !== 'string') continue;
    const instant = new Date(point.time);
    if (Number.isNaN(instant.getTime())) continue;
    const jour = jourLocal(instant, zone);
    const cumul = jours.get(jour) ?? { temperatures: [], max: null, min: null, pluie: 0, vent: 0, code: null, heures: 0 };
    jours.set(jour, cumul);

    const details = point.data?.instant?.details;
    const temperature = nombre(details?.air_temperature);
    if (temperature !== null) cumul.temperatures.push(temperature);
    const vent = nombre(details?.wind_speed);
    // MET donne le vent en m/s ; l'application l'attend en km/h, comme Open-Meteo.
    if (vent !== null) cumul.vent = Math.max(cumul.vent, vent * 3.6);

    // La pluie et le ciel : la tranche d'une heure quand elle existe, sinon
    // celle de six heures. Jamais les deux, pour ne pas compter deux fois.
    const tranche = point.data?.next_1_hours ?? point.data?.next_6_hours;
    const duree = point.data?.next_1_hours ? 1 : point.data?.next_6_hours ? 6 : 0;
    if (!tranche || duree === 0) continue;
    cumul.heures += duree;
    cumul.pluie += nombre(tranche.details?.precipitation_amount) ?? 0;
    const max = nombre(tranche.details?.air_temperature_max);
    const min = nombre(tranche.details?.air_temperature_min);
    if (max !== null) cumul.max = cumul.max === null ? max : Math.max(cumul.max, max);
    if (min !== null) cumul.min = cumul.min === null ? min : Math.min(cumul.min, min);
    const symbole = tranche.summary?.symbol_code;
    if (typeof symbole === 'string') {
      const code = codeOmm(symbole);
      if (cumul.code === null || gravite(code) > gravite(cumul.code)) cumul.code = code;
    }
  }

  const sortie = vide;
  for (const [jour, cumul] of [...jours.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    // Moins de six heures couvertes : une fin de série, pas une journée.
    if (cumul.heures < 6 || cumul.code === null || cumul.temperatures.length === 0) continue;
    const arrondi = (valeur: number) => Math.round(valeur * 10) / 10;
    sortie.daily.time.push(jour);
    sortie.daily.weather_code.push(selonLeCumul(cumul.code, cumul.pluie));
    sortie.daily.temperature_2m_max.push(arrondi(Math.max(...cumul.temperatures, cumul.max ?? -Infinity)));
    sortie.daily.temperature_2m_min.push(arrondi(Math.min(...cumul.temperatures, cumul.min ?? Infinity)));
    sortie.daily.precipitation_sum.push(arrondi(cumul.pluie));
    sortie.daily.wind_speed_10m_max.push(arrondi(cumul.vent));
  }
  return sortie;
}
