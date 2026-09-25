import { vi } from 'vitest';
import type { AuthContextValue } from '@/lib/auth-context';

/**
 * Un contexte d'authentification pour les tests d'écran : personne n'est
 * connecté, le serveur est là, et chaque action réussit sans rien faire.
 *
 * Un seul endroit pour la liste des actions : chaque test d'écran recopiait
 * la sienne, et chaque action ajoutée au contexte cassait trois fichiers.
 */
export function authFactice(modifications: Partial<AuthContextValue> = {}): AuthContextValue {
  return {
    identity: null,
    loading: false,
    backendReady: true,
    signInWithGoogle: vi.fn().mockResolvedValue(undefined),
    envoyerUnCode: vi.fn().mockResolvedValue(undefined),
    verifierLeCode: vi.fn().mockResolvedValue(undefined),
    continueAsGuest: vi.fn().mockResolvedValue(undefined),
    rattacherGoogle: vi.fn().mockResolvedValue(undefined),
    rattacherEmail: vi.fn().mockResolvedValue(undefined),
    confirmerRattachementEmail: vi.fn().mockResolvedValue(undefined),
    rattachementGooglePossible: true,
    signOut: vi.fn().mockResolvedValue(undefined),
    ...modifications,
  };
}
