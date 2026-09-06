import { describe, expect, it } from 'vitest';
import { lirePrix, moisCible } from './flightPrices';
import type { TripConstraints } from '@tripora/core';

function constraints(overrides: Partial<TripConstraints> = {}): TripConstraints {
  return {
    participants: 2,
    origin: { name: 'Paris', lat: 48.8566, lng: 2.3522, iata: ['PAR'] },
    durationDays: 4,
    dateMode: 'month',
    budgetMode: 'cheapest',
    budgetPerPersonCents: null,
    comfortLevel: 'budget',
    groupType: 'friends',
    ...overrides,
  };
}

const SEPTEMBRE_2026 = new Date('2026-09-06T10:00:00Z');

describe('mois visé pour la recherche de prix', () => {
  it('reste sur l’année en cours pour un mois à venir', () => {
    expect(moisCible(constraints({ month: 10 }), SEPTEMBRE_2026)).toBe('2026-10');
  });

  it('bascule sur l’an prochain pour un mois déjà passé', () => {
    // « On part en mars » dit en septembre parle de mars prochain.
    expect(moisCible(constraints({ month: 3 }), SEPTEMBRE_2026)).toBe('2027-03');
  });

  it('garde le mois courant plutôt que de sauter un an', () => {
    expect(moisCible(constraints({ month: 9 }), SEPTEMBRE_2026)).toBe('2026-09');
  });

  it('préfère une date précise quand il y en a une', () => {
    expect(
      moisCible(constraints({ dateMode: 'exact', startDate: '2027-04-12', month: 10 }), SEPTEMBRE_2026),
    ).toBe('2027-04');
  });

  it('se rabat sur le début de la fenêtre souhaitée', () => {
    expect(
      moisCible(constraints({ dateMode: 'window', windowStart: '2026-12-20' }), SEPTEMBRE_2026),
    ).toBe('2026-12');
  });

  it('n’invente rien quand aucune période n’est donnée', () => {
    expect(moisCible(constraints({ dateMode: 'weekend' }), SEPTEMBRE_2026)).toBeNull();
  });
});

describe('lecture défensive de la réponse serveur', () => {
  it('lit une réponse conforme', () => {
    // Forme réellement renvoyée par la fonction, vérifiée en production.
    const prix = lirePrix({
      prices: {
        barcelone: {
          cents: 5700,
          source: 'observed',
          provider: 'Aviasales',
          fetchedAt: '2026-09-03T23:42:26',
        },
      },
      configured: true,
    });
    expect(prix.configured).toBe(true);
    expect(prix.parDestination.barcelone?.cents).toBe(5700);
    expect(prix.parDestination.barcelone?.source).toBe('observed');
  });

  it('écarte un prix sans date de relevé : ce n’est pas une observation', () => {
    const prix = lirePrix({ prices: { rome: { cents: 7100, provider: 'Aviasales' } } });
    expect(prix.parDestination.rome).toBeUndefined();
  });

  it('écarte les montants aberrants plutôt que de les afficher', () => {
    const prix = lirePrix({
      prices: {
        a: { cents: 0, fetchedAt: '2026-09-05T10:00:00' },
        b: { cents: -100, fetchedAt: '2026-09-05T10:00:00' },
        c: { cents: 'gratuit', fetchedAt: '2026-09-05T10:00:00' },
        d: { cents: 12.5, fetchedAt: '2026-09-05T10:00:00' },
        e: { cents: 8900, fetchedAt: '2026-09-05T10:00:00' },
      },
    });
    expect(Object.keys(prix.parDestination)).toEqual(['e']);
  });

  it('ne s’effondre pas sur une réponse inattendue', () => {
    for (const cas of [null, undefined, 'oups', 42, {}, { prices: 'non' }, { prices: null }]) {
      expect(() => lirePrix(cas)).not.toThrow();
      expect(lirePrix(cas).parDestination).toEqual({});
    }
  });

  it('remonte l’épuisement du quota pour que l’écran le dise', () => {
    expect(lirePrix({ prices: {}, configured: true, quotaExceeded: true }).quotaExceeded).toBe(true);
  });
});
