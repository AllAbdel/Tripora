import { lazy, Suspense, useEffect, useState } from 'react';
import { useLocation } from 'react-router';
import { PlayCircle, X } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { estNatif } from '@/lib/natif';
import { guideDejaVu, useGuide } from '@/stores/guide';

// Montré une fois par appareil : il n'a rien à faire dans le paquet principal.
const GuideDeDemarrage = lazy(() => import('./GuideDeDemarrage'));

/**
 * Quand montrer le guide, et comment.
 *
 * - **Dans l'application mobile**, au premier lancement, en plein écran :
 *   c'est l'usage, et rien d'autre ne l'explique.
 * - **Sur le site, une fois connecté**, à la première arrivée dans ses
 *   voyages : on vient de créer son compte, c'est le moment.
 * - **Sur le site, sans compte**, pas de fenêtre par-dessus l'accueil : une
 *   carte discrète propose le guide. Une fenêtre qui recouvre la page dès
 *   l'arrivée est ce que Google pénalise sur mobile (« interstitiel
 *   intrusif »), et l'accueil explique déjà l'essentiel.
 *
 * Jamais pendant qu'on rejoint un voyage par un lien : on y vient pour une
 * chose précise, le guide attendra l'écran suivant.
 */
export function GuideAuPremierPassage() {
  const { identity, loading } = useAuth();
  const { pathname } = useLocation();
  const ouvert = useGuide((etat) => etat.ouvert);
  const decide = useGuide((etat) => etat.decide);
  const ouvrir = useGuide((etat) => etat.ouvrir);
  const fermer = useGuide((etat) => etat.fermer);
  const marquerDecide = useGuide((etat) => etat.marquerDecide);
  const [dejaVu] = useState(guideDejaVu);

  const enChemin = /^\/(rejoindre|retour-app)(\/|$)/u.test(pathname);

  useEffect(() => {
    if (loading || decide || ouvert || enChemin) return;
    if (dejaVu) {
      marquerDecide();
      return;
    }
    if (estNatif || identity) ouvrir();
  }, [loading, decide, ouvert, enChemin, dejaVu, identity, ouvrir, marquerDecide]);

  const invitation = !estNatif && !identity && !loading && !decide && !dejaVu && pathname === '/';

  return (
    <>
      {invitation && <InvitationAuGuide surOuvrir={ouvrir} surRefuser={fermer} />}
      {ouvert && (
        <Suspense fallback={null}>
          <GuideDeDemarrage surFermer={fermer} />
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
