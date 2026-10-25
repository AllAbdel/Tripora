/**
 * Une nouvelle version a été publiée pendant que la page était ouverte.
 *
 * Chaque écran est un morceau de code chargé à la demande, et son nom change
 * à chaque publication (`Conditions-DfWGkcjC.js`). Une page ouverte avant la
 * publication réclame donc, au premier changement d'écran, un fichier qui
 * n'existe plus : « Failed to fetch dynamically imported module ». C'est
 * arrivé en production (sur /conditions), et la personne tombait sur l'écran
 * d'erreur.
 *
 * Le remède : recharger la page, une seule fois, pour prendre la nouvelle
 * version. Le garde-fou empêche une boucle de rechargements si le fichier
 * manque vraiment (serveur en panne, hors ligne) : on ne recharge pas deux fois
 * en une minute, et l'écran d'erreur prend alors le relais.
 */

const CLE = 'tripora.rechargement-pour-version';
const DELAI_MS = 60_000;

/** Les messages des navigateurs pour un morceau de code introuvable. */
const MORCEAU_PERDU =
  /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|Unable to preload CSS|Loading chunk [\w-]+ failed/iu;

export function estUnMorceauPerdu(erreur: unknown): boolean {
  const message = erreur instanceof Error ? erreur.message : typeof erreur === 'string' ? erreur : '';
  return MORCEAU_PERDU.test(message);
}

/** Recharge la page pour prendre la nouvelle version. Faux si on vient déjà de le faire. */
export function rechargerPourLaNouvelleVersion(maintenant = Date.now()): boolean {
  try {
    const precedent = Number(sessionStorage.getItem(CLE) ?? 0);
    if (maintenant - precedent < DELAI_MS) return false;
    sessionStorage.setItem(CLE, String(maintenant));
  } catch {
    // Stockage indisponible (navigation privée stricte) : sans garde-fou, on
    // ne prend pas le risque d'une boucle.
    return false;
  }
  window.location.reload();
  return true;
}

let surveille = false;

/**
 * Vite signale l'échec d'un chargement à la demande par `vite:preloadError` :
 * on recharge avant que l'écran ne tombe.
 */
export function surveillerLesNouvellesVersions(): void {
  if (surveille || typeof window === 'undefined') return;
  surveille = true;
  window.addEventListener('vite:preloadError', (evenement) => {
    if (rechargerPourLaNouvelleVersion()) evenement.preventDefault();
  });
}
