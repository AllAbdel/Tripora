import { useSyncExternalStore } from 'react';

/**
 * Le clavier du téléphone est-il probablement ouvert ?
 *
 * Quand on écrit, la barre d'onglets du bas n'a rien à faire à l'écran : le
 * clavier réduit la page de moitié, et la barre remonte au-dessus de lui,
 * posée sur le champ qu'on remplit ou sur le bouton qui l'envoie. On la
 * retire tant qu'un champ de texte a le focus, sur un écran tactile.
 *
 * Aucune API ne dit franchement « le clavier est ouvert » partout. Le focus
 * d'un champ de saisie sur un écran tactile en est le signe le plus sûr, et
 * il ne se trompe que dans le bon sens : un clavier physique branché sur une
 * tablette cache la barre le temps d'écrire, sans rien empêcher.
 */

/** Les champs qui ouvrent le clavier ; une date ou une case à cocher, non. */
const TYPES_AU_CLAVIER = new Set(['text', 'search', 'email', 'url', 'tel', 'password', 'number']);

export function ouvreLeClavier(element: Element | null): boolean {
  if (!element) return false;
  if (element instanceof HTMLTextAreaElement) return !element.readOnly && !element.disabled;
  if (element instanceof HTMLInputElement) {
    return TYPES_AU_CLAVIER.has(element.type) && !element.readOnly && !element.disabled;
  }
  return element instanceof HTMLElement && element.isContentEditable === true;
}

function tactile(): boolean {
  return typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches === true;
}

function abonner(rappel: () => void): () => void {
  if (typeof document === 'undefined') return () => {};
  // En passant d'un champ au suivant, le focus quitte le premier avant
  // d'arriver au second : sans ce délai, la barre réapparaîtrait le temps
  // d'une image, entre les deux.
  let attente: ReturnType<typeof setTimeout> | undefined;
  const differe = () => {
    clearTimeout(attente);
    attente = setTimeout(rappel, 50);
  };
  document.addEventListener('focusin', rappel);
  document.addEventListener('focusout', differe);
  return () => {
    clearTimeout(attente);
    document.removeEventListener('focusin', rappel);
    document.removeEventListener('focusout', differe);
  };
}

function lire(): boolean {
  return typeof document !== 'undefined' && tactile() && ouvreLeClavier(document.activeElement);
}

export function useClavierOuvert(): boolean {
  return useSyncExternalStore(abonner, lire, () => false);
}
