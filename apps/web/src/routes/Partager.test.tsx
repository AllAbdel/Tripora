import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Partager from './Partager';

const addPin = vi.hoisted(() => vi.fn().mockResolvedValue({}));
const lire = vi.hoisted(() => vi.fn());

vi.mock('@/lib/discussion', () => ({ getDiscussion: () => ({ addPin }) }));
vi.mock('@/lib/trips', () => ({
  getTripRepository: () => ({
    kind: 'supabase',
    list: vi.fn().mockResolvedValue([
      { id: 'v1', title: 'Lisbonne entre potes', destinationId: 'lisbonne', startDate: '2027-06-01', endDate: '2027-06-05' },
    ]),
  }),
}));
vi.mock('@/lib/partage', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/partage')>()),
  lireLePartage: lire,
}));

describe('partager un lien vers Tripora', () => {
  it('lit le lien reçu, propose les lieux cochés, et les épingle au voyage', async () => {
    lire.mockResolvedValue({
      source: 'tiktok',
      lien: 'https://vm.tiktok.com/ZN1/',
      titre: '3 pépites à Lisbonne',
      lieux: [
        { nom: 'Cervejaria Ramiro', lat: 38.72, lng: -9.1357, adresse: 'Avenida Almirante Reis, Lisbonne' },
        { nom: 'Taberna da Rua das Flores', lat: 38.71, lng: -9.1436, adresse: null },
        { nom: 'Un bar sans adresse', lat: null, lng: null, adresse: null },
      ],
      nonSitues: [],
      sansIA: false,
    });
    render(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter initialEntries={['/partager?texte=Regarde%20https%3A%2F%2Fvm.tiktok.com%2FZN1%2F']}>
          <Routes>
            <Route path="/partager" element={<Partager />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    // Arrivé par le menu Partager : la lecture part seule, près de Lisbonne.
    expect(await screen.findByText('Trouvé sur TikTok')).toBeInTheDocument();
    expect(lire).toHaveBeenCalledWith(
      expect.objectContaining({ lien: 'https://vm.tiktok.com/ZN1/', destination: 'Lisbonne' }),
    );
    const cases = screen.getAllByRole('checkbox');
    // Situés : cochés d'office. Le lieu sans point attend un geste.
    expect(cases.map((c) => (c as HTMLInputElement).checked)).toEqual([true, true, false]);

    await userEvent.click(screen.getByRole('button', { name: /Épingler 2 lieux/ }));
    expect(addPin).toHaveBeenCalledTimes(2);
    expect(addPin).toHaveBeenCalledWith(
      'v1',
      expect.objectContaining({
        label: 'Cervejaria Ramiro',
        url: 'https://vm.tiktok.com/ZN1/',
        note: 'Trouvé sur TikTok : « 3 pépites à Lisbonne »',
      }),
    );
    expect(await screen.findByText(/2 épingles ajoutées/)).toBeInTheDocument();
  });
});
