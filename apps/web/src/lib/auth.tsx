import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { isSupabaseConfigured } from './env';

/**
 * Identité de la personne qui utilise l'application.
 *
 * Trois façons d'entrer, dans cet ordre de simplicité :
 *   1. Google — un bouton, rien à retenir, gratuit et illimité ;
 *   2. compte anonyme — pour rejoindre un voyage par lien sans rien créer,
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

interface AuthContextValue {
  identity: Identity | null;
  loading: boolean;
  /** `false` tant que VITE_SUPABASE_URL / ANON_KEY ne sont pas renseignés. */
  backendReady: boolean;
  signInWithGoogle: () => Promise<void>;
  continueAsGuest: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const LOCAL_KEY = 'tripora.local-identity';

function readLocalIdentity(): Identity | null {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    return raw ? (JSON.parse(raw) as Identity) : null;
  } catch {
    return null;
  }
}

function fromSession(session: Session | null): Identity | null {
  const user: User | undefined = session?.user;
  if (!user) return null;
  const meta = user.user_metadata ?? {};
  return {
    id: user.id,
    displayName:
      (meta['full_name'] as string) ??
      (meta['name'] as string) ??
      user.email?.split('@')[0] ??
      'Voyageur',
    avatarUrl: meta['avatar_url'] as string | undefined,
    isAnonymous: user.is_anonymous ?? false,
    mode: 'supabase',
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supabase) {
      setIdentity(readLocalIdentity());
      setLoading(false);
      return;
    }

    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setIdentity(fromSession(data.session));
      setLoading(false);
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      setIdentity(fromSession(session));
    });

    return () => {
      active = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  const signInWithGoogle = useCallback(async () => {
    if (!supabase) throw new Error('Aucun serveur configuré');
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/voyages` },
    });
    if (error) throw error;
  }, []);

  const continueAsGuest = useCallback(async () => {
    if (supabase) {
      const { error } = await supabase.auth.signInAnonymously();
      if (error) throw error;
      return;
    }
    // Sans serveur : identité purement locale, jamais transmise à personne.
    const local: Identity = {
      id: crypto.randomUUID(),
      displayName: 'Voyageur',
      isAnonymous: true,
      mode: 'local',
    };
    localStorage.setItem(LOCAL_KEY, JSON.stringify(local));
    setIdentity(local);
  }, []);

  const signOut = useCallback(async () => {
    localStorage.removeItem(LOCAL_KEY);
    if (supabase) await supabase.auth.signOut();
    setIdentity(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      identity,
      loading,
      backendReady: isSupabaseConfigured,
      signInWithGoogle,
      continueAsGuest,
      signOut,
    }),
    [identity, loading, signInWithGoogle, continueAsGuest, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth doit être utilisé dans un AuthProvider');
  return context;
}
