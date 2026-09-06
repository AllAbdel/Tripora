import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import SignIn from './SignIn';
import { AuthContext, type AuthContextValue } from '@/lib/auth-context';

function renderSignIn(overrides: Partial<AuthContextValue> = {}) {
  const value: AuthContextValue = {
    identity: null,
    loading: false,
    backendReady: true,
    signInWithGoogle: vi.fn().mockResolvedValue(undefined),
    continueAsGuest: vi.fn().mockResolvedValue(undefined),
    signOut: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
  render(
    <MemoryRouter>
      <AuthContext.Provider value={value}>
        <SignIn />
      </AuthContext.Provider>
    </MemoryRouter>,
  );
  return value;
}

describe('écran de connexion', () => {
  it('propose Google quand un serveur est configuré', () => {
    renderSignIn();
    expect(screen.getByRole('button', { name: /google/i })).toBeInTheDocument();
    expect(screen.queryByText(/mode local/i)).not.toBeInTheDocument();
  });

  it('bascule en mode local et le dit, plutôt que d’échouer', () => {
    renderSignIn({ backendReady: false });
    expect(screen.getByText(/aucun serveur n’est encore configuré/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /google/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /mode local/i })).toBeInTheDocument();
  });

  it('ouvre une session invité au clic', async () => {
    const value = renderSignIn({ backendReady: false });
    await userEvent.click(screen.getByRole('button', { name: /mode local/i }));
    expect(value.continueAsGuest).toHaveBeenCalledOnce();
  });

  it('affiche un message lisible si la connexion échoue', async () => {
    renderSignIn({
      backendReady: true,
      signInWithGoogle: vi.fn().mockRejectedValue(new Error('Fournisseur indisponible')),
    });
    await userEvent.click(screen.getByRole('button', { name: /google/i }));
    expect(await screen.findByText(/fournisseur indisponible/i)).toBeInTheDocument();
  });

  it('rappelle qu’aucune donnée personnelle ne part vers une IA', () => {
    renderSignIn();
    expect(screen.getByText(/jamais transmis à un service d’intelligence artificielle/i)).toBeInTheDocument();
  });
});
