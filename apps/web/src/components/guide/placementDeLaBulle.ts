import type { DirectionDuGeste } from '@/components/mascotte/Mascotte';

/**
 * Où poser la bulle de la visite guidée, à partir de l'élément mis en lumière.
 *
 * Sous l'élément de préférence (on lit de haut en bas : on voit la chose,
 * puis son explication), au-dessus s'il n'y a pas la place, et ancrée en bas
 * de l'écran quand l'élément occupe presque tout — la carte plein écran de
 * « Découvrir », un formulaire ouvert. Horizontalement, centrée sur
 * l'élément sans jamais déborder de l'écran ; la pointe, elle, reste en face
 * de l'élément.
 *
 * Aucune mesure de la bulle n'est nécessaire : dessous, on fixe son haut ;
 * dessus, son bas. Elle peut donc grandir avec sa traduction sans être
 * repositionnée.
 *
 * Pure : testée dans `placementDeLaBulle.test.ts`.
 */

export interface Rectangle {
  top: number;
  left: number;
  width: number;
  height: number;
}

export interface Ecran {
  largeur: number;
  hauteur: number;
}

export type Placement =
  | { mode: 'centre'; largeur: number }
  | {
      mode: 'dessous' | 'dessus';
      largeur: number;
      left: number;
      /** `top` dessous, `bottom` dessus : la distance au bord correspondant de l'écran. */
      top?: number;
      bottom?: number;
      maxHauteur: number;
      /** La pointe, en pixels depuis le bord gauche de la bulle. */
      pointe: number;
      geste: DirectionDuGeste;
    }
  | { mode: 'ancree'; largeur: number; left: number; maxHauteur: number };

/** La marge le long des bords de l'écran. */
export const MARGE = 16;
/** L'écart entre l'élément et la bulle, pointe comprise. */
export const ECART = 14;
/** La bulle ne dépasse pas cette largeur, même sur un grand écran. */
export const LARGEUR_MAX = 352;
/** Ce qu'il faut de hauteur pour la lire sans défiler. */
const HAUTEUR_CONFORTABLE = 250;
/** En dessous, mieux vaut la poser par-dessus l'élément. */
const HAUTEUR_MINIMALE = 190;
/** La pointe ne s'approche pas plus des coins arrondis. */
const RETRAIT_DE_LA_POINTE = 22;

function borner(valeur: number, min: number, max: number): number {
  return Math.min(Math.max(valeur, min), max);
}

export function placerLaBulle(cible: Rectangle | null, ecran: Ecran): Placement {
  const largeur = Math.min(LARGEUR_MAX, ecran.largeur - 2 * MARGE);
  if (!cible) return { mode: 'centre', largeur };

  const centre = cible.left + cible.width / 2;
  const left = borner(centre - largeur / 2, MARGE, ecran.largeur - MARGE - largeur);
  const pointe = borner(centre - left, RETRAIT_DE_LA_POINTE, largeur - RETRAIT_DE_LA_POINTE);

  const placeDessous = ecran.hauteur - (cible.top + cible.height) - ECART - MARGE;
  const placeDessus = cible.top - ECART - MARGE;

  const dessous = {
    mode: 'dessous' as const,
    largeur,
    left,
    top: cible.top + cible.height + ECART,
    maxHauteur: placeDessous,
    pointe,
    geste: 'haut' as const,
  };
  const dessus = {
    mode: 'dessus' as const,
    largeur,
    left,
    bottom: ecran.hauteur - cible.top + ECART,
    maxHauteur: placeDessus,
    pointe,
    geste: 'bas' as const,
  };

  if (placeDessous >= HAUTEUR_CONFORTABLE) return dessous;
  if (placeDessus >= HAUTEUR_CONFORTABLE) return dessus;
  if (Math.max(placeDessous, placeDessus) >= HAUTEUR_MINIMALE) {
    return placeDessous >= placeDessus ? dessous : dessus;
  }
  return {
    mode: 'ancree',
    largeur,
    left: (ecran.largeur - largeur) / 2,
    maxHauteur: Math.round(ecran.hauteur * 0.6),
  };
}

/**
 * L'élément est-il visible en entier ? Sinon on le fait venir au milieu de
 * l'écran avant d'en parler.
 */
export function estEnVue(cible: Rectangle, ecran: Ecran): boolean {
  return cible.top >= 0 && cible.top + cible.height <= ecran.hauteur;
}
