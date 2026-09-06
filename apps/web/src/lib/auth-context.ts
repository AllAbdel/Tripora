import { createContext, useContext } from 'react';

/**
 * Identité de la personne qui utilise l'application.
 *
 * Trois façons d'entrer, dans cet ordre de simplicité :
 *   1. Google — un bouton, rien à retenir, gratuit et illimité ;
 *   2. compte invité — pour rejoindre un voyage par lien sans rien créer,
 *      rattachable à Google plus tard sans perdre ses données ;
 *   3. mode local — tant qu'aucun serveur n'est configuré, pour que
 *      l'application reste explorable.
 *
 * Aucun mot de passe nulle part : c'est la principale source de friction et de
 * fuite, pour un bénéfice nul à cette échelle.
 */
export type AuthMode = 'supabase' | 'local';

export interface Identity {
  id: string;
  displayName: string;
  avatarUrl?: string;
  isAnonymous: boolean;
  mode: AuthMode;
}

export interface AuthContextValue {
  identity: Identity | null;
  loading: boolean;
  /** `false` tant que VITE_SUPABASE_URL / ANON_KEY ne sont pas renseignés. */
  backendReady: boolean;
  signInWithGoogle: () => Promise<void>;
  continueAsGuest: () => Promise<void>;
  signOut: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth doit être utilisé dans un AuthProvider');
  return context;
}
