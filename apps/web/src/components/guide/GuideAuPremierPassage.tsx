import { lazy, Suspense, useEffect, useState } from 'react';
import { useLocation } from 'react-router';
import { PlayCircle, X } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { estNatif } from '@/lib/natif';
import { guideDejaVu, lireLaReprise, useGuide } from '@/stores/guide';

// Montrés une fois par appareil : ils n'ont rien à faire dans le paquet principal.
const GuideDeDemarrage = lazy(() => import('./GuideDeDemarrage'));
const VisiteGuidee = lazy(() => import('./VisiteGuidee'));

/** Les écrans où la visite peut commencer d'elle-même : la liste des voyages, l'accueil d'un voyage. */
const ECRAN_D_ARRIVEE = /^\/voyages(?:\/([^/]+))?$/u;

/**
 * Quand montrer le guide, et comment.
 *
 * - **Une fois connecté**, sur le site comme dans l'application, à la
 *   première arrivée dans ses voyages : la visite guidée, sur les vraies
 *   pages. Arrivé dans un voyage, elle s'y joue.
 * - **Sur le site, sans compte**, pas de fenêtre par-dessus l'accueil : une
 *   carte discrète propose le guide, en diaporama (les pages de la visite
 *   demandent un compte). Une fenêtre qui recouvre la page dès l'arrivée est
 *   ce que Google pénalise sur mobile (« interstitiel intrusif »), et
 *   l'accueil explique déjà l'essentiel.
 * - **Dans l'application, sans compte**, rien d'imposé : la visite attendra
 *   la connexion. Le diaporama reste à portée depuis l'accueil.
 *
 * Jamais pendant qu'on rejoint un voyage par un lien, qu'on crée un voyage ou
 * qu'on remplit ses envies : on y vient pour une chose précise, et la visite,
 * qui change de page, ferait perdre le fil. Elle attendra l'écran suivant.
 *
 * Une visite mise en attente le temps de créer un premier voyage reprend à
 * l'arrivée dans ce voyage.
 */
export function GuideAuPremierPassage() {
  const { identity, loading } = useAuth();
  const { pathname } = useLocation();
  const ouvert = useGuide((etat) => etat.ouvert);
  const decide = useGuide((etat) => etat.decide);
  const depart = useGuide((etat) => etat.depart);
  const ouvrir = useGuide((etat) => etat.ouvrir);
  const reprendre = useGuide((etat) => etat.reprendre);
  const fermer = useGuide((etat) => etat.fermer);
  const attendreUnVoyage = useGuide((etat) => etat.attendreUnVoyage);
  const marquerDecide = useGuide((etat) => etat.marquerDecide);
  const [dejaVu] = useState(guideDejaVu);

  const arrivee = ECRAN_D_ARRIVEE.exec(pathname);
  const surUnEcranDArrivee = arrivee !== null && arrivee[1] !== 'nouveau';
  const voyageOuvert = surUnEcranDArrivee ? arrivee[1] : undefined;

  // Revenu de créer son premier voyage : la visite reprend dedans.
  useEffect(() => {
    if (!identity || ouvert || !voyageOuvert) return;
    if (lireLaReprise()?.etat === 'attend-un-voyage') reprendre({ voyageId: voyageOuvert, dansLeVoyage: true });
  }, [identity, ouvert, voyageOuvert, reprendre]);

  useEffect(() => {
    if (loading || decide || ouvert) return;
    if (dejaVu) {
      marquerDecide();
      return;
    }
    if (!identity || !surUnEcranDArrivee) return;
    const reprise = lireLaReprise();
    if (reprise?.etat === 'en-cours') {
      reprendre({ arret: reprise.arret, ...(reprise.voyageId ? { voyageId: reprise.voyageId } : {}) });
    } else if (voyageOuvert) {
      // Arrivé dans un voyage (rejoint par un lien, par exemple) : la visite s'y joue.
      reprendre({ voyageId: voyageOuvert, dansLeVoyage: true });
    } else {
      ouvrir();
    }
  }, [loading, decide, ouvert, dejaVu, identity, surUnEcranDArrivee, voyageOuvert, ouvrir, reprendre, marquerDecide]);

  const invitation = !estNatif && !identity && !loading && !decide && !dejaVu && pathname === '/';

  return (
    <>
      {invitation && <InvitationAuGuide surOuvrir={ouvrir} surRefuser={fermer} />}
      {ouvert && (
        <Suspense fallback={null}>
          {identity ? (
            <VisiteGuidee depart={depart} surFermer={fermer} surAttendreUnVoyage={attendreUnVoyage} />
          ) : (
            <GuideDeDemarrage surFermer={fermer} />
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
        <PlayCircle className="text-brand-600 dark:text-brand-300 size-7 shrink-0" aria-hidden />
        <span className="min-w-0">
          <span className="block text-sm font-semibold">Première visite ?</span>
          <span className="text-muted block text-xs">Tripora en six écrans, trente secondes.</span>
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
