/**
 * La conversion de MET Norway vers les journées que lit l'application.
 *
 *   deno test supabase/functions/weather/met.test.ts
 *
 * Aucune dépendance : tourne hors ligne.
 */
import { codeOmm, journeesDepuisMet } from './met.ts';

function egal(obtenu: unknown, attendu: unknown, quoi: string): void {
  if (JSON.stringify(obtenu) !== JSON.stringify(attendu)) {
    throw new Error(`${quoi} : attendu ${JSON.stringify(attendu)}, obtenu ${JSON.stringify(obtenu)}`);
  }
}

/** Une heure de la série, à la forme de MET. */
function heure(time: string, temperature: number, symbole: string, pluie = 0, vent = 2) {
  return {
    time,
    data: {
      instant: { details: { air_temperature: temperature, wind_speed: vent } },
      next_1_hours: { summary: { symbol_code: symbole }, details: { precipitation_amount: pluie } },
    },
  };
}

Deno.test('les symboles de MET deviennent des codes de l’OMM', () => {
  egal(codeOmm('clearsky_day'), 0, 'grand soleil');
  egal(codeOmm('partlycloudy_night'), 2, 'éclaircies');
  egal(codeOmm('cloudy'), 3, 'couvert');
  egal(codeOmm('fog'), 45, 'brouillard');
  egal(codeOmm('lightrain'), 61, 'pluie faible');
  egal(codeOmm('heavyrainshowers_day'), 82, 'fortes averses');
  egal(codeOmm('snow'), 73, 'neige');
  egal(codeOmm('rainandthunder'), 95, 'orage');
});

Deno.test('les heures sont regroupées en journées à destination, pas en heure UTC', () => {
  // 23 h UTC le 12 = 8 h du matin le 13 à Tokyo.
  const brut = {
    properties: {
      timeseries: [
        ...Array.from({ length: 8 }, (_, i) =>
          heure(`2026-10-12T${String(23 - i).padStart(2, '0')}:00:00Z`, 15 + i, 'cloudy'),
        ),
      ],
    },
  };
  const tokyo = journeesDepuisMet(brut, 'Asia/Tokyo').daily.time;
  const utc = journeesDepuisMet(brut, 'UTC').daily.time;
  egal(utc, ['2026-10-12'], 'en UTC, une seule journée');
  egal(tokyo.includes('2026-10-13'), true, 'à Tokyo, la soirée UTC est déjà le lendemain');
});

Deno.test('maximum, minimum, cumul de pluie et vent en km/h', () => {
  const brut = {
    properties: {
      timeseries: Array.from({ length: 12 }, (_, i) =>
        heure(`2026-10-14T${String(6 + i).padStart(2, '0')}:00:00Z`, 10 + i, i === 3 ? 'rain' : 'cloudy', i === 3 ? 4 : 0, i === 5 ? 10 : 2),
      ),
    },
  };
  const { daily } = journeesDepuisMet(brut, 'UTC');
  egal(daily.temperature_2m_max, [21], 'maximum');
  egal(daily.temperature_2m_min, [10], 'minimum');
  egal(daily.precipitation_sum, [4], 'cumul');
  egal(daily.wind_speed_10m_max, [36], '10 m/s font 36 km/h');
  egal(daily.weather_code, [63], 'la pluie l’emporte sur les nuages');
});

Deno.test('une heure de bruine ne fait pas une journée de pluie, et une fin de série n’est pas une journée', () => {
  const brut = {
    properties: {
      timeseries: [
        ...Array.from({ length: 10 }, (_, i) =>
          heure(`2026-10-15T${String(8 + i).padStart(2, '0')}:00:00Z`, 12, i === 2 ? 'rain' : 'cloudy', i === 2 ? 0.1 : 0),
        ),
        heure('2026-10-16T00:00:00Z', 8, 'cloudy'),
      ],
    },
  };
  const { daily } = journeesDepuisMet(brut, 'UTC');
  egal(daily.time, ['2026-10-15'], 'le 16 n’a qu’une heure');
  egal(daily.weather_code, [3], '0,1 mm : ciel couvert');
});

Deno.test('une réponse inattendue donne une prévision vide, pas une erreur', () => {
  egal(journeesDepuisMet(null).daily.time, [], 'null');
  egal(journeesDepuisMet({ properties: {} }).daily.time, [], 'sans série');
});
