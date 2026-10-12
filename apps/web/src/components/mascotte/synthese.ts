import type { Partition, Son } from './partitions';

/**
 * Les sons de Plumio, fabriqués à la volée par l'API Web Audio.
 *
 * Aucun fichier : un souffle filtré pour les ailes et les plumes, des
 * sinusoïdes qui glissent pour les pépiements, un clic boisé pour le bec.
 * Rien à télécharger, rien à garder en cache, aucune licence à suivre — et un
 * son qui varie un peu à chaque fois, comme un vrai oiseau.
 *
 * Tout est volontairement bas et court : c'est un petit oiseau, pas une
 * alarme. Chaque son a une attaque et une extinction progressives ; une coupure
 * nette produirait un clic bien plus audible que le son lui-même.
 *
 * Les fonctions prennent un `BaseAudioContext` : le même code sert à jouer
 * dans la page et à rendre hors ligne (`OfflineAudioContext`) pour mesurer
 * les niveaux.
 */

interface Reglage {
  force: number;
  hauteur: number;
}

type Joueur = (audio: BaseAudioContext, sortie: AudioNode, quand: number, reglage: Reglage) => void;

const SILENCE = 0.0001;

const BRUITS = new WeakMap<BaseAudioContext, AudioBuffer>();

/** Une seconde de bruit blanc, fabriquée une fois par contexte. */
function bruitBlanc(audio: BaseAudioContext): AudioBuffer {
  let tampon = BRUITS.get(audio);
  if (!tampon) {
    tampon = audio.createBuffer(1, audio.sampleRate, audio.sampleRate);
    const echantillons = tampon.getChannelData(0);
    for (let i = 0; i < echantillons.length; i += 1) echantillons[i] = Math.random() * 2 - 1;
    BRUITS.set(audio, tampon);
  }
  return tampon;
}

/** Un morceau de bruit, pris à un endroit différent à chaque fois. */
function souffle(audio: BaseAudioContext, quand: number, duree: number): AudioBufferSourceNode {
  const source = audio.createBufferSource();
  source.buffer = bruitBlanc(audio);
  const decalage = Math.random() * Math.max(0, source.buffer.duration - duree - 0.05);
  source.start(quand, decalage, duree + 0.03);
  return source;
}

/** Monte en `attaque` jusqu'à `crete`, puis s'éteint en `chute` (secondes). */
function enveloppe(audio: BaseAudioContext, quand: number, crete: number, attaque: number, chute: number): GainNode {
  const gain = audio.createGain();
  gain.gain.setValueAtTime(SILENCE, quand);
  gain.gain.exponentialRampToValueAtTime(Math.max(crete, SILENCE * 2), quand + attaque);
  gain.gain.exponentialRampToValueAtTime(SILENCE, quand + attaque + chute);
  return gain;
}

function filtre(audio: BaseAudioContext, type: BiquadFilterType, frequence: number, q = 0.7): BiquadFilterNode {
  const noeud = audio.createBiquadFilter();
  noeud.type = type;
  noeud.frequency.value = frequence;
  noeud.Q.value = q;
  return noeud;
}

/** Une sinusoïde qui glisse de `de` à `a` hertz, avec son enveloppe. */
function glissando(
  audio: BaseAudioContext,
  sortie: AudioNode,
  quand: number,
  { de, a, duree, crete, attaque = 0.006 }: { de: number; a: number; duree: number; crete: number; attaque?: number },
): OscillatorNode {
  const oscillateur = audio.createOscillator();
  oscillateur.type = 'sine';
  oscillateur.frequency.setValueAtTime(de, quand);
  oscillateur.frequency.exponentialRampToValueAtTime(a, quand + duree);
  oscillateur.connect(enveloppe(audio, quand, crete, attaque, duree)).connect(sortie);
  oscillateur.start(quand);
  oscillateur.stop(quand + attaque + duree + 0.03);
  return oscillateur;
}

/**
 * Un chant d'oiseau : la note glisse, tremble un peu (un oiseau ne tient
 * jamais une note pure), avec une pointe d'harmonique pour le timbre.
 */
function chant(audio: BaseAudioContext, sortie: AudioNode, quand: number, de: number, a: number, duree: number, force: number): void {
  const note = glissando(audio, sortie, quand, { de, a, duree, crete: 0.11 * force });
  const tremblement = audio.createOscillator();
  tremblement.frequency.value = 34 + Math.random() * 10;
  const profondeur = audio.createGain();
  profondeur.gain.value = de * 0.025;
  tremblement.connect(profondeur).connect(note.frequency);
  tremblement.start(quand);
  tremblement.stop(quand + duree + 0.04);
  glissando(audio, sortie, quand, { de: de * 2, a: a * 2, duree: duree * 0.8, crete: 0.012 * force });
}

const JOUEURS: Readonly<Record<Son, Joueur>> = {
  battement: (audio, sortie, quand, { force, hauteur }) => {
    const duree = 0.11;
    // Le souffle de l'aile : une bande qui descend, « fffp ».
    const bande = filtre(audio, 'bandpass', 1900 * hauteur, 0.9);
    bande.frequency.setValueAtTime(1900 * hauteur, quand);
    bande.frequency.exponentialRampToValueAtTime(800 * hauteur, quand + duree);
    souffle(audio, quand, duree).connect(bande).connect(enveloppe(audio, quand, 0.38 * force, 0.012, 0.09)).connect(sortie);
    // Le corps du coup d'aile, plus grave et plus court.
    souffle(audio, quand, 0.08)
      .connect(filtre(audio, 'lowpass', 420))
      .connect(enveloppe(audio, quand, 0.28 * force, 0.01, 0.06))
      .connect(sortie);
  },

  pepie: (audio, sortie, quand, { force, hauteur }) =>
    chant(audio, sortie, quand, 2700 * hauteur, 4100 * hauteur, 0.075, force),

  piou: (audio, sortie, quand, { force, hauteur }) =>
    chant(audio, sortie, quand, 3900 * hauteur, 2300 * hauteur, 0.12, force),

  trille: (audio, sortie, quand, { force, hauteur }) => {
    [3000, 3700, 3300, 4200].forEach((note, rang) =>
      chant(audio, sortie, quand + rang * 0.055, note * hauteur, note * 1.18 * hauteur, 0.045, force * 0.85),
    );
  },

  bec: (audio, sortie, quand, { force, hauteur }) => {
    // Le claquement, très bref…
    souffle(audio, quand, 0.03)
      .connect(filtre(audio, 'bandpass', 3400 * hauteur, 2.2))
      .connect(enveloppe(audio, quand, 0.6 * force, 0.002, 0.022))
      .connect(sortie);
    // … et le « toc » boisé qui le suit.
    glissando(audio, sortie, quand, { de: 1800 * hauteur, a: 1250 * hauteur, duree: 0.03, crete: 0.07 * force, attaque: 0.002 });
  },

  saut: (audio, sortie, quand, reglage) => {
    glissando(audio, sortie, quand, { de: 300 * reglage.hauteur, a: 650 * reglage.hauteur, duree: 0.07, crete: 0.09 * reglage.force, attaque: 0.01 });
    JOUEURS.battement(audio, sortie, quand, { force: reglage.force * 0.4, hauteur: reglage.hauteur * 1.25 });
  },

  atterrit: (audio, sortie, quand, { force, hauteur }) => {
    // Un petit « pof » sourd…
    glissando(audio, sortie, quand, { de: 170 * hauteur, a: 75 * hauteur, duree: 0.1, crete: 0.13 * force, attaque: 0.004 });
    // … et les pattes qui touchent.
    souffle(audio, quand, 0.06)
      .connect(filtre(audio, 'lowpass', 900))
      .connect(enveloppe(audio, quand, 0.28 * force, 0.003, 0.05))
      .connect(sortie);
  },

  froisse: (audio, sortie, quand, { force, hauteur }) => {
    const duree = 0.2;
    const bande = filtre(audio, 'bandpass', 700 * hauteur, 0.7);
    bande.frequency.setValueAtTime(700 * hauteur, quand);
    bande.frequency.exponentialRampToValueAtTime(2200 * hauteur, quand + duree);
    souffle(audio, quand, duree).connect(bande).connect(enveloppe(audio, quand, 0.4 * force, 0.03, 0.17)).connect(sortie);
  },

  tapote: (audio, sortie, quand, { force, hauteur }) => {
    souffle(audio, quand, 0.04)
      .connect(filtre(audio, 'lowpass', 1300 * hauteur))
      .connect(enveloppe(audio, quand, 0.5 * force, 0.002, 0.035))
      .connect(sortie);
    glissando(audio, sortie, quand, { de: 650 * hauteur, a: 560 * hauteur, duree: 0.03, crete: 0.04 * force, attaque: 0.002 });
  },

  chut: (audio, sortie, quand, { force }) => {
    souffle(audio, quand, 0.36)
      .connect(filtre(audio, 'highpass', 2800))
      .connect(filtre(audio, 'bandpass', 4500, 0.5))
      .connect(enveloppe(audio, quand, 0.14 * force, 0.07, 0.28))
      .connect(sortie);
  },

  bulle: (audio, sortie, quand, { force, hauteur }) => {
    glissando(audio, sortie, quand, { de: 650 * hauteur, a: 1050 * hauteur, duree: 0.06, crete: 0.08 * force });
  },
};

/** Un peu de variation, pour que deux coups d'aile ne soient jamais identiques. */
function varier(force: number, hauteur: number, aleatoire: () => number): Reglage {
  return {
    force: Math.min(1, force * (0.9 + aleatoire() * 0.15)),
    hauteur: hauteur * (0.96 + aleatoire() * 0.08),
  };
}

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
  aleatoire: () => number = Math.random,
): number {
  let jouees = 0;
  for (const note of partition) {
    const quand = zero + note.temps / 1000;
    if (quand < audio.currentTime) continue;
    JOUEURS[note.son](audio, sortie, quand, varier(note.force ?? 1, note.hauteur ?? 1, aleatoire));
    jouees += 1;
  }
  return jouees;
}
