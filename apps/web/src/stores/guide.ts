import { create } from 'zustand';

/**
 * Le guide de démarrage : montré une fois, rejouable à la demande.
 *
 * Deux temps (`components/guide/`) :
 * 1. **l'accueil**, en grand : Plumio se présente, de face ;
 * 2. **la visite**, sur les vraies pages : il montre comment créer un voyage,
 *    pas à pas, et c'est la personne qui appuie et qui remplit. Rien n'est
 *    créé à sa place.
 *
 * « Vu » veut dire terminé **ou** passé : quelqu'un qui appuie sur « Passer »
 * a répondu, et le lui reproposer à chaque visite serait le punir de savoir
 * déjà. Il reste accessible depuis le profil et le pied de page.
 *
 * Le souvenir tient sur l'appareil, pas sur le compte : le guide explique
 * l'interface, et c'est sur un nouvel appareil qu'on la découvre. Il survit
 * à la déconnexion (voir `stockage.ts`) — se reconnecter ne doit pas rejouer
 * un guide qu'on vient de fermer.
 *
 * La version permet de le remontrer le jour où il change vraiment : on
 * l'incrémente, et chacun le revoit une fois. Version 3 : l'accueil de Plumio
 * et la visite de la création d'un voyage, sans bouton « Suivant ».
 */

export const CLE_GUIDE_VU = 'tripora.guide-vu';
export const VERSION_DU_GUIDE = 3;

export function guideDejaVu(): boolean {
  try {
    return Number(localStorage.getItem(CLE_GUIDE_VU) ?? 0) >= VERSION_DU_GUIDE;
  } catch {
    // Stockage refusé : on ne peut pas s'en souvenir, alors on ne l'impose
    // pas — il reviendrait à chaque visite.
    return true;
  }
}

function retenirQueLeGuideEstVu(): void {
  try {
    localStorage.setItem(CLE_GUIDE_VU, String(VERSION_DU_GUIDE));
  } catch {
    /* tant pis : on aura essayé */
  }
}

/** Où en est le guide : rien, l'accueil de Plumio, ou la visite. */
export type PhaseDuGuide = 'accueil' | 'visite' | null;

interface EtatDuGuide {
  phase: PhaseDuGuide;
  /** Vrai une fois la décision prise pour cette visite du site, montré ou non. */
  decide: boolean;
  /** Ouvre le guide depuis le début, par l'accueil : c'est ce que veut « Revoir le guide ». */
  ouvrir: () => void;
  /** « C'est parti » : de l'accueil à la visite. */
  commencerLaVisite: () => void;
  /** Passé, terminé ou abandonné : vu. */
  fermer: () => void;
  /** La première visite n'appellera plus le guide d'elle-même. */
  marquerDecide: () => void;
}

export const useGuide = create<EtatDuGuide>((set) => ({
  phase: null,
  decide: false,
  ouvrir: () => set({ phase: 'accueil', decide: true }),
  commencerLaVisite: () => set({ phase: 'visite', decide: true }),
  fermer: () => {
    retenirQueLeGuideEstVu();
    set({ phase: null, decide: true });
  },
  marquerDecide: () => set({ decide: true }),
}));
