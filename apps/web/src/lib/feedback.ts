import { useTheme, type Retours } from '@/stores/theme';

/**
 * Ce que l'application renvoie quand on la touche : une vibration, un son.
 *
 * Deux partis pris.
 *
 * **Aucun fichier audio.** Les sons sont synthétisés à la volée par l'API Web
 * Audio : quelques dizaines de lignes plutôt que des kilo-octets à télécharger
 * et à garder en cache hors ligne. Ce sont des sons courts et sourds, pas des
 * jingles — un retour qu'on remarque à peine, et jamais deux fois de suite.
 *
 * **Le silence est le comportement par défaut du son.** Une application qui se
 * met à faire du bruit dans un train se fait couper le son une fois et pour
 * toujours. Les vibrations, elles, sont actives d'emblée : personne ne les
 * entend. `navigator.vibrate` n'existe pas sur iOS — l'appel est simplement
 * ignoré, et l'écran de réglages le dit plutôt que de laisser croire.
 */

export type Signal =
  /** Un choix pris en compte : sélection, bascule, envoi. */
  | 'tape'
  /** Quelque chose a abouti : voyage créé, épingle posée, application publiée. */
  | 'reussite'
  /** Quelque chose a échoué, ou est refusé. */
  | 'echec'
  /** Une décision qui engage le groupe : verrouiller, voter. */
  | 'decision';

interface Grain {
  /** Hauteur en hertz, ou une suite pour un petit arpège. */
  hauteurs: readonly number[];
  /** Durée d'un grain, en secondes. */
  duree: number;
  /** Volume de crête. Volontairement bas : c'est un retour, pas une alarme. */
  volume: number;
  /** Motif de vibration, en millisecondes. */
  vibration: number | readonly number[];
}

const GRAINS: Readonly<Record<Signal, Grain>> = {
  tape: { hauteurs: [660], duree: 0.035, volume: 0.05, vibration: 8 },
  reussite: { hauteurs: [660, 880, 1180], duree: 0.06, volume: 0.06, vibration: [14, 40, 22] },
  echec: { hauteurs: [220, 165], duree: 0.09, volume: 0.06, vibration: [26, 60, 26] },
  decision: { hauteurs: [520, 780], duree: 0.07, volume: 0.06, vibration: [12, 30, 18] },
};

let contexte: AudioContext | null = null;

/**
 * Le contexte audio, créé au premier son et pas avant.
 *
 * Les navigateurs refusent d'en ouvrir un tant que l'utilisateur n'a pas
 * interagi avec la page : le créer au chargement produirait un contexte
 * suspendu et un avertissement dans la console à chaque visite.
 */
function contexteAudio(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const Constructeur =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Constructeur) return null;

  contexte ??= new Constructeur();
  if (contexte.state === 'suspended') void contexte.resume();
  return contexte;
}

function jouer(grain: Grain): void {
  const audio = contexteAudio();
  if (!audio) return;

  grain.hauteurs.forEach((hauteur, rang) => {
    const debut = audio.currentTime + rang * grain.duree * 0.75;
    const oscillateur = audio.createOscillator();
    const gain = audio.createGain();

    // Une sinusoïde : la forme d'onde la moins agressive, sans harmoniques
    // stridentes dans un haut-parleur de téléphone.
    oscillateur.type = 'sine';
    oscillateur.frequency.setValueAtTime(hauteur, debut);

    // Attaque immédiate, extinction exponentielle : un « toc », pas un bip.
    // Sans cette enveloppe, la coupure nette produit un clic très audible.
    gain.gain.setValueAtTime(0.0001, debut);
    gain.gain.exponentialRampToValueAtTime(grain.volume, debut + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, debut + grain.duree);

    oscillateur.connect(gain).connect(audio.destination);
    oscillateur.start(debut);
    oscillateur.stop(debut + grain.duree + 0.02);
  });
}

function vibrer(motif: number | readonly number[]): void {
  if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return;
  try {
    navigator.vibrate(motif as number | number[]);
  } catch {
    // Certains navigateurs refusent la vibration hors geste utilisateur. Ce
    // n'est pas une erreur à remonter : le retour est un agrément, pas une
    // fonction.
  }
}

/** Vrai si l'utilisateur a demandé le moins d'animation possible. */
function mouvementReduit(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true
  );
}

/**
 * Émet un signal, selon ce que l'utilisateur a réglé.
 *
 * S'appelle depuis n'importe où et ne jette jamais : un retour raté ne doit
 * jamais interrompre l'action qu'il accompagne.
 */
export function signaler(signal: Signal, reglage: Retours = useTheme.getState().retours): void {
  if (reglage === 'silencieux') return;
  const grain = GRAINS[signal];

  // Le mouvement réduit couvre aussi le vestibulaire : on garde le son, qui
  // n'entre pas dans cette préférence, et on allège la vibration.
  if (!mouvementReduit()) vibrer(grain.vibration);
  if (reglage === 'complet') jouer(grain);
}

/** Pour l'écran de réglages : faire entendre et sentir ce qu'on vient de choisir. */
export function apercuDesRetours(reglage: Retours): void {
  signaler('reussite', reglage);
}

/** Vrai si l'appareil sait vibrer. Sert à ne pas promettre ce qu'iOS ne fait pas. */
export function vibrationDisponible(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';
}
