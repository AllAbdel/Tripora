import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { LogIn, Ticket } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Banner } from '@/components/ui/Banner';
import { Logo } from '@/components/Logo';
import { useAuth } from '@/lib/auth-context';
import { diagnosticConnexion, RETOUR_OAUTH } from '@/lib/oauthReturn';
import { tableauDesDeparts } from '@/lib/tableauDesDeparts';
import { env } from '@/lib/env';

export default function SignIn() {
  const { signInWithGoogle, continueAsGuest, backendReady } = useAuth();
  const [busy, setBusy] = useState<'google' | 'guest' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  // Dans l'application mobile, le retour de Google n'arrive pas par l'adresse
  // de cette page mais par le pont natif, qui nous ramène ici avec la raison.
  const erreurNative = (useLocation().state as { erreurDeConnexion?: string } | null)
    ?.erreurDeConnexion;

  // Revenir de Google sans session est la seule panne totalement muette de
  // Tripora : l'écran de connexion réapparaît, identique. On dit ce qui s'est
  // passé, et surtout quoi faire — sans ça, personne ne peut le deviner.
  const diagnostic = useMemo(
    () => diagnosticConnexion(RETOUR_OAUTH, window.location.origin, env.supabaseUrl),
    [],
  );

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
    void run('google');
    // `run` est stable pour ce qui nous intéresse : elle ne dépend que de
    // fonctions du contexte, elles-mêmes mémoïsées.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function run(kind: 'google' | 'guest') {
    setError(null);
    setBusy(kind);
    try {
      if (kind === 'google') {
        await signInWithGoogle();
      } else if (backendReady) {
        // Avec un serveur, « j'ai un code » mène à l'écran qui sait quoi en
        // faire ; c'est lui qui ouvrira la session invité une fois le code
        // saisi, pour ne pas créer de compte vide si la personne abandonne.
        navigate('/rejoindre');
      } else {
        await continueAsGuest();
        navigate('/voyages');
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Connexion impossible pour le moment.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-between px-6 py-10">
      <div className="animate-rise flex flex-1 flex-col justify-center gap-7">
        {/* Rien n'est centré ici, et c'est délibéré : un logo au milieu
            au-dessus d'un paragraphe au milieu est la mise en page que produit
            n'importe quel gabarit. Le titre s'aligne à gauche, comme la
            première ligne d'une page, et le logo se range à sa hauteur. */}
        <header className="space-y-4">
          <Logo className="size-12" />
          <div className="space-y-3">
            <h1 className="titre-lieu text-[3.25rem] leading-[0.95]">Tripora</h1>
            <p className="etiquette-filet">
              <span className="etiquette">Voyager à plusieurs</span>
            </p>
            <p className="text-muted max-w-[34ch] text-[0.95rem] leading-relaxed">
              Dites avec qui vous partez, d’où, quand et pour combien.
              Tripora aide le groupe à choisir, puis à s’organiser.
            </p>
          </div>
        </header>

        <TableauDesDeparts />

        {!backendReady && (
          <Banner tone="warning" title="Mode local">
            Aucun serveur n’est encore configuré. Vous pouvez découvrir l’interface,
            mais les voyages resteront sur cet appareil.
          </Banner>
        )}

        {!error && !erreurNative && diagnostic && (
          <Banner tone="warning" title={diagnostic.titre}>
            {diagnostic.message}
            {diagnostic.aFaire && (
              <span className="mt-2 block break-all font-mono text-xs">
                {diagnostic.aFaire}
              </span>
            )}
          </Banner>
        )}

        {(error ?? erreurNative) && (
          <Banner tone="warning" title="Connexion impossible">
            {error ?? erreurNative}
          </Banner>
        )}

        <div className="space-y-3">
          {backendReady && (
            <Button
              block
              size="lg"
              icon={<LogIn className="size-5" aria-hidden />}
              loading={busy === 'google'}
              onClick={() => void run('google')}
            >
              Continuer avec Google
            </Button>
          )}
          <Button
            block
            size="lg"
            variant={backendReady ? 'secondary' : 'primary'}
            icon={<Ticket className="size-5" aria-hidden />}
            loading={busy === 'guest'}
            onClick={() => void run('guest')}
          >
            {backendReady ? 'J’ai un code d’invitation' : 'Découvrir en mode local'}
          </Button>
        </div>
      </div>

      <p className="text-muted mt-8 text-xs leading-relaxed">
        Pas de mot de passe, pas de publicité, pas de pistage, pas de revente de données.
        Vos noms et vos dépenses ne sont jamais transmis à un service d’intelligence artificielle.{' '}
        <Link to="/confidentialite" className="underline">
          Ce que Tripora conserve
        </Link>
        .
      </p>
    </div>
  );
}

/**
 * Cinq villes du catalogue, présentées comme un affichage d'aéroport.
 *
 * Ce n'est pas un ornement : ce sont de vraies destinations, avec leurs vrais
 * codes, tirées du catalogue embarqué — donc identiques hors ligne. Le tirage
 * change chaque jour, ce qui donne une raison de le regarder deux fois sans
 * le faire vibrer à chaque rendu.
 *
 * Il est masqué aux lecteurs d'écran : une liste de villes sans rapport avec
 * l'action à mener n'apporte rien à qui ne la voit pas, et ferait cinq
 * annonces avant d'atteindre le bouton de connexion.
 */
function TableauDesDeparts() {
  const lignes = tableauDesDeparts();
  if (lignes.length === 0) return null;

  return (
    <div aria-hidden className="select-none">
      <p className="etiquette-filet mb-2">
        <span className="etiquette">Au départ, aujourd’hui</span>
      </p>
      <ul className="space-y-0">
        {lignes.map((ligne, rang) => (
          <li
            key={ligne.code}
            className="flex items-baseline gap-3 border-b py-1.5 filet last:border-b-0"
            style={{
              // Les dernières lignes s'effacent : le tableau continue
              // au-delà du bord, il ne s'arrête pas net.
              opacity: 1 - rang * 0.16,
            }}
          >
            <span className="chiffres w-9 shrink-0 text-xs font-semibold tracking-[0.08em]">
              {ligne.code}
            </span>
            <span className="titre truncate text-[0.95rem]">{ligne.ville}</span>
            <span className="etiquette ms-auto shrink-0 truncate">{ligne.pays}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
