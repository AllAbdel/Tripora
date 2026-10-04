import { useSyncExternalStore } from 'react';

/**
 * L'écran est-il celui d'un ordinateur ?
 *
 * Le même seuil que la classe `lg:` de Tailwind (1 024 px). La barre latérale
 * n'est pas seulement masquée en dessous : elle n'est pas rendue du tout. Une
 * navigation cachée restait dans la page, avec ses listes et ses liens, et la
 * requête du voyage qu'elle affiche — du poids pour rien sur un téléphone, et
 * une seconde liste que tout ce qui cherchait « la première liste de la
 * page » trouvait avant celle de l'écran.
 */
const REQUETE = '(min-width: 1024px)';

function abonner(rappel: () => void): () => void {
  if (typeof window === 'undefined' || !window.matchMedia) return () => {};
  const media = window.matchMedia(REQUETE);
  media.addEventListener('change', rappel);
  return () => media.removeEventListener('change', rappel);
}

function lire(): boolean {
  return typeof window !== 'undefined' && window.matchMedia?.(REQUETE).matches === true;
}

export function useEcranLarge(): boolean {
  return useSyncExternalStore(abonner, lire, () => false);
}
