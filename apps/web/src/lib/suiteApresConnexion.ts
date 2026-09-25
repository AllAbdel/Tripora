/**
 * Où reprendre, une fois connecté.
 *
 * L'accueil est ouvert à tous ; la connexion n'est demandée qu'au moment d'agir
 * — créer un trip, ouvrir un voyage. Quelqu'un qui clique « Créer un voyage »
 * doit donc arriver, connexion faite, sur la création, et pas sur une liste
 * vide où chercher le bouton une seconde fois.
 *
 * L'adresse est gardée le temps de l'onglet, parce que le passage chez Google
 * quitte la page : l'adresse de retour, elle, est toujours la même (/voyages).
 * Elle expire au bout d'une demi-heure : une connexion abandonnée hier ne doit
 * pas détourner la visite d'aujourd'hui.
 */

const CLE = 'tripora.suite-apres-connexion';
const DUREE_MS = 30 * 60 * 1000;

/**
 * Une adresse de l'application, et rien d'autre.
 *
 * La suite finit dans `navigate` : elle ne doit jamais pouvoir mener sur un
 * autre site. `//exemple.com` et `/\exemple.com` sont des adresses absolues
 * pour un navigateur, alors qu'elles commencent par une barre.
 */
export function estUneSuiteSure(chemin: string): boolean {
  return /^\/(?![/\\])/u.test(chemin) && !/[\s]/u.test(chemin) && chemin.length <= 512;
}

export function retenirLaSuite(chemin: string, maintenant = Date.now()): void {
  if (!estUneSuiteSure(chemin)) return;
  try {
    sessionStorage.setItem(CLE, JSON.stringify({ chemin, jusqua: maintenant + DUREE_MS }));
  } catch {
    // Stockage refusé : on arrivera sur la liste des voyages, c'est tout.
  }
}

/** La suite attendue, une seule fois : la lire l'efface. */
export function prendreLaSuite(maintenant = Date.now()): string | null {
  const suite = lireLaSuite(maintenant);
  oublierLaSuite();
  return suite;
}

/**
 * La suite attendue, sans l'effacer : pour un rendu, que React peut jouer
 * deux fois. L'effacement se fait ensuite, dans un effet.
 */
export function lireLaSuite(maintenant = Date.now()): string | null {
  try {
    const brut = sessionStorage.getItem(CLE);
    if (!brut) return null;
    const { chemin, jusqua } = JSON.parse(brut) as { chemin?: unknown; jusqua?: unknown };
    if (typeof chemin !== 'string' || typeof jusqua !== 'number') return null;
    if (jusqua < maintenant || !estUneSuiteSure(chemin)) return null;
    return chemin;
  } catch {
    return null;
  }
}

/** Oublier la suite : rejoindre un voyage par un code n'est pas « créer ». */
export function oublierLaSuite(): void {
  try {
    sessionStorage.removeItem(CLE);
  } catch {
    /* rien à effacer */
  }
}
