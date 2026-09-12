import { useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import { Star, Trash2 } from 'lucide-react';
import { cn } from '@/lib/cn';

/**
 * Une ligne qu'on peut faire glisser pour agir dessus.
 *
 * Deux gestes, deux boutons, et les deux mènent au même endroit : glisser vers
 * la gauche supprime, glisser vers la droite épingle, et les mêmes actions
 * restent atteignables au doigt sans rien glisser. Le geste est plus rapide
 * pour qui le connaît ; le bouton est le seul chemin pour qui navigue au
 * clavier ou au lecteur d'écran, et c'est celui qui doit exister d'abord.
 *
 * Le glissement ne se déclenche que sur un mouvement franchement horizontal :
 * sans cette condition, faire défiler la liste avec le pouce posé sur une
 * carte la déplacerait latéralement à chaque fois.
 */

/** Déplacement au-delà duquel on considère que le geste est horizontal. */
const PENTE_MINIMALE = 8;
/** Déplacement à partir duquel l'action se déclenche au relâchement. */
const SEUIL_ACTION = 96;
/** Au-delà, la carte ne suit plus le doigt : elle résiste. */
const COURSE_MAXIMALE = 132;

export function LigneGlissante({
  children,
  epingle,
  surEpingler,
  surSupprimer,
  libelle,
}: {
  children: ReactNode;
  epingle: boolean;
  surEpingler: () => void;
  surSupprimer: () => void;
  /** Nom de l'élément, pour que les boutons soient annonçables. */
  libelle: string;
}) {
  const [decalage, setDecalage] = useState(0);
  const [glisse, setGlisse] = useState(false);
  const depart = useRef<{ x: number; y: number; horizontal: boolean } | null>(null);

  function commencer(evenement: ReactPointerEvent<HTMLDivElement>) {
    if (evenement.pointerType === 'mouse' && evenement.button !== 0) return;
    depart.current = { x: evenement.clientX, y: evenement.clientY, horizontal: false };
  }

  function suivre(evenement: ReactPointerEvent<HTMLDivElement>) {
    const debut = depart.current;
    if (!debut) return;

    const dx = evenement.clientX - debut.x;
    const dy = evenement.clientY - debut.y;

    if (!debut.horizontal) {
      // Tant que le geste peut encore être un défilement, on ne prend rien.
      if (Math.abs(dy) > Math.abs(dx)) {
        depart.current = null;
        return;
      }
      if (Math.abs(dx) < PENTE_MINIMALE) return;
      debut.horizontal = true;
      setGlisse(true);
    }

    // Au-delà de la course, le déplacement s'amortit : la carte suit encore le
    // doigt, mais de moins en moins, ce qui dit qu'on est allé au bout.
    const brut = dx;
    const amorti =
      Math.abs(brut) <= COURSE_MAXIMALE
        ? brut
        : Math.sign(brut) * (COURSE_MAXIMALE + (Math.abs(brut) - COURSE_MAXIMALE) * 0.25);
    setDecalage(amorti);
  }

  function finir() {
    const horizontal = depart.current?.horizontal ?? false;
    depart.current = null;
    setGlisse(false);

    if (horizontal) {
      if (decalage <= -SEUIL_ACTION) surSupprimer();
      else if (decalage >= SEUIL_ACTION) surEpingler();
    }
    setDecalage(0);
  }

  const versLaSuppression = decalage <= -PENTE_MINIMALE;
  const versLEpingle = decalage >= PENTE_MINIMALE;
  const arme = Math.abs(decalage) >= SEUIL_ACTION;

  return (
    <div className="relative overflow-hidden rounded-[var(--radius-card)]">
      {/* Les deux fonds, révélés par le glissement. Purement visuels : les
          boutons au-dessus font le même travail, et eux sont annonçables. */}
      <div
        className={cn(
          'absolute inset-y-0 left-0 flex w-32 items-center justify-start pl-5 transition-colors',
          versLEpingle ? 'bg-gold-500' : 'bg-transparent',
        )}
        aria-hidden
      >
        {versLEpingle && (
          <Star className={cn('size-5 text-white', arme && 'fill-white')} />
        )}
      </div>
      <div
        className={cn(
          'absolute inset-y-0 right-0 flex w-32 items-center justify-end pr-5 transition-colors',
          versLaSuppression ? 'bg-red-600' : 'bg-transparent',
        )}
        aria-hidden
      >
        {versLaSuppression && <Trash2 className="size-5 text-white" />}
      </div>

      <div
        onPointerDown={commencer}
        onPointerMove={suivre}
        onPointerUp={finir}
        onPointerCancel={finir}
        style={{ transform: `translateX(${decalage}px)` }}
        className={cn(
          'relative flex items-stretch gap-1.5',
          // Pendant le geste on suit le doigt sans transition ; au relâchement,
          // le retour est amorti.
          glisse ? '' : 'transition-transform duration-200',
          // Le navigateur garde le défilement vertical, on ne prend que l'axe X.
          'touch-pan-y',
        )}
      >
        <BoutonDAction
          etiquette={epingle ? `Retirer ${libelle} des favoris` : `Épingler ${libelle}`}
          au={surEpingler}
          classe={
            epingle
              ? 'text-gold-600 dark:text-gold-300'
              : 'text-muted hover:text-gold-600 dark:hover:text-gold-300'
          }
        >
          <Star className={cn('size-5', epingle && 'fill-current')} aria-hidden />
        </BoutonDAction>

        <div className="min-w-0 flex-1">{children}</div>

        <BoutonDAction
          etiquette={`Supprimer ${libelle}`}
          au={surSupprimer}
          classe="text-muted hover:text-red-600 dark:hover:text-red-400"
        >
          <Trash2 className="size-5" aria-hidden />
        </BoutonDAction>
      </div>
    </div>
  );
}

function BoutonDAction({
  children,
  etiquette,
  au,
  classe,
}: {
  children: ReactNode;
  etiquette: string;
  au: () => void;
  classe: string;
}) {
  return (
    <button
      type="button"
      aria-label={etiquette}
      title={etiquette}
      onClick={au}
      // Le glissement écoute les évènements de pointeur sur le parent : sans
      // ceci, appuyer sur un bouton commencerait aussi un geste.
      onPointerDown={(evenement) => evenement.stopPropagation()}
      className={cn(
        'grid w-11 shrink-0 place-items-center rounded-xl transition-colors',
        classe,
      )}
    >
      {children}
    </button>
  );
}
