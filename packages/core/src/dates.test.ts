import { describe, expect, it } from 'vitest';
import { monthNameFr, targetMonth } from './dates.js';
import type { TripConstraints } from './types.js';

function constraints(overrides: Partial<TripConstraints> = {}): TripConstraints {
  return {
    participants: 2,
    origin: { name: 'Paris', lat: 48.8566, lng: 2.3522 },
    durationDays: 4,
    dateMode: 'month',
    budgetMode: 'max_per_person',
    budgetPerPersonCents: 50_000,
    comfortLevel: 'budget',
    groupType: 'friends',
    ...overrides,
  };
}

describe('mois visé par un voyage', () => {
  it('prend le mois demandé en priorité', () => {
    expect(targetMonth(constraints({ month: 7, startDate: '2026-11-02' }))).toBe(7);
  });

  it('déduit le mois de la date de départ', () => {
    expect(targetMonth(constraints({ startDate: '2026-11-02' }))).toBe(11);
  });

  it('se rabat sur le début de la fenêtre quand rien n’est fixé', () => {
    expect(targetMonth(constraints({ dateMode: 'window', windowStart: '2027-03-15' }))).toBe(3);
  });

  it('ne devine rien quand la période est ouverte', () => {
    expect(targetMonth(constraints({ dateMode: 'window' }))).toBeUndefined();
  });

  it('ignore une date illisible plutôt que de renvoyer un mois faux', () => {
    expect(targetMonth(constraints({ startDate: 'bientôt' }))).toBeUndefined();
  });

  it('lit la date en UTC, sans décalage de fuseau', () => {
    // Un 1er du mois à minuit ne doit pas basculer sur le mois précédent selon
    // l'endroit d'où l'on ouvre l'app.
    expect(targetMonth(constraints({ startDate: '2026-08-01' }))).toBe(8);
  });

  it('nomme les mois, et rien d’autre', () => {
    expect(monthNameFr(1)).toBe('janvier');
    expect(monthNameFr(12)).toBe('décembre');
    expect(monthNameFr(undefined)).toBe('');
    expect(monthNameFr(13)).toBe('');
  });
});
