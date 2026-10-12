import { audioEnMarche, contexteAudio } from '@/lib/audio';
import { estNatif } from '@/lib/natif';
import { useTheme } from '@/stores/theme';
import { PARTITIONS, type MomentDePlumio } from './partitions';
import { programmerLaPartition } from './synthese';

/**
 * Les bruitages de Plumio : quand il arrive, salue, parle, picore, sautille.
 *
 * Ce qui décide s'il fait du bruit, dans l'ordre :
 *
 * - **le réglage** « Bruitages de Plumio » du profil, actif par défaut — il
 *   n'apparaît pas souvent, et un oiseau muet ne colle pas au personnage. Les
 *   retours réglés sur « Rien » le font taire aussi ;
 * - **le mouvement** : sans animation (mouvement réduit), pas de bruitage —
 *   le son accompagne le geste, il ne le remplace pas ;
 * - **la page visible** : rien dans un onglet en arrière-plan ;
 * - **le navigateur** : tant que la personne n'a pas touché la page, il
 *   refuse tout son. On n'insiste pas (ce serait un avertissement dans la
 *   console à chaque visite) ; l'application installée et l'application
 *   mobile, elles, ont le droit de jouer dès l'ouverture.
 *
 * Un son qui ne peut pas partir à l'heure ne part pas : un battement d'aile
 * une seconde après le geste sonnerait faux.
 */

/** Le volume d'ensemble : bas. C'est un petit oiseau. */
const VOLUME = 0.5;
/** Au-delà de ce retard, on renonce : le son ne collerait plus au geste. */
const RETARD_MAX = 200;

const rien = () => undefined;

function mouvementReduit(): boolean {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}

/** Le navigateur laissera-t-il jouer un son maintenant ? */
function sonAutorise(): boolean {
  if (audioEnMarche() || estNatif) return true;
  // Installée (écran d'accueil, application de bureau) : le son est permis d'emblée.
  if (window.matchMedia?.('(display-mode: standalone)').matches) return true;
  const activation = (navigator as Navigator & { userActivation?: { hasBeenActive: boolean } }).userActivation;
  return activation ? activation.hasBeenActive : true;
}

/** Vrai si Plumio peut faire du bruit maintenant. Exporté pour les tests. */
export function bruitagesPermis(): boolean {
  if (typeof window === 'undefined' || typeof document === 'undefined') return false;
  const { bruitagesPlumio, retours } = useTheme.getState();
  if (!bruitagesPlumio || retours === 'silencieux') return false;
  if (document.visibilityState === 'hidden' || mouvementReduit()) return false;
  return sonAutorise();
}

/**
 * Joue la partition d'un moment de Plumio, calée sur le début de son geste.
 *
 * Renvoie de quoi la couper : un geste interrompu (la fenêtre se ferme, un
 * autre geste commence) emporte son son avec lui. Ne jette jamais : un
 * bruitage raté ne doit rien casser.
 */
export function bruiter(moment: MomentDePlumio): () => void {
  const partition = PARTITIONS[moment];
  if (!partition || partition.length === 0) return rien;
  try {
    if (!bruitagesPermis()) return rien;
    const audio = contexteAudio();
    if (!audio) return rien;

    const debut = performance.now();
    let piste: GainNode | null = null;
    let coupe = false;

    const lancer = () => {
      const retard = performance.now() - debut;
      if (coupe || retard > RETARD_MAX) return;
      piste = audio.createGain();
      piste.gain.value = VOLUME;
      piste.connect(audio.destination);
      // Le zéro de la partition, c'est le début du geste, même si le
      // contexte a mis quelques millisecondes à démarrer.
      programmerLaPartition(audio, piste, partition, audio.currentTime + 0.005 - retard / 1000);
    };

    if (audio.state === 'running') lancer();
    else void audio.resume().then(lancer, rien);

    return () => {
      coupe = true;
      const ecoute = piste;
      if (!ecoute) return;
      // Un fondu de quelques millisecondes : couper net claquerait.
      ecoute.gain.setTargetAtTime(0, audio.currentTime, 0.015);
      window.setTimeout(() => ecoute.disconnect(), 120);
    };
  } catch {
    return rien;
  }
}

let prepare = false;

/**
 * Prépare le son au premier appui, tant que Plumio est à l'écran.
 *
 * Safari ne démarre un contexte audio que pendant un geste de la personne :
 * créé plus tard, au moment où Plumio bouge, il resterait suspendu, et Plumio
 * muet. On l'ouvre donc dans le premier appui venu — seulement si ses
 * bruitages sont actifs, et seulement une fois.
 */
export function preparerAuPremierGeste(): void {
  if (prepare || typeof window === 'undefined') return;
  prepare = true;
  const evenements = ['pointerdown', 'keydown', 'touchend'] as const;
  const deverrouiller = () => {
    evenements.forEach((nom) => window.removeEventListener(nom, deverrouiller, true));
    const { bruitagesPlumio, retours } = useTheme.getState();
    if (bruitagesPlumio && retours !== 'silencieux') contexteAudio();
  };
  evenements.forEach((nom) => window.addEventListener(nom, deverrouiller, { capture: true, passive: true }));
}

/**
 * Pour le profil : faire entendre Plumio au moment où l'on active ses
 * bruitages. Appelé depuis un clic, donc toujours permis par le navigateur.
 */
export function ecouterPlumio(): void {
  bruiter('content');
}
