import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import Connexion from './Connexion';
import { AuthContext, type AuthContextValue } from '@/lib/auth-context';

function afficher(modifications: Partial<AuthContextValue> = {}, etat?: unknown) {
  const valeur: AuthContextValue = {
    identity: null,
    loading: false,
    backendReady: true,
    signInWithGoogle: vi.fn().mockResolvedValue(undefined),
    envoyerUnCode: vi.fn().mockResolvedValue(undefined),
    verifierLeCode: vi.fn().mockResolvedValue(undefined),
    continueAsGuest: vi.fn().mockResolvedValue(undefined),
    signOut: vi.fn().mockResolvedValue(undefined),
    ...modifications,
  };
  render(
    <MemoryRouter initialEntries={[{ pathname: '/connexion', state: etat }]}>
      <AuthContext.Provider value={valeur}>
        <Connexion />
      </AuthContext.Provider>
    </MemoryRouter>,
  );
  return valeur;
}

describe('écran de connexion', () => {
  it('propose Google et l’e-mail quand un serveur est configuré', () => {
    afficher();
    expect(screen.getByRole('button', { name: /google/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /recevoir un code/i })).toBeInTheDocument();
    expect(screen.queryByText(/mode local/i)).not.toBeInTheDocument();
  });

  it('bascule en mode local et le dit, plutôt que d’échouer', async () => {
    const valeur = afficher({ backendReady: false });
    expect(screen.getByText(/aucun serveur n’est encore configuré/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /google/i })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /mode local/i }));
    expect(valeur.continueAsGuest).toHaveBeenCalledOnce();
  });

  it('affiche un message lisible si Google échoue', async () => {
    afficher({ signInWithGoogle: vi.fn().mockRejectedValue(new Error('Fournisseur indisponible')) });
    await userEvent.click(screen.getByRole('button', { name: /google/i }));
    expect(await screen.findByText(/fournisseur indisponible/i)).toBeInTheDocument();
  });

  it('crée un compte par e-mail : le prénom, l’adresse, puis le code', async () => {
    // Arrivé depuis « Créer un voyage » : l'onglet de l'inscription est ouvert.
    const valeur = afficher({}, { inscription: true });
    expect(screen.getByRole('tab', { name: 'Première fois' })).toHaveAttribute('aria-selected', 'true');

    await userEvent.type(screen.getByLabelText(/votre prénom/i), 'Léa');
    await userEvent.type(screen.getByLabelText(/adresse e-mail/i), ' Lea@Exemple.fr ');
    await userEvent.click(screen.getByRole('button', { name: /recevoir un code/i }));
    // Le champ e-mail retire lui-même les espaces autour ; la casse, c'est
    // l'envoi qui la range.
    expect(valeur.envoyerUnCode).toHaveBeenCalledWith({
      email: 'Lea@Exemple.fr',
      creer: true,
      prenom: 'Léa',
    });

    // Un code collé avec un espace au milieu part dès le sixième chiffre.
    expect(await screen.findByText(/lea@exemple\.fr/)).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText(/le code reçu/i), '123 456');
    expect(valeur.verifierLeCode).toHaveBeenCalledWith('lea@exemple.fr', '123456');
  });

  it('ne crée rien quand on dit avoir déjà un compte', async () => {
    const valeur = afficher({
      envoyerUnCode: vi.fn().mockRejectedValue(new Error('Signups not allowed for otp')),
    });
    expect(screen.getByRole('tab', { name: 'J’ai un compte' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.queryByLabelText(/votre prénom/i)).not.toBeInTheDocument();
    await userEvent.type(screen.getByLabelText(/adresse e-mail/i), 'inconnu@exemple.fr');
    await userEvent.click(screen.getByRole('button', { name: /recevoir un code/i }));
    expect(valeur.envoyerUnCode).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'inconnu@exemple.fr', creer: false }),
    );
    expect(await screen.findByText(/aucun compte tripora n’utilise cette adresse/i)).toBeInTheDocument();
  });

  it('refuse une adresse manifestement fausse sans rien envoyer', async () => {
    const valeur = afficher();
    await userEvent.type(screen.getByLabelText(/adresse e-mail/i), 'lea@exemple');
    await userEvent.click(screen.getByRole('button', { name: /recevoir un code/i }));
    expect(valeur.envoyerUnCode).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent(/ne semble pas valide/i);
  });

  it('dit qu’un code faux est faux, sans perdre l’adresse', async () => {
    afficher({ verifierLeCode: vi.fn().mockRejectedValue(new Error('Token has expired or is invalid')) });
    await userEvent.type(screen.getByLabelText(/adresse e-mail/i), 'lea@exemple.fr');
    await userEvent.click(screen.getByRole('button', { name: /recevoir un code/i }));
    await userEvent.type(await screen.findByLabelText(/le code reçu/i), '000000');
    expect(await screen.findByText(/code incorrect ou expiré/i)).toBeInTheDocument();
    expect(screen.getByText(/lea@exemple\.fr/)).toBeInTheDocument();
  });

  it('rappelle qu’aucun nom ne part vers une IA, et renvoie aux conditions', () => {
    afficher();
    expect(screen.getByText(/jamais transmis à\s+une intelligence artificielle/i)).toBeInTheDocument();
    const liens = screen.getAllByRole('link', { name: /conditions d’utilisation/i });
    expect(liens.map((lien) => lien.getAttribute('href'))).toContain('/conditions');
  });
});
