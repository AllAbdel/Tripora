import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { TripConstraints } from '@tripora/core';
import { SuivreLePrix } from './SuivreLePrix';

const lister = vi.hoisted(() => vi.fn());
const suivre = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));

vi.mock('@/lib/auth-context', () => ({
  useAuth: () => ({ identity: { id: 'moi', mode: 'supabase', isAnonymous: false } }),
}));
vi.mock('@/lib/alertesDePrix', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/alertesDePrix')>()),
  alertesPossibles: true,
  requeteDesSuivis: (actif: boolean) => ({ queryKey: ['suivis-de-prix'], queryFn: lister, enabled: actif }),
  suivreLePrix: suivre,
}));

const constraints: TripConstraints = {
  participants: 4,
  origin: { name: 'Paris', lat: 48.8566, lng: 2.3522, iata: ['PAR'] },
  durationDays: 5,
  dateMode: 'exact',
  startDate: '2099-06-10',
  endDate: '2099-06-15',
  budgetMode: 'cheapest',
  budgetPerPersonCents: null,
  comfortLevel: 'budget',
  groupType: 'friends',
};

function afficher() {
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter>
        <SuivreLePrix
          tripId="v1"
          constraints={constraints}
          destination={{ id: 'lisbonne', name: 'Lisbonne', iata: ['LIS'] }}
        />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('suivre le prix d’un vol', () => {
  beforeEach(() => {
    lister.mockReset();
    suivre.mockClear();
  });

  it('propose de suivre le trajet du voyage, puis le suit', async () => {
    lister.mockResolvedValue([]);
    afficher();

    const bouton = await screen.findByRole('button', { name: /Suivre le prix du vol/ });
    expect(screen.getByText(/PAR → Lisbonne en juin 2099/)).toBeInTheDocument();

    await userEvent.click(bouton);
    expect(suivre).toHaveBeenCalledWith(
      expect.objectContaining({ origine: 'PAR', destinationId: 'lisbonne', destinationIata: ['LIS'], mois: '2099-06' }),
      'moi',
    );
  });

  it('montre où en est le prix quand le trajet est déjà suivi', async () => {
    lister.mockResolvedValue([
      {
        id: 's1',
        tripId: 'autre',
        origine: 'PAR',
        destinationId: 'lisbonne',
        destinationNom: 'Lisbonne',
        mois: '2099-06',
        premierCents: 18_000,
        dernierCents: 15_900,
        plusBasCents: 15_900,
        releveLe: '2099-01-01T06:41:00Z',
      },
    ]);
    afficher();

    expect(await screen.findByText(/Prix suivi, PAR → Lisbonne en juin 2099/)).toBeInTheDocument();
    expect(screen.getByText(/21\s€ de moins qu’au début du suivi/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Mes alertes de prix' })).toHaveAttribute('href', '/alertes');
    expect(screen.queryByRole('button', { name: /Suivre le prix du vol/ })).not.toBeInTheDocument();
  });
});
