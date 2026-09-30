import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthContext, type AuthContextValue, type Identity } from '@/lib/auth-context';
import { authFactice } from '@/test/authFactice';
import { useTripDraft } from '@/stores/tripDraft';
import CreateTrip from './CreateTrip';

const creer = vi.hoisted(() => vi.fn());
vi.mock('@/lib/trips', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/trips')>()),
  getTripRepository: () => ({ create: creer }),
}));

const INVITE: Identity = {
  id: 'invite-1',
  displayName: 'Voyageur',
  isAnonymous: true,
  mode: 'supabase',
  fournisseur: 'invite',
};

/** Un brouillon dont les six réponses sont données. */
function brouillonComplet() {
  useTripDraft.setState({
    participants: 5,
    origin: { name: 'Lyon', lat: 45.76, lng: 4.84, iata: ['LYS'] },
    destinationMode: 'suggest',
    destinationIds: [],
    dateMode: 'month',
    month: 7,
    durationDays: 4,
    budgetMode: 'max_per_person',
    budgetPerPersonCents: 60_000,
    weights: { food: 1, nightlife: 0.66 },
  });
}

function arbre(auth: AuthContextValue, client: QueryClient, adresse: string) {
  return (
    <QueryClientProvider client={client}>
      <AuthContext.Provider value={auth}>
        <MemoryRouter initialEntries={[adresse]}>
          <Routes>
            <Route path="/voyages/nouveau" element={<CreateTrip />} />
            <Route path="/voyages/:id" element={<p>Écran du voyage</p>} />
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>
    </QueryClientProvider>
  );
}

describe('créer un trip sans compte', () => {
  beforeEach(() => {
    creer.mockReset().mockResolvedValue('v42');
    useTripDraft.getState().reset();
    brouillonComplet();
  });

  it('ne demande le compte qu’à la toute fin, trip récapitulé sous les yeux', async () => {
    const client = new QueryClient();
    const sansCompte = authFactice();
    render(arbre(sansCompte, client, '/voyages/nouveau?enregistrer=1'));

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Votre trip est prêt');
    // Ses réponses reprises noir sur blanc : c'est ce qu'on perdrait.
    expect(screen.getByText('5 personnes')).toBeInTheDocument();
    expect(screen.getByText('Lyon')).toBeInTheDocument();
    expect(screen.getByText('4 jours en juillet')).toBeInTheDocument();
    expect(screen.getByText('600 € par personne')).toBeInTheDocument();

    expect(screen.getByRole('button', { name: 'Enregistrer avec Google' })).toBeInTheDocument();
    expect(screen.getByLabelText(/adresse e-mail/i)).toBeInTheDocument();
    expect(creer).not.toHaveBeenCalled();
  });

  it('« Plus tard » ouvre un compte invité, et le trip s’enregistre tout seul', async () => {
    const client = new QueryClient();
    const sansCompte = authFactice();
    const { rerender } = render(arbre(sansCompte, client, '/voyages/nouveau?enregistrer=1'));

    await userEvent.click(screen.getByRole('button', { name: /Plus tard/ }));
    expect(sansCompte.continueAsGuest).toHaveBeenCalledOnce();

    // La session s'ouvre : personne n'a à recliquer « Créer ».
    rerender(arbre(authFactice({ identity: INVITE }), client, '/voyages/nouveau?enregistrer=1'));
    expect(await screen.findByText('Écran du voyage')).toBeInTheDocument();
    expect(creer).toHaveBeenCalledOnce();
    expect(creer.mock.calls[0]![1]).toBe('4 jours en juillet');
  });

  it('le code e-mail validé enregistre le trip de la même façon', async () => {
    const client = new QueryClient();
    const sansCompte = authFactice();
    const { rerender } = render(arbre(sansCompte, client, '/voyages/nouveau?enregistrer=1'));

    await userEvent.type(screen.getByLabelText(/votre prénom/i), 'Inès');
    await userEvent.type(screen.getByLabelText(/adresse e-mail/i), 'ines@exemple.fr');
    await userEvent.click(screen.getByRole('button', { name: /recevoir un code/i }));
    // On crée le compte à cette occasion — ou on retrouve le sien.
    expect(sansCompte.envoyerUnCode).toHaveBeenCalledWith({
      email: 'ines@exemple.fr',
      creer: true,
      prenom: 'Inès',
    });
    await userEvent.type(await screen.findByLabelText(/le code reçu/i), '123456');
    expect(sansCompte.verifierLeCode).toHaveBeenCalledWith('ines@exemple.fr', '123456');

    rerender(
      arbre(
        authFactice({ identity: { ...INVITE, isAnonymous: false, fournisseur: 'email' } }),
        client,
        '/voyages/nouveau?enregistrer=1',
      ),
    );
    await waitFor(() => expect(creer).toHaveBeenCalledOnce());
  });

  it('connecté, le trip se crée directement, sans étape de compte', async () => {
    const client = new QueryClient();
    render(arbre(authFactice({ identity: INVITE }), client, '/voyages/nouveau'));
    // Première étape, comme toujours.
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Avec qui partez-vous ?');
    expect(screen.queryByText('Votre trip est prêt')).not.toBeInTheDocument();
  });
});
