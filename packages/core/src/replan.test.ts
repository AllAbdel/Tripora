import { describe, expect, it } from 'vitest';
import { outdoorShare, suggestWeatherSwaps, type DayPlan } from './replan.js';
import type { DailyWeather } from './weather.js';

function ciel(date: string, overrides: Partial<DailyWeather> = {}): DailyWeather {
  return { date, maxC: 24, minC: 15, rainMm: 0, windKmh: 10, code: 0, ...overrides };
}

const RANDONNEE: DayPlan = {
  dayIndex: 1,
  date: '2026-09-09', // un mercredi
  axes: ['nature', 'adventure'],
};
const MUSEES: DayPlan = {
  dayIndex: 2,
  date: '2026-09-11', // un vendredi
  axes: ['culture', 'food'],
};

describe('exposition d’une journée', () => {
  it('reconnaît une journée dehors', () => {
    expect(outdoorShare(['nature'])).toBe(1);
    expect(outdoorShare(['nature', 'adventure'])).toBeGreaterThan(0.9);
  });

  it('reconnaît une journée à l’abri', () => {
    expect(outdoorShare(['culture', 'food'])).toBeLessThan(0.2);
  });

  it('ne tranche pas sur une journée sans programme', () => {
    expect(outdoorShare([])).toBe(0);
  });
});

describe('échanges suggérés par la météo', () => {
  it('propose d’échanger la randonnée pluvieuse et la journée musée ensoleillée', () => {
    const suggestions = suggestWeatherSwaps(
      [RANDONNEE, MUSEES],
      [ciel('2026-09-09', { code: 63, rainMm: 12 }), ciel('2026-09-11')],
    );
    expect(suggestions).toHaveLength(1);
    expect(suggestions[0]).toMatchObject({ from: 1, to: 2 });
    expect(suggestions[0]!.reason).toContain('Mercredi');
    expect(suggestions[0]!.reason).toContain('Vendredi');
    expect(suggestions[0]!.reason).toContain('pluie');
  });

  it('se tait quand il fait beau partout', () => {
    expect(
      suggestWeatherSwaps([RANDONNEE, MUSEES], [ciel('2026-09-09'), ciel('2026-09-11')]),
    ).toEqual([]);
  });

  it('se tait quand il pleut partout : déplacer n’y changerait rien', () => {
    expect(
      suggestWeatherSwaps(
        [RANDONNEE, MUSEES],
        [
          ciel('2026-09-09', { code: 63, rainMm: 12 }),
          ciel('2026-09-11', { code: 63, rainMm: 12 }),
        ],
      ),
    ).toEqual([]);
  });

  it('se tait quand les deux journées se passent dehors', () => {
    const autreRando: DayPlan = { ...MUSEES, axes: ['nature'] };
    expect(
      suggestWeatherSwaps(
        [RANDONNEE, autreRando],
        [ciel('2026-09-09', { code: 63, rainMm: 12 }), ciel('2026-09-11')],
      ),
    ).toEqual([]);
  });

  it('ignore les journées sans prévision', () => {
    // À trois semaines du départ il n'y a pas de météo : pas de suggestion,
    // et surtout pas d'erreur.
    expect(suggestWeatherSwaps([RANDONNEE, MUSEES], [])).toEqual([]);
    expect(
      suggestWeatherSwaps([{ ...RANDONNEE, date: undefined }, MUSEES], [ciel('2026-09-11')]),
    ).toEqual([]);
  });

  it('traite l’orage avant la bruine', () => {
    const orageux: DayPlan = { dayIndex: 3, date: '2026-09-10', axes: ['nature'] };
    const abri1: DayPlan = { dayIndex: 4, date: '2026-09-12', axes: ['culture'] };
    const abri2: DayPlan = { dayIndex: 5, date: '2026-09-13', axes: ['culture'] };
    const suggestions = suggestWeatherSwaps(
      [RANDONNEE, orageux, abri1, abri2],
      [
        ciel('2026-09-09', { code: 61, rainMm: 1.5 }),
        ciel('2026-09-10', { code: 95 }),
        ciel('2026-09-12'),
        ciel('2026-09-13'),
      ],
    );
    expect(suggestions[0]?.from).toBe(3);
    expect(suggestions[0]!.reason).toContain('tempête');
  });

  it('n’utilise jamais deux fois la même journée', () => {
    const jours: DayPlan[] = [
      { dayIndex: 1, date: '2026-09-09', axes: ['nature'] },
      { dayIndex: 2, date: '2026-09-10', axes: ['nature'] },
      { dayIndex: 3, date: '2026-09-11', axes: ['culture'] },
    ];
    const suggestions = suggestWeatherSwaps(jours, [
      ciel('2026-09-09', { code: 63, rainMm: 10 }),
      ciel('2026-09-10', { code: 63, rainMm: 10 }),
      ciel('2026-09-11'),
    ]);
    const touches = suggestions.flatMap((entree) => [entree.from, entree.to]);
    expect(new Set(touches).size).toBe(touches.length);
  });

  it('respecte le nombre maximum demandé', () => {
    const jours: DayPlan[] = [
      { dayIndex: 1, date: '2026-09-09', axes: ['nature'] },
      { dayIndex: 2, date: '2026-09-10', axes: ['nature'] },
      { dayIndex: 3, date: '2026-09-11', axes: ['culture'] },
      { dayIndex: 4, date: '2026-09-12', axes: ['culture'] },
    ];
    const suggestions = suggestWeatherSwaps(
      jours,
      [
        ciel('2026-09-09', { code: 63, rainMm: 10 }),
        ciel('2026-09-10', { code: 63, rainMm: 10 }),
        ciel('2026-09-11'),
        ciel('2026-09-12'),
      ],
      { max: 1 },
    );
    expect(suggestions).toHaveLength(1);
  });
});
