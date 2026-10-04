import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import type { Reservation } from '@tripora/core';
import type { ItineraryDayView } from '@/lib/itinerary';
import { LeVoyageAuPresent } from './LeVoyageAuPresent';

const hotel = (id: string, debutLe: string, finLe: string, titre = 'Villa Ubud'): Reservation => ({
  id,
  tripId: 'v1',
  type: 'hebergement',
  fournisseur: 'booking',
  titre,
  debutLe,
  finLe,
  debutA: '15:00',
  devise: 'EUR',
});

function afficher(maintenant: string, props: Partial<Parameters<typeof LeVoyageAuPresent>[0]> = {}) {
  return render(
    <MemoryRouter>
      <LeVoyageAuPresent
        tripId="v1"
        debut="2026-07-10"
        fin="2026-07-17"
        fuseau="Europe/Paris"
        reservations={[]}
        itineraire={undefined}
        maintenant={new Date(maintenant)}
        {...props}
      />
    </MemoryRouter>,
  );
}

describe('avant le départ', () => {
  it('compte les jours et signale les nuits sans toit', () => {
    afficher('2026-06-28T10:00:00Z', { reservations: [hotel('h1', '2026-07-10', '2026-07-13')] });
    expect(screen.getByRole('heading', { name: 'Départ dans 12 jours' })).toBeInTheDocument();
    expect(screen.getByText('du 10 au 17 juillet')).toBeInTheDocument();
    expect(screen.getByText(/4 nuits sans hébergement réservé, du 13 au 17 juillet/u)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Ajouter un hébergement/u })).toHaveAttribute(
      'href',
      '/voyages/v1/reservations',
    );
  });

  it('rassure quand tout est réservé', () => {
    afficher('2026-07-09T10:00:00Z', { reservations: [hotel('h1', '2026-07-10', '2026-07-17')] });
    expect(screen.getByRole('heading', { name: 'Départ demain' })).toBeInTheDocument();
    expect(screen.getByText('Chaque nuit a son hébergement réservé.')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Ajouter un hébergement/u })).not.toBeInTheDocument();
  });

  it('se tait sur les nuits tant que les réservations ne sont pas chargées', () => {
    afficher('2026-06-28T10:00:00Z', { reservations: undefined });
    expect(screen.queryByText(/sans hébergement/u)).not.toBeInTheDocument();
  });
});

describe('pendant le séjour', () => {
  const programme: ItineraryDayView[] = [
    {
      id: 'j3',
      dayIndex: 3,
      date: '2026-07-12',
      summary: '',
      items: [
        { id: 'a', kind: 'transit', axis: null, title: 'Taxi', startTime: null, endTime: null, costCents: 0, notes: null, reason: null, forUserId: null, position: 0 },
        { id: 'b', kind: 'activity', axis: 'nature', title: 'Rizières de Tegallalang', startTime: '09:30', endTime: null, costCents: 0, notes: null, reason: null, forUserId: null, position: 1 },
      ],
    },
  ];

  it('dit le jour, ce qui est réservé et prévu, et mène au programme du jour', () => {
    afficher('2026-07-12T08:00:00Z', {
      reservations: [hotel('h1', '2026-07-10', '2026-07-12'), hotel('h2', '2026-07-12', '2026-07-17', 'Hôtel Seminyak')],
      itineraire: programme,
    });
    expect(screen.getByRole('heading', { name: 'Jour 3 sur 8' })).toBeInTheDocument();
    expect(screen.getByText('Arrivée à Hôtel Seminyak, 15 h')).toBeInTheDocument();
    expect(screen.getByText('9 h 30 · Rizières de Tegallalang')).toBeInTheDocument();
    // Le trajet en taxi n'est pas une activité : il reste dans le programme.
    expect(screen.queryByText(/Taxi/u)).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Programme du jour' })).toHaveAttribute(
      'href',
      '/voyages/v1/itineraire?jour=3',
    );
    expect(screen.getByRole('link', { name: /Une dépense/u })).toHaveAttribute(
      'href',
      '/voyages/v1/budget?ajouter=1',
    );
  });

  it('prévient quand personne ne sait où dormir ce soir', () => {
    afficher('2026-07-12T08:00:00Z', { reservations: [hotel('h1', '2026-07-10', '2026-07-12')] });
    expect(screen.getByText(/Aucun hébergement réservé pour ce soir\./u)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'L’ajouter' })).toHaveAttribute('href', '/voyages/v1/reservations');
  });

  it('compte en jours du lieu, pas de l’appareil', () => {
    // 23 h à Paris le 9 : déjà le 10 à Bali, premier jour du séjour.
    afficher('2026-07-09T21:00:00Z', { fuseau: 'Asia/Makassar' });
    expect(screen.getByRole('heading', { name: 'Jour 1 sur 8' })).toBeInTheDocument();
  });
});

describe('après le retour', () => {
  it('rappelle les comptes pendant un mois, puis s’efface', () => {
    const { unmount } = afficher('2026-07-20T10:00:00Z');
    expect(screen.getByRole('heading', { name: 'De retour depuis 3 jours' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Qui doit quoi' })).toHaveAttribute('href', '/voyages/v1/budget');
    unmount();

    afficher('2026-09-20T10:00:00Z');
    expect(screen.queryByRole('heading')).not.toBeInTheDocument();
  });
});

it('ne dit rien sans dates arrêtées', () => {
  afficher('2026-07-12T08:00:00Z', { debut: null, fin: null });
  expect(screen.queryByRole('heading')).not.toBeInTheDocument();
});
