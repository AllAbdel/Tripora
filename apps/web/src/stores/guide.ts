import { create } from 'zustand';

/**
 * Le guide de démarrage : montré une fois, rejouable à la demande.
 *
 * Une fois connecté, c'est une visite guidée sur les vraies pages
 * (`components/guide/VisiteGuidee.tsx`) ; sans compte, le diaporama, puisque
 * ces pages demandent un compte.
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
 * l'incrémente, et chacun le revoit une fois. Version 2 : le diaporama est
 * devenu une visite des vraies pages.
 */

export const CLE_GUIDE_VU = 'tripora.guide-vu';
export const VERSION_DU_GUIDE = 2;

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

/**
 * Où en est la visite, pour la reprendre.
 *
 * - Une visite interrompue (l'application fermée en route) reprend à l'arrêt
 *   où elle s'était arrêtée, dans la journée.
 * - Sans voyage, la visite s'arrête sur « Créez votre premier voyage » et
 *   attend : à la première arrivée dans un voyage, dans la semaine, elle
 *   reprend là, dans ce voyage.
 *
 * Effacée à la déconnexion, comme tout ce qui touche aux voyages d'un compte.
 */
export const CLE_REPRISE_DE_LA_VISITE = 'tripora.visite';
const DUREE_D_UNE_REPRISE = 24 * 60 * 60 * 1000;
const DUREE_D_UNE_ATTENTE = 7 * 24 * 60 * 60 * 1000;

export type RepriseDeLaVisite =
  | { etat: 'en-cours'; arret: string; voyageId: string | null; le: number }
  | { etat: 'attend-un-voyage'; le: number };

export function lireLaReprise(maintenant = Date.now()): RepriseDeLaVisite | null {
  try {
    const brute = localStorage.getItem(CLE_REPRISE_DE_LA_VISITE);
    if (!brute) return null;
    const reprise = JSON.parse(brute) as RepriseDeLaVisite;
    const duree = reprise.etat === 'attend-un-voyage' ? DUREE_D_UNE_ATTENTE : DUREE_D_UNE_REPRISE;
    if (typeof reprise.le !== 'number' || maintenant - reprise.le > duree) {
      oublierLaReprise();
      return null;
    }
    return reprise;
  } catch {
    return null;
  }
}

export function retenirLaReprise(reprise: RepriseDeLaVisite): void {
  try {
    localStorage.setItem(CLE_REPRISE_DE_LA_VISITE, JSON.stringify(reprise));
  } catch {
    /* sans stockage, la visite recommencera au début : ce n'est pas grave */
  }
}

export function oublierLaReprise(): void {
  try {
    localStorage.removeItem(CLE_REPRISE_DE_LA_VISITE);
  } catch {
    /* rien de plus à faire */
  }
}

/** D'où part la visite qu'on ouvre. */
export interface DepartDeLaVisite {
  arret?: string;
  voyageId?: string;
  /**
   * On est déjà dans ce voyage (on vient de le créer, ou d'y arriver) : la
   * visite le montre sans repasser par « Nouveau ».
   */
  dansLeVoyage?: boolean;
}

interface EtatDuGuide {
  ouvert: boolean;
  /** Vrai une fois la décision prise pour cette visite, montrée ou non. */
  decide: boolean;
  depart: DepartDeLaVisite;
  /** Ouvre le guide depuis le début : c'est ce que veut « Revoir le guide ». */
  ouvrir: () => void;
  /** Reprend une visite là où elle en était. */
  reprendre: (depart: DepartDeLaVisite) => void;
  fermer: () => void;
  /**
   * Ferme la visite le temps de créer un premier voyage : elle reprendra
   * dedans. Compte comme vue — on ne la reproposera pas à qui ne crée rien.
   */
  attendreUnVoyage: () => void;
  /** La première visite n'appellera plus le guide d'elle-même. */
  marquerDecide: () => void;
}

export const useGuide = create<EtatDuGuide>((set) => ({
  ouvert: false,
  decide: false,
  depart: {},
  ouvrir: () => {
    oublierLaReprise();
    set({ ouvert: true, decide: true, depart: {} });
  },
  reprendre: (depart) => set({ ouvert: true, decide: true, depart }),
  fermer: () => {
    retenirQueLeGuideEstVu();
    oublierLaReprise();
    set({ ouvert: false, decide: true, depart: {} });
  },
  attendreUnVoyage: () => {
    retenirQueLeGuideEstVu();
    retenirLaReprise({ etat: 'attend-un-voyage', le: Date.now() });
    set({ ouvert: false, decide: true, depart: {} });
  },
  marquerDecide: () => set({ decide: true }),
}));
