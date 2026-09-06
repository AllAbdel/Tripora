import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { CollaborationApi, TripMember } from '@/lib/collaboration';
import { AuthContext, type AuthContextValue } from '@/lib/auth-context';
import TripMembers from './TripMembers';

const collaboration = vi.hoisted(() => ({ current: null as CollaborationApi | null }));
vi.mock('@/lib/collaboration', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/collaboration')>()),
  getCollaboration: () => collaboration.current,
}));

const ABDEL = '11111111-1111-1111-1111-111111111111';

function membre(overrides: Partial<TripMember> & { userId: string }): TripMember {
  return {
    displayName: 'Voyageur',
    avatarUrl: null,
    role: 'member',
    joinedAt: '2026-09-06T08:00:00Z',
    hasPreferences: true,
    budgetMaxCents: 40_000,
    topAxes: [],
    ...overrides,
  };
}

function fauxApi(overrides: Partial<CollaborationApi> = {}): CollaborationApi {
  return {
    listMembers: vi.fn().mockResolvedValue([]),
    currentInvite: vi.fn().mockResolvedValue(null),
    createInvite: vi.fn().mockResolvedValue({
      code: 'ABCD2345',
      url: 'https://tripora.test/rejoindre/ABCD2345',
      expiresAt: '2026-10-06T08:00:00Z',
      remainingUses: 20,
    }),
    revokeInvite: vi.fn().mockResolvedValue(undefined),
    joinWithCode: vi.fn(),
    myPreferences: vi.fn().mockResolvedValue(null),
    savePreferences: vi.fn().mockResolvedValue(undefined),
    watchGroup: vi.fn().mockReturnValue(() => {}),
    ...overrides,
  };
}

function afficher() {
  const identity: AuthContextValue = {
    identity: { id: ABDEL, displayName: 'Abdel', isAnonymous: false, mode: 'supabase' },
    loading: false,
    backendReady: true,
    signInWithGoogle: vi.fn(),
    continueAsGuest: vi.fn(),
    signOut: vi.fn(),
  };
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <AuthContext.Provider value={identity}>
        <MemoryRouter initialEntries={['/voyages/v1/participants']}>
          <Routes>
            <Route path="/voyages/:id/participants" element={<TripMembers />} />
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  collaboration.current = fauxApi();
});

describe('écran Participants', () => {
  it('signale qui n’a pas encore donné ses envies', async () => {
    collaboration.current = fauxApi({
      listMembers: vi.fn().mockResolvedValue([
        membre({ userId: ABDEL, displayName: 'Abdel', role: 'owner' }),
        membre({ userId: 'u2', displayName: 'Thomas', hasPreferences: false }),
        membre({ userId: 'u3', displayName: 'Mehdi', hasPreferences: false }),
      ]),
    });
    afficher();

    expect(await screen.findByText('Thomas')).toBeInTheDocument();
    expect(screen.getByText(/2 personnes n’ont pas répondu/i)).toBeInTheDocument();
    expect(screen.getAllByText(/en attente de ses envies/i)).toHaveLength(2);
  });

  it('marque l’organisateur et distingue la personne connectée', async () => {
    collaboration.current = fauxApi({
      listMembers: vi
        .fn()
        .mockResolvedValue([membre({ userId: ABDEL, displayName: 'Abdel', role: 'owner' })]),
    });
    afficher();

    expect(await screen.findByText('organisateur')).toBeInTheDocument();
    expect(screen.getByText('(vous)')).toBeInTheDocument();
    // Chacun ne peut modifier que ses propres envies.
    expect(screen.getByRole('link', { name: /modifier/i })).toBeInTheDocument();
  });

  it('crée un lien d’invitation et affiche le code en clair', async () => {
    afficher();

    await userEvent.click(await screen.findByRole('button', { name: /créer un lien/i }));

    expect(await screen.findByText('ABCD2345')).toBeInTheDocument();
    expect(screen.getByText(/tripora.test\/rejoindre\/ABCD2345/)).toBeInTheDocument();
    expect(screen.getByText(/20 utilisations restantes/i)).toBeInTheDocument();
  });

  it('affiche le QR code seulement à la demande', async () => {
    collaboration.current = fauxApi({
      currentInvite: vi.fn().mockResolvedValue({
        code: 'ABCD2345',
        url: 'https://tripora.test/rejoindre/ABCD2345',
        expiresAt: '2026-10-06T08:00:00Z',
        remainingUses: 20,
      }),
    });
    afficher();

    expect(await screen.findByText('ABCD2345')).toBeInTheDocument();
    expect(screen.queryByRole('img', { name: /qr code/i })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /qr code/i }));
    await waitFor(() =>
      expect(screen.getByRole('img', { name: /qr code/i })).toBeInTheDocument(),
    );
  });

  it('explique honnêtement pourquoi le partage n’existe pas en mode local', async () => {
    collaboration.current = null;
    afficher();

    expect(await screen.findByText(/pas de partage en mode local/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /créer un lien/i })).not.toBeInTheDocument();
  });
});
