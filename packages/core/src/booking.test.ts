import { describe, expect, it } from 'vitest';
import { ajouterJours, sejourDe, stayLinks, travelLinks } from './booking.js';
import { findDestination } from './catalog/destinations.js';
import type { TripConstraints } from './types.js';

const PARIS = { name: 'Paris', lat: 48.8566, lng: 2.3522, iata: ['PAR', 'CDG'] };
const LISBONNE = findDestination('lisbonne')!;

function constraints(overrides: Partial<TripConstraints> = {}): TripConstraints {
  return {
    participants: 5,
    origin: PARIS,
    durationDays: 4,
    dateMode: 'month',
    month: 10,
    budgetMode: 'max_per_person',
    budgetPerPersonCents: 50_000,
    comfortLevel: 'budget',
    groupType: 'friends',
    ...overrides,
  };
}

/** Lecture des paramètres d'une URL, pour tester le sens et pas la chaîne. */
function params(url: string): URLSearchParams {
  return new URL(url).searchParams;
}

describe('séjour déduit du voyage', () => {
  it('reprend les dates exactes quand le groupe en a', () => {
    expect(sejourDe(constraints({ startDate: '2026-10-12', endDate: '2026-10-16' }))).toEqual({
      checkIn: '2026-10-12',
      checkOut: '2026-10-16',
      guests: 5,
    });
  });

  it('déduit le retour de la durée quand seul le départ est connu', () => {
    expect(sejourDe(constraints({ startDate: '2026-10-12', durationDays: 4 })).checkOut).toBe(
      '2026-10-16',
    );
  });

  it('n’invente pas de dates quand le groupe n’en a pas', () => {
    // « Une semaine en octobre » n'est pas une date. Un champ vide vaut mieux
    // qu'une date fausse déjà remplie.
    const sejour = sejourDe(constraints());
    expect(sejour.checkIn).toBeNull();
    expect(sejour.checkOut).toBeNull();
  });

  it('borne le nombre de voyageurs', () => {
    expect(sejourDe(constraints({ participants: 0 })).guests).toBe(1);
    expect(sejourDe(constraints({ participants: 900 })).guests).toBe(30);
  });

  it('franchit les fins de mois sans se tromper', () => {
    expect(ajouterJours('2026-10-30', 4)).toBe('2026-11-03');
    expect(ajouterJours('2026-12-30', 3)).toBe('2027-01-02');
    // Année bissextile.
    expect(ajouterJours('2028-02-27', 3)).toBe('2028-03-01');
    expect(ajouterJours('demain', 2)).toBeNull();
  });
});

describe('liens d’hébergement', () => {
  const sejour = { checkIn: '2026-10-12', checkOut: '2026-10-16', guests: 5 };

  it('préremplit ville, dates et nombre de personnes', () => {
    const booking = stayLinks(LISBONNE, sejour).find((lien) => lien.id === 'booking')!;
    const q = params(booking.url);
    expect(q.get('ss')).toBe('Lisbonne, Portugal');
    expect(q.get('checkin')).toBe('2026-10-12');
    expect(q.get('checkout')).toBe('2026-10-16');
    expect(q.get('group_adults')).toBe('5');
  });

  it('omet les dates plutôt que d’en inventer', () => {
    const liens = stayLinks(LISBONNE, { checkIn: null, checkOut: null, guests: 2 });
    for (const lien of liens) {
      const q = params(lien.url);
      expect(q.get('checkin') ?? q.get('date_from')).toBeNull();
      expect(lien.url).toContain('https://');
    }
  });

  it('propose trois logiques d’hébergement différentes', () => {
    expect(stayLinks(LISBONNE, sejour).map((lien) => lien.id)).toEqual([
      'booking',
      'airbnb',
      'hostelworld',
    ]);
  });

  it('échappe les noms de villes dans le chemin', () => {
    const airbnb = stayLinks(LISBONNE, sejour).find((lien) => lien.id === 'airbnb')!;
    // « Lisbonne, Portugal » ne doit pas casser l'URL.
    expect(() => new URL(airbnb.url)).not.toThrow();
    expect(airbnb.url).toContain('Lisbonne%2C%20Portugal');
  });
});

describe('liens de transport', () => {
  const sejour = { checkIn: '2026-10-12', checkOut: '2026-10-16', guests: 5 };

  it('pointe l’avion vers la source de nos propres prix', () => {
    const vol = travelLinks(PARIS, LISBONNE, sejour).find((lien) => lien.kind === 'flight')!;
    const q = params(vol.url);
    expect(q.get('origin_iata')).toBe('PAR');
    expect(q.get('destination_iata')).toBe('LIS');
    expect(q.get('depart_date')).toBe('2026-10-12');
  });

  it('n’affiche pas de lien d’avion sans code d’aéroport', () => {
    const sansAeroport = { name: 'Nulle part', lat: 0, lng: 0 };
    expect(
      travelLinks(sansAeroport, LISBONNE, sejour).some((lien) => lien.kind === 'flight'),
    ).toBe(false);
  });

  it('avertit que le train et le bus n’ont pas de prix vérifié', () => {
    const terrestre = travelLinks(PARIS, LISBONNE, sejour).find((lien) => lien.kind === 'train')!;
    expect(terrestre.note).toContain('estimations');
  });
});
