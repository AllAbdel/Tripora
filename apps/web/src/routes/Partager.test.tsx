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

  it('reconnaît un e-mail de confirmation, et ne part pas lire ses liens', async () => {
    lire.mockClear();
    const texte = `Booking.com
Merci, votre réservation à Ubud Tropical Villas est confirmée.
Numéro de confirmation : 4521.873.219
Arrivée
ven. 10 juil. 2026
Départ
lun. 13 juil. 2026
Gérer votre réservation : https://secure.booking.com/myreservations.html?bn=4521873219`;
    render(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter initialEntries={[`/partager?${new URLSearchParams({ texte })}`]}>
          <Routes>
            <Route path="/partager" element={<Partager />} />
            <Route path="/voyages/:id/reservations" element={<p>Fiche de réservation</p>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(await screen.findByRole('heading', { name: 'Une réservation à ranger' })).toBeInTheDocument();
    expect(screen.getByText('4521.873.219')).toBeInTheDocument();
    await userEvent.click(await screen.findByRole('button', { name: 'Ranger dans « Lisbonne entre potes »' }));
    expect(await screen.findByText('Fiche de réservation')).toBeInTheDocument();
    expect(sessionStorage.getItem('tripora.confirmation-partagee')).toContain('Ubud Tropical Villas');
    // Un e-mail n'est pas un lien à épingler : rien n'est parti au serveur.
    expect(lire).not.toHaveBeenCalled();
  });
});
