import type { Partition, Son } from './partitions';

/**
 * Les sons de l'interface, fabriqués à la volée par l'API Web Audio.
 *
 * Aucun fichier : des sinusoïdes douces, avec une harmonique discrète qui
 * s'éteint plus vite que la note — ce qui leur donne un timbre de verre plutôt
 * que de sonnerie. Rien à télécharger, rien à garder en cache, aucune licence.
 *
 * Tout est bas, court et sans surprise : une interface qu'on entend à peine.
 * Chaque note a une attaque et une extinction progressives ; une coupure nette
 * produirait un clic bien plus audible que la note elle-même. Les hauteurs
 * restent dans le médium (500 à 1 000 Hz) : assez haut pour être net sur un
 * haut-parleur de téléphone, assez bas pour ne jamais piquer l'oreille.
 *
 * Les fonctions prennent un `BaseAudioContext` : le même code sert à jouer
 * dans la page et à rendre hors ligne (`OfflineAudioContext`) pour mesurer
 * les niveaux.
 */

type Joueur = (audio: BaseAudioContext, sortie: AudioNode, quand: number, force: number) => void;

const SILENCE = 0.0001;

/** Monte en `attaque` jusqu'à `crete`, puis s'éteint en `chute` (secondes). */
function enveloppe(audio: BaseAudioContext, quand: number, crete: number, attaque: number, chute: number): GainNode {
  const gain = audio.createGain();
  gain.gain.setValueAtTime(SILENCE, quand);
  gain.gain.exponentialRampToValueAtTime(Math.max(crete, SILENCE * 2), quand + attaque);
  gain.gain.exponentialRampToValueAtTime(SILENCE, quand + attaque + chute);
  return gain;
}

/** Un oscillateur tenu `duree` secondes, avec son enveloppe. */
function oscillateur(
  audio: BaseAudioContext,
  sortie: AudioNode,
  quand: number,
  { frequence, crete, attaque, chute, type = 'sine' }: {
    frequence: number;
    crete: number;
    attaque: number;
    chute: number;
    type?: OscillatorType;
  },
): void {
  const oscillo = audio.createOscillator();
  oscillo.type = type;
  oscillo.frequency.setValueAtTime(frequence, quand);
  oscillo.connect(enveloppe(audio, quand, crete, attaque, chute)).connect(sortie);
  oscillo.start(quand);
  oscillo.stop(quand + attaque + chute + 0.03);
}

/**
 * Une note de verre : la fondamentale, et un partiel à 2,76 fois sa fréquence
 * (celui d'une lame ou d'un verre frappé), beaucoup plus faible et plus bref.
 */
function note(audio: BaseAudioContext, sortie: AudioNode, quand: number, frequence: number, force: number, chute = 0.32): void {
  oscillateur(audio, sortie, quand, { frequence, crete: 0.1 * force, attaque: 0.008, chute });
  oscillateur(audio, sortie, quand, { frequence: frequence * 2.76, crete: 0.012 * force, attaque: 0.004, chute: chute * 0.35 });
}

/** Les notes, en hertz (tempérament égal, la à 440). */
const DO5 = 523.25;
const MI5 = 659.25;
const SOL5 = 783.99;
const LA5 = 880;
const SI5 = 987.77;
const FA_DIESE5 = 739.99;
const MI_BEMOL5 = 622.25;

const JOUEURS: Readonly<Record<Son, Joueur>> = {
  apparition: (audio, sortie, quand, force) => {
    note(audio, sortie, quand, MI5, force * 0.9, 0.22);
    note(audio, sortie, quand + 0.075, SI5, force * 0.8, 0.34);
  },

  repere: (audio, sortie, quand, force) => {
    // Un tic feutré : une note très brève, sans harmonique, presque un toucher.
    oscillateur(audio, sortie, quand, { frequence: 1100, crete: 0.06 * force, attaque: 0.002, chute: 0.035 });
    oscillateur(audio, sortie, quand, { frequence: 550, crete: 0.04 * force, attaque: 0.002, chute: 0.05 });
  },

  validation: (audio, sortie, quand, force) => {
    note(audio, sortie, quand, DO5, force * 0.8, 0.18);
    note(audio, sortie, quand + 0.07, MI5, force * 0.8, 0.18);
    note(audio, sortie, quand + 0.14, SOL5, force * 0.85, 0.4);
  },

  depart: (audio, sortie, quand, force) => {
    note(audio, sortie, quand, SOL5, force * 0.7, 0.18);
    note(audio, sortie, quand + 0.08, DO5, force * 0.6, 0.3);
  },

  signal: (audio, sortie, quand, force) => {
    note(audio, sortie, quand, LA5, force * 0.75, 0.16);
    note(audio, sortie, quand + 0.12, LA5, force * 0.7, 0.28);
  },

  erreur: (audio, sortie, quand, force) => {
    note(audio, sortie, quand, FA_DIESE5, force * 0.7, 0.16);
    note(audio, sortie, quand + 0.1, MI_BEMOL5, force * 0.65, 0.3);
  },
};

/**
 * Programme une partition sur `sortie`, à partir de l'instant `zero` (en
 * secondes, horloge du contexte). Les notes déjà passées sont sautées : un son
 * en retard sur son geste sonnerait faux.
 */
export function programmerLaPartition(
  audio: BaseAudioContext,
  sortie: AudioNode,
  partition: Partition,
  zero: number,
): number {
  let jouees = 0;
  for (const element of partition) {
    const quand = zero + element.temps / 1000;
    if (quand < audio.currentTime) continue;
    JOUEURS[element.son](audio, sortie, quand, Math.min(1, element.force ?? 1));
    jouees += 1;
  }
  return jouees;
}
