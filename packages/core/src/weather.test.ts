import { describe, expect, it } from 'vitest';
import {
  dayVerdict,
  describeDay,
  forecastCovers,
  forecastForTrip,
  parseForecast,
  skyFor,
  weatherIcon,
  weatherLabel,
  type DailyWeather,
} from './weather.js';

function jour(overrides: Partial<DailyWeather> = {}): DailyWeather {
  return { date: '2026-09-10', maxC: 24, minC: 15, rainMm: 0, windKmh: 12, code: 0, ...overrides };
}

describe('lecture des codes OMM', () => {
  it('range chaque code dans sa famille', () => {
    expect(skyFor(0)).toBe('soleil');
    expect(skyFor(2)).toBe('eclaircies');
    expect(skyFor(3)).toBe('nuages');
    expect(skyFor(48)).toBe('brouillard');
    expect(skyFor(63)).toBe('pluie');
    expect(skyFor(82)).toBe('pluie');
    expect(skyFor(73)).toBe('neige');
    expect(skyFor(86)).toBe('neige');
    expect(skyFor(99)).toBe('orage');
  });

  it('donne un libellé et une image à chaque code', () => {
    for (const code of [0, 1, 2, 3, 45, 51, 61, 71, 80, 95, 99]) {
      expect(weatherLabel(code).length).toBeGreaterThan(3);
      expect(weatherIcon(code).length).toBeGreaterThan(0);
    }
  });
});

describe('verdict de la journée', () => {
  it('laisse sortir par beau temps', () => {
    expect(dayVerdict(jour())).toBe('dehors');
  });

  it('renvoie à l’intérieur sous l’orage, même sans pluie annoncée', () => {
    expect(dayVerdict(jour({ code: 95, rainMm: 0 }))).toBe('dedans');
  });

  it('distingue l’averse passagère du jour perdu', () => {
    expect(dayVerdict(jour({ code: 61, rainMm: 2 }))).toBe('mitige');
    expect(dayVerdict(jour({ code: 65, rainMm: 14 }))).toBe('dedans');
  });

  it('compte aussi le vent et le froid', () => {
    expect(dayVerdict(jour({ windKmh: 62 }))).toBe('dedans');
    expect(dayVerdict(jour({ maxC: 3 }))).toBe('dedans');
    expect(dayVerdict(jour({ maxC: 9 }))).toBe('mitige');
    expect(dayVerdict(jour({ maxC: 38 }))).toBe('mitige');
  });

  it('résume la journée en trois mots', () => {
    expect(describeDay(jour({ code: 61, maxC: 17.6 }))).toBe('pluie, 18 °');
  });
});

describe('lecture de la réponse Open-Meteo', () => {
  // Réponse réelle du 6 septembre 2026 pour Lisbonne, réduite : Open-Meteo
  // renvoie bien seize jours, mais le seizième est vide.
  const REPONSE = {
    daily: {
      time: ['2026-09-07', '2026-09-08', '2026-09-09'],
      weather_code: [3, 1, null],
      temperature_2m_max: [30.1, 26.6, null],
      temperature_2m_min: [20.0, 18.8, null],
      precipitation_sum: [0, 1.4, null],
      wind_speed_10m_max: [18.2, 22.1, null],
    },
  };

  it('laisse tomber le dernier jour, qui n’est pas encore calculé', () => {
    const jours = parseForecast(REPONSE);
    expect(jours).toHaveLength(2);
    expect(jours.map((entree) => entree.date)).toEqual(['2026-09-07', '2026-09-08']);
  });

  it('lit correctement ce qui est présent', () => {
    expect(parseForecast(REPONSE)[1]).toEqual({
      date: '2026-09-08',
      maxC: 26.6,
      minC: 18.8,
      rainMm: 1.4,
      windKmh: 22.1,
      code: 1,
    });
  });

  it('ne casse sur rien', () => {
    expect(parseForecast(null)).toEqual([]);
    expect(parseForecast({})).toEqual([]);
    expect(parseForecast({ daily: { time: 'demain' } })).toEqual([]);
    expect(parseForecast({ daily: { time: ['2026-09-07'] } })).toEqual([]);
  });
});

describe('recoupement avec les dates du voyage', () => {
  const JOURS = ['2026-09-07', '2026-09-08', '2026-09-09', '2026-09-10'].map((date) =>
    jour({ date }),
  );

  it('reconnaît un voyage dans la fenêtre', () => {
    expect(forecastCovers(JOURS, '2026-09-08', 3)).toBe(true);
  });

  it('sait qu’un départ lointain n’est pas prévisible', () => {
    // À trois semaines, la prévision n'existe pas : les normales sont la seule
    // réponse honnête, et l'écran doit pouvoir le savoir.
    expect(forecastCovers(JOURS, '2026-11-02', 5)).toBe(false);
    expect(forecastCovers(JOURS, undefined, 5)).toBe(false);
    expect(forecastCovers([], '2026-09-08', 3)).toBe(false);
  });

  it('ne garde que les jours du séjour, dans l’ordre', () => {
    const retenus = forecastForTrip(JOURS, '2026-09-08', 2);
    expect(retenus.map((entree) => entree.date)).toEqual(['2026-09-08', '2026-09-09']);
  });

  it('rend une liste vide plutôt qu’une erreur sur une date illisible', () => {
    expect(forecastForTrip(JOURS, 'la semaine prochaine', 3)).toEqual([]);
  });
});
