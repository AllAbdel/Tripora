import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { ArrowLeft, LogIn, Ticket } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Banner } from '@/components/ui/Banner';
import { CadrePublic } from '@/components/CadrePublic';
import { useAuth } from '@/lib/auth-context';
import { diagnosticConnexion, RETOUR_OAUTH } from '@/lib/oauthReturn';
import { FormulaireCodeEmail } from '@/components/FormulaireCodeEmail';
import { useTitreDuDocument } from '@/lib/useTitreDuDocument';
import { env } from '@/lib/env';
import { cn } from '@/lib/cn';

type Intention = 'creer' | 'connecter';

/**
 * Se connecter, ou créer son compte — c'est le même geste.
 *
 * Trois portes : Google (un bouton), une adresse e-mail (un code à six
 * chiffres, sans mot de passe), un code d'invitation (pour rejoindre un
 * voyage sans rien créer). On arrive ici depuis « Se connecter », ou parce
 * qu'on a voulu faire quelque chose qui demande un compte : dans ce cas, la
 * connexion faite, on y retourne (voir `suiteApresConnexion.ts`).
 */
export default function Connexion() {
  const { signInWithGoogle, envoyerUnCode, verifierLeCode, continueAsGuest, backendReady } = useAuth();
  const navigate = useNavigate();
  const etat = useLocation().state as { erreurDeConnexion?: string; inscription?: boolean } | null;
  const [intention, setIntention] = useState<Intention>(etat?.inscription ? 'creer' : 'connecter');
  const [occupe, setOccupe] = useState<'google' | 'local' | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  useTitreDuDocument(intention === 'creer' ? 'Créer un compte — Tripora' : 'Se connecter — Tripora');

  // Revenir de Google sans session est la seule panne totalement muette de
  // Tripora : l'écran de connexion réapparaît, identique. On dit ce qui s'est
  // passé, et surtout quoi faire — sans ça, personne ne peut le deviner.
  const diagnostic = useMemo(
    () => diagnosticConnexion(RETOUR_OAUTH, window.location.origin, env.supabaseUrl),
    [],
  );
  // Dans l'application mobile, le retour de Google n'arrive pas par l'adresse
  // de cette page mais par le pont natif, qui nous ramène ici avec la raison.
  const erreurNative = etat?.erreurDeConnexion;

  /**
   * Reprise après un renvoi vers l'adresse d'authentification.
   *
   * `signInWithGoogle` amène ici quand la connexion partait d'un domaine qui
   * n'aurait pas pu la conclure. Le paramètre dit qu'on n'est pas venu de son
   * plein gré : on repart chez Google tout de suite, sans faire recliquer.
   */
  const reprise = useRef(false);
  useEffect(() => {
    if (reprise.current) return;
    if (new URLSearchParams(window.location.search).get('connexion') !== 'google') return;
    reprise.current = true;
    // L'adresse est nettoyée d'abord : un rechargement ne doit pas relancer.
    window.history.replaceState(null, '', window.location.pathname);
    void google();
    // `google` ne dépend que de fonctions du contexte, elles-mêmes mémoïsées.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function google() {
    setErreur(null);
    setOccupe('google');
    try {
      await signInWithGoogle();
    } catch (cause) {
      setErreur(cause instanceof Error ? cause.message : 'Connexion impossible pour le moment.');
    } finally {
      setOccupe(null);
    }
  }

  async function modeLocal() {
    setOccupe('local');
    try {
      await continueAsGuest();
    } finally {
      setOccupe(null);
    }
  }

  const messageAffiche = erreur ?? erreurNative;

  return (
    <CadrePublic connexion={false} pied="discret">
      <main className="mx-auto w-full max-w-md px-5 pt-8 pb-16">
        <button
          type="button"
          onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/'))}
          className="text-muted hover:text-brand-600 -ms-1 mb-4 inline-flex min-h-11 items-center gap-1.5 text-sm"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Retour
        </button>

        <div className="animate-rise space-y-7">
          <header className="space-y-2">
            <h1 className="titre-lieu text-4xl">
              {intention === 'creer' ? 'Créer votre compte' : 'Content de vous revoir'}
            </h1>
            <p className="text-muted text-[0.95rem] leading-relaxed">
              {intention === 'creer'
                ? 'Gratuit, sans mot de passe. Un compte garde vos voyages, sur le téléphone comme sur l’ordinateur.'
                : 'Retrouvez vos voyages, sur cet appareil comme sur les autres.'}
            </p>
          </header>

          {backendReady && (
            <div role="tablist" aria-label="Compte" className="surface-raised filet grid grid-cols-2 gap-1 rounded-[var(--radius-card)] border p-1">
              {(
                [
                  ['creer', 'Première fois'],
                  ['connecter', 'J’ai un compte'],
                ] as const
              ).map(([valeur, libelle]) => (
                <button
                  key={valeur}
                  type="button"
                  role="tab"
                  aria-selected={intention === valeur}
                  onClick={() => {
                    setIntention(valeur);
                    setErreur(null);
                  }}
                  className={cn(
                    'min-h-10 rounded-[calc(var(--radius-card)-0.25rem)] text-sm font-semibold transition-colors',
                    intention === valeur
                      ? 'bg-brand-500 text-[color:var(--accent-contrast)]'
                      : 'text-muted hover:bg-[color:var(--surface-muted)]',
                  )}
                >
                  {libelle}
                </button>
              ))}
            </div>
          )}

          {!backendReady && (
            <Banner tone="warning" title="Mode local">
              Aucun serveur n’est encore configuré. Vous pouvez découvrir l’interface, mais les
              voyages resteront sur cet appareil.
            </Banner>
          )}

          {!messageAffiche && diagnostic && (
            <Banner tone="warning" title={diagnostic.titre}>
              {diagnostic.message}
              {diagnostic.aFaire && (
                <span className="mt-2 block font-mono text-xs break-all">{diagnostic.aFaire}</span>
              )}
            </Banner>
          )}

          {messageAffiche && (
            <Banner tone="warning" title="Connexion impossible">
              {messageAffiche}
            </Banner>
          )}

          {backendReady ? (
            <div className="space-y-5">
              <Button
                block
                size="lg"
                icon={<LogIn className="size-5" aria-hidden />}
                loading={occupe === 'google'}
                onClick={() => void google()}
              >
                Continuer avec Google
              </Button>

              <p className="etiquette-filet">
                <span className="etiquette">ou avec votre e-mail</span>
              </p>

              {/* La clé remet le formulaire à zéro quand on change d'onglet :
                  un code demandé pour « se connecter » ne vaut pas inscription. */}
              <FormulaireCodeEmail
                key={intention}
                avecPrenom={intention === 'creer'}
                demander={(email, prenom) =>
                  envoyerUnCode({ email, creer: intention === 'creer', prenom })
                }
                valider={verifierLeCode}
              />
            </div>
          ) : (
            <Button
              block
              size="lg"
              icon={<Ticket className="size-5" aria-hidden />}
              loading={occupe === 'local'}
              onClick={() => void modeLocal()}
            >
              Découvrir en mode local
            </Button>
          )}

          {backendReady && (
            <div className="filet space-y-2 border-t pt-5">
              <p className="text-muted text-sm">Un ami vous a envoyé un code ?</p>
              <Link
                to="/rejoindre"
                className="text-brand-700 dark:text-brand-200 inline-flex min-h-11 items-center gap-2 text-sm font-semibold underline-offset-4 hover:underline"
              >
                <Ticket className="size-4" aria-hidden />
                Rejoindre son voyage, sans créer de compte
              </Link>
            </div>
          )}

          <p className="text-muted text-xs leading-relaxed">
            En continuant, vous acceptez les{' '}
            <Link to="/conditions" className="underline underline-offset-2">
              conditions d’utilisation
            </Link>
            . Pas de publicité, pas de revente de données, et vos noms ne sont jamais transmis à
            une intelligence artificielle :{' '}
            <Link to="/confidentialite" className="underline underline-offset-2">
              ce que Tripora conserve
            </Link>
            .
          </p>
        </div>
      </main>
    </CadrePublic>
  );
}
