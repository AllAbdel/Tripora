import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import AlertesDePrix from './AlertesDePrix';

const marquer = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));

vi.mock('@/lib/alertesDePrix', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/alertesDePrix')>()),
  alertesPossibles: true,
  requeteDesAlertes: () => ({
    queryKey: ['alertes-de-prix'],
    queryFn: async () => [
      {
        id: 'a1',
        ancienCents: 18_000,
        nouveauCents: 15_900,
        creeLe: '2026-09-30T06:41:00Z',
        vueLe: null,
        destinationNom: 'Lisbonne',
        mois: '2027-06',
        origine: 'PAR',
        tripId: 'v1',
      },
    ],
  }),
  requeteDesSuivis: () => ({
    queryKey: ['suivis-de-prix'],
    queryFn: async () => [
      {
        id: 's1',
        tripId: 'v1',
        origine: 'PAR',
        destinationId: 'lisbonne',
        destinationNom: 'Lisbonne',
        mois: '2027-06',
        premierCents: 18_000,
        dernierCents: 15_900,
        plusBasCents: 15_900,
        releveLe: '2026-09-30T06:41:00Z',
      },
    ],
  }),
  marquerCommeVues: marquer,
  etatDesNotifications: async () => 'impossibles',
}));

describe('l’écran des alertes de prix', () => {
  it('montre la baisse, la marque comme vue, et liste le trajet suivi', async () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter>
          <AlertesDePrix />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(await screen.findByText('Baisses récentes')).toBeInTheDocument();
    expect(screen.getByText(/au lieu de/)).toHaveTextContent(/159\s€ au lieu de 180\s€/);
    expect(screen.getByText('Nouveau')).toBeInTheDocument();
    await waitFor(() => expect(marquer).toHaveBeenCalledWith(['a1']));
    // Toujours marquée pendant la visite, même lue côté serveur.
    expect(screen.getByText('Nouveau')).toBeInTheDocument();

    expect(screen.getByText(/depuis PAR · juin 2027/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Arrêter le suivi' })).toBeInTheDocument();
    expect(screen.getByText(/Ce navigateur ne reçoit pas de notifications/)).toBeInTheDocument();
  });
});
