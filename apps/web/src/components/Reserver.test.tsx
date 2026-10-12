import type { ReactElement } from 'react';
import { render as rendre, screen, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import { findDestination, type TripConstraints } from '@tripora/core';

vi.mock('@/lib/env', () => ({
  env: { travelpayouts: { marker: '774322', projet: '570857' } },
}));

// Le vol le moins cher relevé vers Lisbonne part de Beauvais.
vi.mock('@/lib/flightPrices', () => ({
  moisCible: () => '2027-05',
  chargerPrixVols: async () => ({
    parDestination: {
      lisbonne: { cents: 8_900, source: 'observed', provider: 'Aviasales', fetchedAt: '2027-04-01', from: 'BVA' },
    },
    configured: true,
    quotaExceeded: false,
  }),
}));

const { Reserver } = await import('./Reserver');

function render(element: ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return rendre(<QueryClientProvider client={client}>{element}</QueryClientProvider>);
}

const CONTRAINTES: TripConstraints = {
  participants: 4,
  origin: { name: 'Paris', lat: 48.8566, lng: 2.3522, iata: ['PAR'] },
  durationDays: 5,
  dateMode: 'exact',
  startDate: '2027-05-10',
  endDate: '2027-05-15',
  budgetMode: 'max_per_person',
  budgetPerPersonCents: 80_000,
  comfortLevel: 'mid',
  groupType: 'friends',
};

describe('l’écran Réserver', () => {
  it('propose ce qui sert sur place, en liens partenaires déclarés', () => {
    render(<Reserver constraints={CONTRAINTES} destination={findDestination('lisbonne')!} />);
    for (const titre of [
      'Internet sur place (eSIM)',
      'Depuis l’aéroport',
      'Louer une voiture',
      'Louer un scooter ou un vélo',
      'Laisser ses bagages',
    ]) {
      expect(screen.getByRole('heading', { name: titre })).toBeInTheDocument();
    }
    const airalo = screen.getByRole('link', { name: /^Airalo/u });
    expect(airalo).toHaveAttribute('rel', 'noopener noreferrer sponsored');
    expect(airalo.getAttribute('href')).toMatch(/^https:\/\/tp\.media\/r\?/u);
    expect(screen.getAllByText('Liens partenaires.').length).toBeGreaterThan(0);
  });

  it('range chaque rubrique par ordre alphabétique', () => {
    render(<Reserver constraints={CONTRAINTES} destination={findDestination('lisbonne')!} />);
    const rubrique = screen.getByRole('heading', { name: 'Louer une voiture' }).parentElement!;
    const noms = within(rubrique)
      .getAllByRole('link')
      .map((lien) => lien.textContent?.split(' ')[0] ?? '');
    expect(noms).toEqual([...noms].sort((a, b) => a.localeCompare(b, 'fr')));
  });
  it('cherche le vol depuis l’aéroport le moins cher, et le dit', async () => {
    render(<Reserver constraints={CONTRAINTES} destination={findDestination('lisbonne')!} />);
    expect(
      await screen.findByText('Le vol le moins cher relevé part de Paris-Beauvais : la recherche de vol part de là.'),
    ).toBeInTheDocument();
    const aviasales = screen.getByRole('link', { name: /^Aviasales/u });
    expect(decodeURIComponent(aviasales.getAttribute('href') ?? '')).toContain('origin_iata=BVA');
  });
});
