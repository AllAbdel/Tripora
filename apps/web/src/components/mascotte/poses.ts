import type { PoseDeLaMascotte } from './Mascotte';

/**
 * Les dessins, chargés à la demande : un petit fichier par pose. Tous ensemble
 * pesaient 140 Ko dans le morceau principal de l'application, téléchargés à
 * chaque première visite alors qu'un écran n'en montre qu'un. Une pose déjà
 * chargée est gardée et s'affiche aussitôt ; les autres arrivent en tâche de
 * fond dès qu'une première mascotte apparaît (`prechargerLaMascotte`).
 */
const CHARGEURS = import.meta.glob<string>('../../../../../design/mascotte/poses/*.svg', {
  query: '?raw',
  import: 'default',
});
const CHARGES = new Map<string, string>();

function nettoyer(brut: string): string {
  // La taille vient du conteneur ; le `xmlns` ne sert à rien dans du HTML.
  return brut.replace(' xmlns="http://www.w3.org/2000/svg"', '').replace('<svg ', '<svg width="100%" height="100%" ');
}

/** Le dessin d'une pose déjà chargée, ou `undefined`. */
export function poseChargee(pose: PoseDeLaMascotte): string | undefined {
  return CHARGES.get(pose);
}

/** Le dessin d'une pose, chargé une fois puis gardé. */
export function chargerLaPose(pose: PoseDeLaMascotte): Promise<string> {
  const deja = CHARGES.get(pose);
  if (deja !== undefined) return Promise.resolve(deja);
  const charger = CHARGEURS[`../../../../../design/mascotte/poses/${pose}.svg`];
  if (!charger) return Promise.resolve('');
  return charger().then((brut) => {
    const propre = nettoyer(brut);
    CHARGES.set(pose, propre);
    return propre;
  });
}

let prechargee = false;

/** Toutes les poses, quand le navigateur n'a rien de mieux à faire. */
export function prechargerLaMascotte(): void {
  if (prechargee || typeof window === 'undefined') return;
  prechargee = true;
  const tout = () =>
    Object.keys(CHARGEURS).forEach((chemin) => {
      const pose = chemin.replace(/^.*\/(.+)\.svg$/u, '$1') as PoseDeLaMascotte;
      void chargerLaPose(pose).catch(() => undefined);
    });
  // Safari n'a pas requestIdleCallback : un délai fait l'affaire.
  if (typeof window.requestIdleCallback === 'function') window.requestIdleCallback(tout, { timeout: 4000 });
  else globalThis.setTimeout(tout, 1500);
}
