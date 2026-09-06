import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import type { CollaborationApi } from '@/lib/collaboration';
import { AuthContext, type AuthContextValue, type Identity } from '@/lib/auth-context';
import JoinTrip from './JoinTrip';

const collaboration = vi.hoisted(() => ({ current: null as CollaborationApi | null }));
vi.mock('@/lib/collaboration', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/collaboration')>()),
  getCollaboration: () => collaboration.current,
}));

function fauxApi(joinWithCode: CollaborationApi['joinWithCode']): CollaborationApi {
  return {
    listMembers: vi.fn(),
    currentInvite: vi.fn(),
    createInvite: vi.fn(),
    revokeInvite: vi.fn(),
    joinWithCode,
    myPreferences: vi.fn(),
    savePreferences: vi.fn(),
    watchGroup: vi.fn().mockReturnValue(() => {}),
  };
}

const CONNECTE: Identity = {
  id: 'u1',
  displayName: 'Thomas',
  isAnonymous: true,
  mode: 'supabase',
};

function afficher({
  identity = CONNECTE,
  backendReady = true,
  route = '/rejoindre',
  continueAsGuest = vi.fn().mockResolvedValue(undefined),
}: {
  identity?: Identity | null;
  backendReady?: boolean;
  route?: string;
  continueAsGuest?: AuthContextValue['continueAsGuest'];
} = {}) {
  const auth: AuthContextValue = {
    identity,
    loading: false,
    backendReady,
    signInWithGoogle: vi.fn(),
    continueAsGuest,
    signOut: vi.fn(),
  };
  render(
    <AuthContext.Provider value={auth}>
      <MemoryRouter initialEntries={[route]}>
        <Routes>
          <Route path="/rejoindre" element={<JoinTrip />} />
          <Route path="/rejoindre/:code" element={<JoinTrip />} />
          <Route path="/voyages/:id/mes-envies" element={<p>Vos envies</p>} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  );
  return { continueAsGuest };
}

beforeEach(() => {
  collaboration.current = fauxApi(vi.fn());
});

describe('rejoindre un voyage', () => {
  it('n’active le bouton qu’avec un code complet', async () => {
    afficher();
    const bouton = screen.getByRole('button', { name: /rejoindre/i });
    expect(bouton).toBeDisabled();

    await userEvent.type(screen.getByLabelText(/code du voyage/i), 'abcd2345');
    // La saisie est normalisée : un code se dicte en majuscules.
    expect(screen.getByLabelText(/code du voyage/i)).toHaveValue('ABCD2345');
    expect(bouton).toBeEnabled();
  });

  it('rejoint puis emmène directement remplir ses envies', async () => {
    collaboration.current = fauxApi(
      vi.fn().mockResolvedValue({ tripId: 'v9', title: 'Escapade' }),
    );
    afficher();

    await userEvent.type(screen.getByLabelText(/code du voyage/i), 'ABCD2345');
    await userEvent.click(screen.getByRole('button', { name: /rejoindre/i }));

    expect(await screen.findByText('Vos envies')).toBeInTheDocument();
  });

  it('ouvre une session invité pour quelqu’un qui arrive sans compte', async () => {
    collaboration.current = fauxApi(
      vi.fn().mockResolvedValue({ tripId: 'v9', title: 'Escapade' }),
    );
    const { continueAsGuest } = afficher({ identity: null });

    await userEvent.type(screen.getByLabelText(/code du voyage/i), 'ABCD2345');
    await userEvent.click(screen.getByRole('button', { name: /rejoindre/i }));

    expect(continueAsGuest).toHaveBeenCalledOnce();
  });

  it('traduit chaque refus du serveur en phrase utile', async () => {
    const cas = [
      { code: 'P0002', attendu: /n’existe pas/i },
      { code: 'P0003', attendu: /expiré/i },
      { code: 'P0004', attendu: /maximum de fois/i },
    ];

    for (const { code, attendu } of cas) {
      collaboration.current = fauxApi(vi.fn().mockRejectedValue({ code }));
      afficher();
      await userEvent.type(screen.getByLabelText(/code du voyage/i), 'ABCD2345');
      await userEvent.click(screen.getByRole('button', { name: /rejoindre/i }));
      expect(await screen.findByText(attendu)).toBeInTheDocument();
      cleanup();
    }
  });

  it('le dit franchement quand aucun serveur n’est relié', () => {
    afficher({ backendReady: false });
    expect(screen.getByText(/rejoindre un voyage demande un serveur/i)).toBeInTheDocument();
  });
});
