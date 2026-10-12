/**
 * Le contexte audio de Tripora : un seul pour toute l'application.
 *
 * Partagé par les retours sous le doigt (`feedback.ts`) et les bruitages de
 * Plumio (`components/mascotte/bruitages.ts`) : les navigateurs limitent le
 * nombre de contextes, et chacun doit être « déverrouillé » par un geste de la
 * personne avant de faire le moindre bruit.
 */

let contexte: AudioContext | null = null;

/**
 * Le contexte audio, créé au premier son et pas avant.
 *
 * Les navigateurs refusent d'en ouvrir un tant que l'utilisateur n'a pas
 * interagi avec la page : le créer au chargement produirait un contexte
 * suspendu et un avertissement dans la console à chaque visite.
 */
export function contexteAudio(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const Constructeur =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Constructeur) return null;

  contexte ??= new Constructeur();
  if (contexte.state === 'suspended') void contexte.resume().catch(() => undefined);
  return contexte;
}

/** Le contexte existe et joue déjà : un son programmé maintenant partira à l'heure. */
export function audioEnMarche(): boolean {
  return contexte?.state === 'running';
}
