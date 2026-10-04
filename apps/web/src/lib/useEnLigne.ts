import { useSyncExternalStore } from 'react';

/**
 * L'appareil a-t-il du réseau ?
 *
 * `navigator.onLine` est réputé menteur — il dit « en ligne » dès qu'une
 * interface réseau existe, même derrière un portail captif d'hôtel. Il est
 * fiable dans l'autre sens, en revanche : quand il dit « hors ligne », il l'est
 * vraiment. C'est exactement l'usage qu'on en fait, et le seul qu'on puisse en
 * faire honnêtement — prévenir, jamais rassurer.
 *
 * `useSyncExternalStore` plutôt qu'un `useState` synchronisé dans un effet :
 * c'est l'outil prévu pour lire une source extérieure à React, et il évite le
 * décalage d'un rendu entre l'état réel et ce qui est affiché.
 */
function abonner(onChange: () => void): () => void {
  window.addEventListener('online', onChange);
  window.addEventListener('offline', onChange);
  return () => {
    window.removeEventListener('online', onChange);
    window.removeEventListener('offline', onChange);
  };
}

const lire = (): boolean => navigator.onLine;

/** Côté serveur il n'y a pas de `navigator` : on suppose le réseau présent. */
const lireAuServeur = (): boolean => true;

export function useEnLigne(): boolean {
  return useSyncExternalStore(abonner, lire, lireAuServeur);
}
