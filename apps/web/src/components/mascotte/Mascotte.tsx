import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

/**
 * Les poses du personnage de Tripora, telles que les liste le brief
 * (`docs/MASCOTTE.md`, « La planche de poses »).
 */
export type PoseDeLaMascotte =
  | 'accueil'
  | 'pointer'
  | 'explique'
  | 'reflechit'
  | 'celebre'
  | 'attend'
  | 'hors-ligne'
  | 'oups'
  | 'chut'
  | 'notification'
  | 'depart'
  | 'au-revoir';

/** Vers où il montre, quand il montre quelque chose : l'élément mis en lumière. */
export type DirectionDuGeste = 'haut' | 'bas' | 'gauche' | 'droite';

/**
 * L'emplacement du personnage.
 *
 * Ses dessins sont en cours (le brief : `docs/MASCOTTE.md`). En attendant, il
 * montre ce qu'on lui passe en `repli` — dans la visite guidée, la pastille
 * de l'écran — et chaque endroit qui l'accueillera est déjà en place, avec sa
 * pose et sa direction. Quand les poses arriveront, seul ce composant
 * changera : les SVG y deviendront des composants, animés en CSS.
 *
 * Décoratif : ce qu'il « dit » est toujours écrit à côté, dans une bulle.
 */
export function Mascotte({
  pose,
  direction,
  repli,
  className,
}: {
  pose: PoseDeLaMascotte;
  direction?: DirectionDuGeste;
  repli: ReactNode;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      data-pose={pose}
      data-direction={direction}
      className={cn('inline-grid shrink-0 place-items-center', className)}
    >
      {repli}
    </span>
  );
}
