import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { isSupabaseConfigured } from './env';
import { AuthContext, type AuthContextValue, type Identity } from './auth-context';

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
  // Sans serveur, l'identité locale est lisible immédiatement : pas d'écran de
  // chargement inutile, et pas de setState synchrone dans un effet.
  const [identity, setIdentity] = useState<Identity | null>(() =>
    supabase ? null : readLocalIdentity(),
  );
  const [loading, setLoading] = useState(() => Boolean(supabase));

  useEffect(() => {
    if (!supabase) return;

    let active = true;
    void supabase.auth.getSession().then(({ data }) => {
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
