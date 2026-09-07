import { describe, expect, it } from 'vitest';
import { DESTINATIONS, findDestination } from './destinations.js';
import { isReasonableSeason, reasonableDistanceKm, selectCandidates } from './candidates.js';
import { PREFERENCE_AXES } from '../preferences.js';
import { haversineKm } from '../geo.js';
import type { TripConstraints } from '../types.js';

const PARIS = { name: 'Paris', lat: 48.8566, lng: 2.3522 };

function constraints(overrides: Partial<TripConstraints> = {}): TripConstraints {
  return {
    participants: 4,
    origin: PARIS,
    durationDays: 4,
    dateMode: 'month',
    month: 6,
    budgetMode: 'max_per_person',
    budgetPerPersonCents: 50_000,
    comfortLevel: 'budget',
    groupType: 'friends',
    ...overrides,
  };
}

describe('intégrité du catalogue', () => {
  it('n’a pas de doublon d’identifiant', () => {
    const ids = DESTINATIONS.map((d) => d.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('a des coordonnées, un pays et un code IATA plausibles partout', () => {
    for (const destination of DESTINATIONS) {
      expect(Math.abs(destination.lat), destination.id).toBeLessThanOrEqual(90);
      expect(Math.abs(destination.lng), destination.id).toBeLessThanOrEqual(180);
      expect(destination.countryCode, destination.id).toMatch(/^[A-Z]{2}$/);
      expect(destination.iata.length, destination.id).toBeGreaterThan(0);
      for (const code of destination.iata) {
        expect(code, destination.id).toMatch(/^[A-Z]{3}$/);
      }
    }
  });

  it('a des notes d’envies complètes et bornées', () => {
    for (const destination of DESTINATIONS) {
      for (const axis of PREFERENCE_AXES) {
        const value = destination.tags[axis];
        expect(typeof value, `${destination.id}.${axis}`).toBe('number');
        expect(value, `${destination.id}.${axis}`).toBeGreaterThanOrEqual(0);
        expect(value, `${destination.id}.${axis}`).toBeLessThanOrEqual(1);
      }
    }
  });

  it('a des indices de cherté et de richesse crédibles', () => {
    for (const destination of DESTINATIONS) {
      expect(destination.costIndex, destination.id).toBeGreaterThan(0.3);
      expect(destination.costIndex, destination.id).toBeLessThan(2.5);
      expect(destination.poiRichness, destination.id).toBeGreaterThan(0);
      expect(destination.poiRichness, destination.id).toBeLessThanOrEqual(1);
      expect(destination.bestMonths.length, destination.id).toBeGreaterThan(0);
      for (const month of destination.bestMonths) {
        expect(month, destination.id).toBeGreaterThanOrEqual(1);
        expect(month, destination.id).toBeLessThanOrEqual(12);
      }
    }
  });

  it('propose un choix assez large pour que la comparaison ait un sens', () => {
    expect(DESTINATIONS.length).toBeGreaterThanOrEqual(480);
    expect(new Set(DESTINATIONS.map((d) => d.countryCode)).size).toBeGreaterThanOrEqual(100);
  });

  it('sort de l’Europe, sinon « surprends-nous » ne surprend personne', () => {
    // Un catalogue tout européen ramènerait toujours les mêmes vingt villes
    // dès qu'on part plus d'une semaine. On vérifie que chaque continent
    // habité pèse assez pour qu'un long séjour ait de quoi choisir.
    const parZone = (test: (d: (typeof DESTINATIONS)[number]) => boolean) =>
      DESTINATIONS.filter(test).length;
    expect(parZone((d) => d.lat < 0), 'hémisphère sud').toBeGreaterThanOrEqual(40);
    expect(parZone((d) => d.lng > 60), 'Asie-Océanie').toBeGreaterThanOrEqual(60);
    expect(parZone((d) => d.lng < -30), 'Amériques').toBeGreaterThanOrEqual(50);
  });

  it('se retrouve par identifiant', () => {
    expect(findDestination('budapest')?.name).toBe('Budapest');
    expect(findDestination('inconnue')).toBeUndefined();
  });
});

describe('présélection des candidates', () => {
  it('ne propose jamais la ville de départ', () => {
    const ids = selectCandidates(constraints()).map((d) => d.id);
    expect(ids).not.toContain('paris');
  });

  it('reste dans une distance cohérente avec la durée du séjour', () => {
    expect(reasonableDistanceKm(2)).toBeLessThan(reasonableDistanceKm(5));
    for (const destination of selectCandidates(constraints({ durationDays: 2 }))) {
      expect(haversineKm(PARIS, destination), destination.id).toBeLessThanOrEqual(1200);
    }
  });

  it('écarte les villes hors saison', () => {
    // Tenerife est une destination d'hiver : elle ne doit pas sortir en juin.
    expect(isReasonableSeason({ bestMonths: [1, 2, 3, 11, 12] } as never, 6)).toBe(false);
    expect(isReasonableSeason({ bestMonths: [5, 6, 9] } as never, 6)).toBe(true);
    // Tolérance d'un mois : avril passe pour une destination de mai.
    expect(isReasonableSeason({ bestMonths: [5, 6] } as never, 4)).toBe(true);
    // Le passage décembre/janvier ne doit pas être vu comme onze mois d'écart.
    expect(isReasonableSeason({ bestMonths: [12] } as never, 1)).toBe(true);
  });

  it('écarte ce qui dépasse déjà le budget avant même le transport', () => {
    // Limite haute : on veut mesurer le filtre, pas le plafond de résultats.
    const all = { limit: 1000 };
    const serre = selectCandidates(constraints({ budgetPerPersonCents: 25_000 }), all);
    const large = selectCandidates(constraints({ budgetPerPersonCents: 200_000 }), all);
    expect(serre.length).toBeLessThan(large.length);
    // Avec 250 € tout compris pour 4 jours, la Suisse et l'Islande sont exclues.
    expect(serre.map((d) => d.id)).not.toContain('zurich');
    expect(serre.map((d) => d.id)).not.toContain('reykjavik');
  });

  it('respecte la limite demandée et les exclusions', () => {
    const ids = selectCandidates(constraints(), { limit: 5, exclude: ['budapest'] });
    expect(ids).toHaveLength(5);
    expect(ids.map((d) => d.id)).not.toContain('budapest');
  });

  it('est déterministe', () => {
    expect(selectCandidates(constraints())).toEqual(selectCandidates(constraints()));
  });

  it('renvoie quand même quelque chose sans budget ni mois précis', () => {
    const ids = selectCandidates(
      constraints({ budgetPerPersonCents: null, month: undefined, dateMode: 'weekend' }),
    );
    expect(ids.length).toBeGreaterThan(5);
  });
});
