import { createContext, useContext } from 'react';

/**
 * Identité de la personne qui utilise l'application.
 *
 * Quatre façons d'entrer, dans cet ordre de simplicité :
 *   1. Google — un bouton, rien à retenir, gratuit et illimité ;
 *   2. une adresse e-mail — pour qui n'a pas de compte Google ou n'en veut
 *      pas ici : on reçoit un code à six chiffres, on le recopie ;
 *   3. compte invité — pour rejoindre un voyage par lien sans rien créer,
 *      rattachable à Google plus tard sans perdre ses données ;
 *   4. mode local — tant qu'aucun serveur n'est configuré, pour que
 *      l'application reste explorable.
 *
 * Aucun mot de passe nulle part : c'est la principale source de friction et de
 * fuite, pour un bénéfice nul à cette échelle. Le code reçu par e-mail en
 * tient lieu, et il ne sert qu'une fois.
 */
export type AuthMode = 'supabase' | 'local';

/** Par où la personne est entrée : c'est ce que le profil affiche. */
export type Fournisseur = 'google' | 'email' | 'invite' | 'local';

export interface Identity {
  id: string;
  displayName: string;
  avatarUrl?: string;
  isAnonymous: boolean;
  mode: AuthMode;
  fournisseur: Fournisseur;
}

/** Première visite ou retour : la même adresse, deux intentions. */
export interface DemandeDeCode {
  email: string;
  /** `true` : créer le compte s'il n'existe pas. `false` : refuser. */
  creer: boolean;
  /** Le prénom montré aux covoyageurs, retenu seulement à la création. */
  prenom?: string;
}

export interface AuthContextValue {
  identity: Identity | null;
  loading: boolean;
  /** `false` tant que VITE_SUPABASE_URL / ANON_KEY ne sont pas renseignés. */
  backendReady: boolean;
  signInWithGoogle: () => Promise<void>;
  /** Envoie un code à six chiffres à cette adresse. */
  envoyerUnCode: (demande: DemandeDeCode) => Promise<void>;
  /** Ouvre la session si le code est le bon. */
  verifierLeCode: (email: string, code: string) => Promise<void>;
  continueAsGuest: () => Promise<void>;
  signOut: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth doit être utilisé dans un AuthProvider');
  return context;
}
