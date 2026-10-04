import { create } from 'zustand';

/**
 * Le guide de démarrage : montré une fois, rejouable à la demande.
 *
 * « Vu » veut dire lu jusqu'au bout **ou** passé : quelqu'un qui appuie sur
 * « Passer » a répondu, et le lui reproposer à chaque visite serait le punir
 * de savoir déjà. Il reste accessible depuis le profil et le pied de page.
 *
 * Le souvenir tient sur l'appareil, pas sur le compte : le guide explique
 * l'interface, et c'est sur un nouvel appareil qu'on la découvre. Il survit
 * à la déconnexion (voir `stockage.ts`) — se reconnecter ne doit pas rejouer
 * un guide qu'on vient de fermer.
 *
 * La version permet de le remontrer le jour où il change vraiment : on
 * l'incrémente, et chacun le revoit une fois.
 */

export const CLE_GUIDE_VU = 'tripora.guide-vu';
export const VERSION_DU_GUIDE = 1;

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

interface EtatDuGuide {
  ouvert: boolean;
  /** Vrai une fois la décision prise pour cette visite, montrée ou non. */
  decide: boolean;
  ouvrir: () => void;
  fermer: () => void;
  /** La première visite n'appellera plus le guide d'elle-même. */
  marquerDecide: () => void;
}

export const useGuide = create<EtatDuGuide>((set) => ({
  ouvert: false,
  decide: false,
  ouvrir: () => set({ ouvert: true, decide: true }),
  fermer: () => {
    retenirQueLeGuideEstVu();
    set({ ouvert: false, decide: true });
  },
  marquerDecide: () => set({ decide: true }),
}));
