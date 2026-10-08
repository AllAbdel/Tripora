import { lazy, Suspense, useEffect, useState } from 'react';
import { useLocation } from 'react-router';
import { X } from 'lucide-react';
import { Mascotte } from '@/components/mascotte/Mascotte';
import { useAuth } from '@/lib/auth-context';
import { estNatif } from '@/lib/natif';
import { guideDejaVu, useGuide } from '@/stores/guide';

// Montrés une fois par appareil : ils n'ont rien à faire dans le paquet principal.
const AccueilDePlumio = lazy(() => import('./AccueilDePlumio'));
const VisiteGuidee = lazy(() => import('./VisiteGuidee'));

/** Les écrans où le guide peut s'ouvrir de lui-même : la liste des voyages, l'accueil d'un voyage. */
const ECRAN_D_ARRIVEE = /^\/voyages(?:\/([^/]+))?$/u;

/**
 * Quand montrer le guide, et comment.
 *
 * - **Dans l'application mobile**, au premier lancement, et **sur le site une
 *   fois connecté**, à la première arrivée dans ses voyages : l'accueil de
 *   Plumio, en grand, s'ouvre de lui-même.
 * - **Sur le site, sans compte**, pas de fenêtre par-dessus l'accueil : une
 *   carte discrète propose de découvrir Tripora avec Plumio. Une fenêtre qui
 *   recouvre la page dès l'arrivée est ce que Google pénalise sur mobile
 *   (« interstitiel intrusif »), et l'accueil explique déjà l'essentiel.
 *
 * Jamais pendant qu'on rejoint un voyage par un lien, qu'on crée un voyage ou
 * qu'on remplit ses envies : on y vient pour une chose précise. Le guide
 * attendra l'écran suivant.
 *
 * Ensuite, deux temps : l'accueil (`AccueilDePlumio`), puis la visite
 * (`VisiteGuidee`), qui montre comment créer un voyage.
 */
export function GuideAuPremierPassage() {
  const { identity, loading } = useAuth();
  const { pathname } = useLocation();
  const phase = useGuide((etat) => etat.phase);
  const decide = useGuide((etat) => etat.decide);
  const ouvrir = useGuide((etat) => etat.ouvrir);
  const commencerLaVisite = useGuide((etat) => etat.commencerLaVisite);
  const fermer = useGuide((etat) => etat.fermer);
  const marquerDecide = useGuide((etat) => etat.marquerDecide);
  const [dejaVu] = useState(guideDejaVu);

  const arrivee = ECRAN_D_ARRIVEE.exec(pathname);
  const surUnEcranDArrivee = arrivee !== null && arrivee[1] !== 'nouveau';

  useEffect(() => {
    if (loading || decide || phase) return;
    if (dejaVu) {
      marquerDecide();
      return;
    }
    // Dans l'application, sans compte, on arrive sur l'accueil : c'est le premier lancement.
    if ((identity && surUnEcranDArrivee) || (estNatif && !identity && pathname === '/')) ouvrir();
  }, [loading, decide, phase, dejaVu, identity, surUnEcranDArrivee, pathname, ouvrir, marquerDecide]);

  const invitation = !estNatif && !identity && !loading && !decide && !dejaVu && pathname === '/';

  return (
    <>
      {invitation && <InvitationAuGuide surOuvrir={ouvrir} surRefuser={fermer} />}
      {phase && (
        <Suspense fallback={null}>
          {phase === 'accueil' ? (
            <AccueilDePlumio surCommencer={commencerLaVisite} surPasser={fermer} />
          ) : (
            <VisiteGuidee surFermer={fermer} />
          )}
        </Suspense>
      )}
    </>
  );
}

/**
 * La proposition, sans l'imposer : une carte en bas de l'accueil, qui arrive
 * après un instant — le temps de voir la page avant qu'on nous parle.
 */
function InvitationAuGuide({ surOuvrir, surRefuser }: { surOuvrir: () => void; surRefuser: () => void }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const minuteur = window.setTimeout(() => setVisible(true), 1200);
    return () => window.clearTimeout(minuteur);
  }, []);
  if (!visible) return null;

  return (
    <aside
      aria-label="Guide de démarrage"
      className="surface-raised filet animate-rise fixed inset-x-4 bottom-4 z-40 mx-auto flex max-w-sm items-center gap-3
                 rounded-[var(--radius-card)] border p-3 shadow-[var(--shadow-float)] sm:right-6 sm:left-auto sm:mx-0 print:hidden"
      style={{ marginBottom: 'env(safe-area-inset-bottom)' }}
    >
      <button
        type="button"
        onClick={surOuvrir}
        className="flex min-h-11 min-w-0 flex-1 items-center gap-3 text-start"
      >
        <Mascotte pose="attend" taille={44} vie="calme" />
        <span className="min-w-0">
          <span className="block text-sm font-semibold">Découvrir Tripora avec Plumio</span>
          <span className="text-muted block text-xs">Une minute, sans compte.</span>
        </span>
      </button>
      <button
        type="button"
        onClick={surRefuser}
        aria-label="Ne pas voir le guide"
        className="text-muted hover:text-brand-600 grid size-11 shrink-0 place-items-center rounded-full"
      >
        <X className="size-5" aria-hidden />
      </button>
    </aside>
  );
}
