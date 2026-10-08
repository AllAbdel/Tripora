import type { PoseDeLaMascotte } from '@/components/mascotte/Mascotte';

/**
 * Où poser la bulle de la visite guidée, et Plumio dessus, à partir de
 * l'élément mis en lumière. Les règles sont celles des maquettes de Claude
 * Design (`design/mascotte/NOTES.md`, « Le tutoriel ») :
 *
 * - **sur un téléphone**, la bulle sous l'élément, ou au-dessus quand il n'y
 *   a pas la place dessous ; ancrée en bas de l'écran quand l'élément occupe
 *   presque tout ;
 * - **sur un ordinateur**, à côté de l'élément, du côté de la fin de ligne
 *   (à droite, à gauche en arabe), et sinon dessous ou dessus ;
 * - **Plumio se tient sur le bord haut de la bulle**, du côté de l'élément, et
 *   le montre de l'aile. Sous l'élément, l'écart entre les deux est sa
 *   hauteur : il ne le cache jamais.
 *
 * La bulle n'est jamais mesurée : dessous ou à côté, on fixe son haut ;
 * dessus, son bas. Elle peut donc grandir avec sa traduction sans être
 * repositionnée. Tout est en coordonnées de l'écran (gauche, haut), y compris
 * en arabe : c'est la position de l'élément qui est physique.
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

export interface PlacementDePlumio {
  taille: number;
  /** Depuis le bord gauche de la bulle ; il a les pattes sur son bord haut. */
  left: number;
  pose: PoseDeLaMascotte;
}

interface Commun {
  largeur: number;
  plumio: PlacementDePlumio;
}

export type Placement =
  | (Commun & { mode: 'centre' })
  | (Commun & { mode: 'ancree'; left: number; maxHauteur: number })
  | (Commun & {
      mode: 'dessous' | 'dessus';
      left: number;
      /** `top` dessous, `bottom` dessus : la distance au bord correspondant de l'écran. */
      top?: number;
      bottom?: number;
      maxHauteur: number;
      /** La pointe, en pixels depuis le bord gauche de la bulle. */
      pointe: number;
    })
  | (Commun & {
      mode: 'cote';
      left: number;
      top: number;
      maxHauteur: number;
      /** La pointe, en pixels depuis le bord haut de la bulle. */
      pointe: number;
      /** De quel côté de la bulle se trouve l'élément. */
      cote: 'gauche' | 'droite';
    });

/** La marge le long des bords de l'écran. */
export const MARGE = 16;
/** À partir de cette largeur, un ordinateur : bulle à côté, Plumio plus grand. */
export const LARGEUR_ORDINATEUR = 1024;
export const LARGEUR_DE_BULLE = { telephone: 288, ordinateur: 320 } as const;
export const TAILLE_DE_PLUMIO = { telephone: 64, ordinateur: 80 } as const;
/** Debout sur un champ, à le picorer : un peu plus petit, il ne doit pas cacher la saisie. */
export const TAILLE_DE_PLUMIO_SUR_UN_CHAMP = { telephone: 56, ordinateur: 64 } as const;
/** Sous un champ que Plumio picore : la bulle se colle presque, il n'est pas entre les deux. */
const ECART_SOUS_UN_CHAMP = 14;
/** Sous l'élément : la place de Plumio, debout entre les deux. */
const ECART_DESSOUS = { telephone: 58, ordinateur: 86 } as const;
const ECART_DESSUS = 22;
const ECART_COTE = 26;
/** Ce qu'il faut de hauteur pour lire la bulle sans défiler. */
const HAUTEUR_CONFORTABLE = 200;
/** En dessous, mieux vaut la poser par-dessus l'élément. */
const HAUTEUR_MINIMALE = 160;
/** La pointe ne s'approche pas plus des coins arrondis. */
const RETRAIT_DE_LA_POINTE = 22;

function borner(valeur: number, min: number, max: number): number {
  return Math.min(Math.max(valeur, min), max);
}

export function placerLaBulle(
  cible: Rectangle | null,
  ecran: Ecran,
  {
    rtl = false,
    surLeChamp = false,
    dessusImpose = false,
  }: {
    rtl?: boolean;
    /**
     * Plumio picore l'élément au lieu de se tenir sur la bulle : la bulle se
     * colle dessous, ou laisse au-dessus la place de Plumio, debout sur le
     * champ. Jamais à côté.
     */
    surLeChamp?: boolean;
    /** Une liste s'ouvre sous le champ : la bulle passe au-dessus. */
    dessusImpose?: boolean;
  } = {},
): Placement {
  const appareil = ecran.largeur >= LARGEUR_ORDINATEUR ? 'ordinateur' : 'telephone';
  const largeur = Math.min(LARGEUR_DE_BULLE[appareil], ecran.largeur - 2 * MARGE);
  const taille = TAILLE_DE_PLUMIO[appareil];
  // Plumio est retourné en arabe : pour montrer un côté de l'écran, il prend la pose de l'autre.
  const vers = (cote: 'gauche' | 'droite'): PoseDeLaMascotte =>
    (cote === 'gauche') !== rtl ? 'pointer-gauche' : 'pointer-droite';
  // Sur le bord haut, au bout de la bulle (à gauche en arabe).
  const auBout = { taille, left: rtl ? MARGE : largeur - MARGE - taille };

  if (!cible) return { mode: 'centre', largeur, plumio: { ...auBout, pose: 'explique' } };

  const droiteDeLaCible = cible.left + cible.width;
  const basDeLaCible = cible.top + cible.height;

  // À côté, sur un ordinateur : du côté de la fin de ligne, sinon dessous.
  const cote = rtl ? 'gauche' : 'droite';
  const placeACote = cote === 'droite' ? ecran.largeur - droiteDeLaCible - ECART_COTE - MARGE : cible.left - ECART_COTE - MARGE;
  if (appareil === 'ordinateur' && !surLeChamp && placeACote >= largeur) {
    // Assez haut pour que Plumio tienne au-dessus, assez bas pour qu'on lise.
    const plusHaut = MARGE + taille - 4;
    const top = borner(cible.top, plusHaut, Math.max(plusHaut, ecran.hauteur - MARGE - HAUTEUR_CONFORTABLE));
    // L'élément est du côté opposé à la bulle ; Plumio se tient près de lui.
    const coteDeLaCible = cote === 'droite' ? 'gauche' : 'droite';
    return {
      mode: 'cote',
      largeur,
      left: cote === 'droite' ? droiteDeLaCible + ECART_COTE : cible.left - ECART_COTE - largeur,
      top,
      maxHauteur: ecran.hauteur - top - MARGE,
      pointe: borner(cible.top + Math.min(cible.height, 56) / 2 - top, 18, 48),
      cote: coteDeLaCible,
      plumio: {
        taille,
        left: coteDeLaCible === 'gauche' ? 12 : largeur - 12 - taille,
        pose: vers(coteDeLaCible),
      },
    };
  }

  const centre = cible.left + cible.width / 2;
  const left = borner(centre - largeur / 2, MARGE, ecran.largeur - MARGE - largeur);
  const pointe = borner(centre - left, RETRAIT_DE_LA_POINTE, largeur - RETRAIT_DE_LA_POINTE);

  const ecartDessous = surLeChamp ? ECART_SOUS_UN_CHAMP : ECART_DESSOUS[appareil];
  // Dessus, Plumio se tient sur la bulle, ou sur le champ, entre les deux : il lui faut sa place aussi.
  const ecartDessus = surLeChamp ? TAILLE_DE_PLUMIO_SUR_UN_CHAMP[appareil] + 8 : ECART_DESSUS;
  const placeDessous = ecran.hauteur - basDeLaCible - ecartDessous - MARGE;
  const placeDessus = cible.top - ecartDessus - MARGE - (surLeChamp ? 0 : taille - 4);

  const dessous = {
    mode: 'dessous' as const,
    largeur,
    left,
    top: basDeLaCible + ecartDessous,
    maxHauteur: placeDessous,
    pointe,
    // Juste à côté de la pointe, l'aile levée vers l'élément.
    plumio: {
      taille,
      left: borner(rtl ? pointe + 6 : pointe - 6 - taille, 0, largeur - taille),
      pose: 'pointer-haut' as const,
    },
  };
  const dessus = {
    mode: 'dessus' as const,
    largeur,
    left,
    bottom: ecran.hauteur - cible.top + ecartDessus,
    maxHauteur: placeDessus,
    pointe,
    // Au coin, un peu au-delà : son aile descend le long de la bulle vers l'élément.
    plumio: { taille, left: rtl ? -18 : largeur + 18 - taille, pose: 'pointer-bas' as const },
  };

  // Au-dessus seulement si la bulle y tient lisible ; sinon, à l'appelant de la réduire.
  if (dessusImpose && placeDessus >= HAUTEUR_MINIMALE * 0.8) return dessus;
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
    plumio: { ...auBout, pose: 'explique' },
  };
}

/**
 * L'élément est-il visible en entier ? Sinon on le fait venir au milieu de
 * l'écran avant d'en parler.
 */
export function estEnVue(cible: Rectangle, ecran: Ecran): boolean {
  return cible.top >= 0 && cible.top + cible.height <= ecran.hauteur;
}
