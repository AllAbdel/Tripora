import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { AuthContext, type AuthContextValue } from '@/lib/auth-context';
import { authFactice } from '@/test/authFactice';
import { GarderMesVoyages } from './GarderMesVoyages';

function afficher(modifications: Partial<AuthContextValue> = {}, etat?: unknown) {
  const auth = authFactice({
    identity: { id: 'invite', displayName: 'Inès', isAnonymous: true, mode: 'supabase', fournisseur: 'invite' },
    ...modifications,
  });
  render(
    <MemoryRouter initialEntries={[{ pathname: '/profil', state: etat }]}>
      <AuthContext.Provider value={auth}>
        <GarderMesVoyages />
      </AuthContext.Provider>
    </MemoryRouter>,
  );
  return auth;
}

describe('garder ses voyages d’invité', () => {
  it('rattache Google au même compte', async () => {
    const auth = afficher();
    await userEvent.click(screen.getByRole('button', { name: 'Rattacher mon compte Google' }));
    expect(auth.rattacherGoogle).toHaveBeenCalledOnce();
  });

  it('rattache une adresse e-mail, puis vérifie le code', async () => {
    const auth = afficher();
    // Pas de prénom à demander : le groupe connaît déjà l'invité sous son nom.
    expect(screen.queryByLabelText(/votre prénom/i)).not.toBeInTheDocument();
    await userEvent.type(screen.getByLabelText(/adresse e-mail/i), 'ines@exemple.fr');
    await userEvent.click(screen.getByRole('button', { name: /recevoir un code/i }));
    expect(auth.rattacherEmail).toHaveBeenCalledWith('ines@exemple.fr');
    await userEvent.type(await screen.findByLabelText(/le code reçu/i), '654321');
    expect(auth.confirmerRattachementEmail).toHaveBeenCalledWith('ines@exemple.fr', '654321');
  });

  it('dit franchement qu’une adresse déjà utilisée ne se fusionne pas', async () => {
    afficher({
      rattacherEmail: vi.fn().mockRejectedValue(new Error('A user with this email address has already been registered')),
    });
    await userEvent.type(screen.getByLabelText(/adresse e-mail/i), 'deja@exemple.fr');
    await userEvent.click(screen.getByRole('button', { name: /recevoir un code/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/ne peuvent pas être réunis/);
  });

  it('propose l’e-mail seul quand Google ne peut pas être rattaché d’ici', () => {
    afficher({ rattachementGooglePossible: false });
    expect(screen.queryByRole('button', { name: /google/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /recevoir un code/i })).toBeInTheDocument();
  });

  it('affiche le refus rapporté par l’application mobile', () => {
    afficher({}, { erreurDeConnexion: 'Identity is already linked to another user' });
    expect(screen.getByRole('alert')).toHaveTextContent(/Ce compte Google a déjà un compte Tripora/);
  });
});
