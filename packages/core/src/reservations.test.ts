import { describe, expect, it } from 'vitest';
import {
  FOURNISSEURS,
  evenementsDesReservations,
  heureLisible,
  joursCouverts,
  nuitsDe,
  reservationsDuJour,
  trierLesReservations,
  type Reservation,
} from './reservations.js';

const hotel: Reservation = {
  id: 'h1', tripId: 'v1', type: 'hebergement', fournisseur: 'booking', titre: 'Ubud Tropical Villas',
  debutLe: '2026-07-10', debutA: '14:00', finLe: '2026-07-13', finA: '12:00', devise: 'EUR',
};
const visite: Reservation = {
  id: 'a1', tripId: 'v1', type: 'activite', fournisseur: 'getyourguide', titre: 'Mont Batur',
  debutLe: '2026-07-12', debutA: '02:00', devise: 'EUR',
};
const transfert: Reservation = {
  id: 't1', tripId: 'v1', type: 'transport', fournisseur: 'autre', titre: 'Navette aéroport',
  debutLe: '2026-07-13', debutA: '13:30', devise: 'EUR',
};

describe('les réservations, jour par jour', () => {
  it('compte les nuits d’un séjour', () => {
    expect(nuitsDe(hotel)).toBe(3);
    expect(nuitsDe(visite)).toBeNull();
  });

  it('rappelle l’hôtel le jour de l’arrivée, chaque nuit, et le jour du départ', () => {
    expect(reservationsDuJour([hotel], '2026-07-10').map((m) => m.quoi)).toEqual(['arrivee']);
    expect(reservationsDuJour([hotel], '2026-07-11').map((m) => m.quoi)).toEqual(['nuit']);
    expect(reservationsDuJour([hotel], '2026-07-13').map((m) => m.quoi)).toEqual(['depart']);
    expect(reservationsDuJour([hotel], '2026-07-14')).toEqual([]);
  });

  it('range une journée dans l’ordre des heures', () => {
    const jour = reservationsDuJour([transfert, hotel, visite], '2026-07-13');
    expect(jour.map((moment) => `${moment.quoi}:${moment.reservation.id}`)).toEqual([
      'depart:h1',
      'rendez-vous:t1',
    ]);
    const nuitEtVisite = reservationsDuJour([hotel, visite], '2026-07-12');
    // La visite à 2 h du matin avant la nuit à l'hôtel, rappelée en fin de journée.
    expect(nuitEtVisite.map((moment) => moment.quoi)).toEqual(['rendez-vous', 'nuit']);
  });

  it('couvre chaque jour d’une excursion de plusieurs jours', () => {
    expect(joursCouverts({ debutLe: '2026-07-10', finLe: '2026-07-12' })).toEqual([
      '2026-07-10', '2026-07-11', '2026-07-12',
    ]);
    expect(joursCouverts({ debutLe: '2026-07-10' })).toEqual(['2026-07-10']);
  });

  it('trie du plus proche au plus lointain, puis par heure', () => {
    expect(trierLesReservations([transfert, visite, hotel]).map((r) => r.id)).toEqual(['h1', 'a1', 't1']);
  });

  it('ne connaît que des fournisseurs aux identifiants valides pour la base', () => {
    for (const fournisseur of FOURNISSEURS) {
      expect(fournisseur.id).toMatch(/^[a-z0-9-]{2,30}$/u);
      expect(fournisseur.site).toMatch(/^https:\/\//u);
    }
  });
});

describe('les réservations dans l’agenda', () => {
  it('donnent l’arrivée et le départ d’un hôtel, pas un bloc de plusieurs jours', () => {
    const evenements = evenementsDesReservations([{ ...hotel, reference: '4521.873.219' }, visite]);
    expect(evenements.map((e) => [e.titre, e.date, e.debut])).toEqual([
      ['Arrivée : Ubud Tropical Villas', '2026-07-10', '14:00'],
      ['Départ : Ubud Tropical Villas', '2026-07-13', '12:00'],
      ['Mont Batur', '2026-07-12', '02:00'],
    ]);
    expect(evenements[0]?.description).toContain('4521.873.219');
  });
});

describe('les heures, comme on les écrit', () => {
  it('sans minutes inutiles ni zéro devant', () => {
    expect(heureLisible('14:00')).toBe('14 h');
    expect(heureLisible('09:30')).toBe('9 h 30');
    expect(heureLisible('02:00')).toBe('2 h');
    expect(heureLisible(null)).toBeNull();
  });
});
