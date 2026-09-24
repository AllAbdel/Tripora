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

/**
 * L'état partagé, et le délai au retour.
 *
 * La barre se retire dès qu'un champ prend le focus, mais ne revient qu'un
 * instant après qu'il l'a perdu. Revenir tout de suite volait le geste : en
 * touchant « Envoyer » clavier ouvert, le focus quitte le champ à l'appui du
 * doigt, la barre réapparaît à l'endroit même où il se pose, et le relâcher
 * tombe sur elle — le bouton ne reçoit jamais le clic. Le délai couvre aussi
 * le passage d'un champ au suivant, sans clignotement entre les deux.
 */
const DELAI_DE_RETOUR_MS = 300;
let ouvert = false;
let attente: ReturnType<typeof setTimeout> | undefined;
const abonnes = new Set<() => void>();

function recalculer(): void {
  const suivant = typeof document !== 'undefined' && tactile() && ouvreLeClavier(document.activeElement);
  if (suivant === ouvert) return;
  ouvert = suivant;
  for (const rappel of abonnes) rappel();
}

function surFocus(): void {
  clearTimeout(attente);
  if (tactile() && ouvreLeClavier(document.activeElement)) recalculer();
  else attente = setTimeout(recalculer, DELAI_DE_RETOUR_MS);
}

function surPerte(): void {
  clearTimeout(attente);
  attente = setTimeout(recalculer, DELAI_DE_RETOUR_MS);
}

function abonner(rappel: () => void): () => void {
  if (typeof document === 'undefined') return () => {};
  if (abonnes.size === 0) {
    document.addEventListener('focusin', surFocus);
    document.addEventListener('focusout', surPerte);
    recalculer();
  }
  abonnes.add(rappel);
  return () => {
    abonnes.delete(rappel);
    if (abonnes.size === 0) {
      clearTimeout(attente);
      document.removeEventListener('focusin', surFocus);
      document.removeEventListener('focusout', surPerte);
    }
  };
}

function lire(): boolean {
  return ouvert;
}

export function useClavierOuvert(): boolean {
  return useSyncExternalStore(abonner, lire, () => false);
}
