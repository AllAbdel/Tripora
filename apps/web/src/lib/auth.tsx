import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { isSupabaseConfigured } from './env';
import { RETOUR_OAUTH } from './oauthReturn';
import { estNatif } from './natif';
import { commencerLaConnexionGoogle } from './connexionNative';
import { oublierApresDeconnexion } from './stockage';
import { viderLeCache } from './cache';
import { AuthContext, type AuthContextValue, type Identity } from './auth-context';

const LOCAL_KEY = 'tripora.local-identity';

/**
 * Marqueur de la relance automatique, valable le temps de l'onglet.
 *
 * Il borne la reprise à un seul tour : si le second passage échoue lui aussi,
 * on s'arrête et on affiche le diagnostic, plutôt que de renvoyer quelqu'un en
 * boucle chez Google.
 */
const CLE_RELANCE = 'tripora.oauth-relance';

/**
 * L'adresse d'où la connexion doit partir, quand le projet en désigne une.
 *
 * Une même application déployée sur plusieurs domaines — Cloudflare Pages,
 * Vercel, une préversion de branche — a autant de stockages séparés, et le
 * serveur n'autorise le retour que sur les adresses qu'il connaît. Partir de
 * l'une et revenir sur l'autre rend l'échange PKCE impossible : la preuve
 * créée au départ est restée sur le premier domaine.
 *
 * Renseigner `VITE_AUTH_ORIGIN` fait partir toutes les connexions de la même
 * adresse, celle qui est autorisée, quel que soit le domaine par lequel on est
 * arrivé. Sans elle, on reste sur le comportement d'avant, et le filet de
 * rattrapage ci-dessous prend le relais.
 */
const ORIGINE_AUTH = (import.meta.env.VITE_AUTH_ORIGIN ?? '').trim().replace(/\/+$/u, '');

/** Faut-il d'abord se rendre sur l'adresse d'authentification ? */
function ailleursQuePrevu(): boolean {
  if (!ORIGINE_AUTH || typeof window === 'undefined') return false;
  try {
    return new URL(ORIGINE_AUTH).origin !== window.location.origin;
  } catch {
    return false;
  }
}

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
    const client = supabase;

    /**
     * Reprendre la connexion là où elle s'est perdue.
     *
     * On revient de Google avec un code d'autorisation, mais la preuve créée
     * au départ n'est pas dans ce stockage-ci : on est parti d'un domaine et
     * revenu sur un autre, et l'échange ne peut pas se faire. Le client
     * Supabase, lui, ne dira rien — il n'a même pas de requête à émettre.
     *
     * C'est précisément le moment où l'on recliquait à la main, et où ça
     * marchait : cette adresse-ci est forcément autorisée, puisque le serveur
     * vient de nous y envoyer. On relance donc depuis ici, une seule fois.
     * Google reconnaît la session ouverte et renvoie sans rien demander : de
     * l'extérieur, cela ressemble à un chargement un peu long.
     */
    async function reprendreLaConnexion(): Promise<boolean> {
      if (!RETOUR_OAUTH.code || RETOUR_OAUTH.verificateur || RETOUR_OAUTH.erreur) return false;
      try {
        if (sessionStorage.getItem(CLE_RELANCE)) return false;
        sessionStorage.setItem(CLE_RELANCE, '1');
      } catch {
        // Sans stockage de session, impossible de borner la reprise : on
        // s'abstient plutôt que de risquer une boucle.
        return false;
      }
      const { error } = await client.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: `${window.location.origin}/voyages` },
      });
      // Le navigateur part chez Google : on laisse l'écran en attente plutôt
      // que d'afficher un instant la page de connexion.
      return !error;
    }

    void (async () => {
      const { data } = await client.auth.getSession();
      if (!active) return;

      if (!data.session && (await reprendreLaConnexion())) return;
      if (!active) return;

      setIdentity(fromSession(data.session));
      setLoading(false);
    })();

    const { data: subscription } = client.auth.onAuthStateChange((_event, session) => {
      setIdentity(fromSession(session));
      // Une session qui arrive après coup — échange PKCE conclu, jeton
      // rafraîchi — doit lever l'écran d'attente, sinon il tourne sans fin.
      if (session) setLoading(false);
    });

    return () => {
      active = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  const signInWithGoogle = useCallback(async () => {
    if (!supabase) throw new Error('Aucun serveur configuré');

    // Dans l'application mobile, pas de domaine à choisir ni de page à
    // quitter : Google s'ouvre dans le navigateur du téléphone et revient
    // par `tripora://connexion`, que le pont natif conclut.
    if (estNatif) {
      await commencerLaConnexionGoogle();
      return;
    }

    // Une seule adresse détient les sessions : si on n'y est pas, on y va
    // d'abord. Le paramètre demande à l'écran d'arrivée de reprendre tout seul.
    if (ailleursQuePrevu()) {
      window.location.assign(`${ORIGINE_AUTH}/?connexion=google`);
      return;
    }

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
    // L'ordre compte : on prévient le serveur tant que la session est encore
    // lisible, puis on efface. L'inverse laisserait un jeton révoqué côté
    // serveur et bien vivant côté navigateur.
    if (supabase) {
      try {
        await supabase.auth.signOut();
      } catch {
        // Hors ligne, la révocation échoue. On efface quand même : quelqu'un
        // qui rend son téléphone ne doit pas dépendre du réseau pour cela.
      }
    }

    // Sans serveur, les voyages n'existent que dans ce navigateur : les
    // effacer serait détruire le travail de quelqu'un sans le lui demander.
    oublierApresDeconnexion({ gardeLesDonneesLocales: !supabase });

    // Le cache en mémoire survit au vidage du stockage : sans cela, le compte
    // suivant verrait s'afficher les voyages du précédent le temps que les
    // requêtes reviennent.
    viderLeCache();

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
