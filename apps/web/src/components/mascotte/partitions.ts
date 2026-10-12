import type { GesteDePlumio, PoseDeLaMascotte } from './Mascotte';

/**
 * Ce que Plumio fait entendre, geste par geste.
 *
 * Chaque partition est calée sur les images clés de
 * `design/mascotte/animations.css` : un battement d'aile tombe sur un coup
 * d'aile, un coup de bec sur la frappe de la tête, l'atterrissage sur
 * l'écrasement à la réception. Changer la durée d'un geste dans la feuille,
 * c'est changer sa partition ici.
 *
 * C'est un petit oiseau : des sons courts, légers, jamais deux gros d'affilée.
 */

/** Les sons de Plumio, tous synthétisés (voir `synthese.ts`). */
export type Son =
  /** Un coup d'aile : un souffle bref, du grave vers l'aigu léger. */
  | 'battement'
  /** Un pépiement qui monte : « tuit ». */
  | 'pepie'
  /** Un pépiement qui descend : « piou ». */
  | 'piou'
  /** Quatre notes rapides et gaies : « tirili ». */
  | 'trille'
  /** Un coup de bec sec : « toc ». */
  | 'bec'
  /** L'impulsion d'un saut. */
  | 'saut'
  /** Les pattes qui retrouvent le sol, tout doux. */
  | 'atterrit'
  /** Un froissement : des plumes qui tournent, une carte qu'on déplie. */
  | 'froisse'
  /** L'aile qui tapote, à peine. */
  | 'tapote'
  /** « Chut ». */
  | 'chut'
  /** Une bulle de pensée qui éclôt. */
  | 'bulle';

export interface Note {
  /** Quand, en millisecondes depuis le début du geste. */
  temps: number;
  son: Son;
  /** De 0 à 1 : la force du geste. 1 par défaut. */
  force?: number;
  /** Multiplie la hauteur : au-dessus de 1, plus aigu. 1 par défaut. */
  hauteur?: number;
}

export type Partition = readonly Note[];

/** Ce qui fait jouer une partition : un geste, un passage, ou le geste propre d'une pose. */
export type MomentDePlumio = GesteDePlumio | 'atterrit' | 'sort' | `joue:${PoseDeLaMascotte}`;

/** Des battements réguliers, de plus en plus légers. */
function battements(temps: readonly number[], depart = 0.9, fin = 0.5, hauteur = 1): Note[] {
  return temps.map((t, rang) => ({
    temps: t,
    son: 'battement',
    force: depart + ((fin - depart) * rang) / Math.max(1, temps.length - 1),
    hauteur,
  }));
}

export const PARTITIONS: Readonly<Partial<Record<MomentDePlumio, Partition>>> = {
  // Il descend en battant des ailes (un coup tous les 12 % de 1 100 ms), se
  // pose à 66 % et s'écrase un peu à 72 %.
  arrive: [...battements([0, 132, 264, 396, 528], 0.9, 0.5), { temps: 726, son: 'atterrit', force: 0.8 }],
  // Le coucou de l'aile : un pépiement de bonjour, et un froufrou léger à
  // chaque balancement (6, 20, 36 et 52 % de 1 200 ms).
  salue: [
    ...battements([72, 240, 432, 624], 0.5, 0.3, 1.25),
    { temps: 150, son: 'pepie' },
    { temps: 290, son: 'pepie', hauteur: 1.18 },
  ],
  // Une syllabe à chaque ouverture du bec (12, 30, 52 et 72 % de 1 100 ms) :
  // une petite phrase, qui monte et retombe.
  parle: [
    { temps: 50, son: 'pepie', force: 0.8 },
    { temps: 240, son: 'pepie', force: 0.75, hauteur: 1.12 },
    { temps: 450, son: 'piou', force: 0.8, hauteur: 0.95 },
    { temps: 690, son: 'pepie', force: 0.7, hauteur: 1.05 },
  ],
  // Un coup de tête vif : les plumes tournent.
  'se-tourne': [{ temps: 120, son: 'froisse', force: 0.55 }],
  // L'aile tendue tapote l'air deux fois (14 et 48 % de 700 ms).
  tapote: [
    { temps: 98, son: 'tapote', force: 0.8 },
    { temps: 336, son: 'tapote', force: 0.7 },
  ],
  // Trois coups de bec secs (14, 44 et 74 % de 900 ms).
  picore: [
    { temps: 126, son: 'bec' },
    { temps: 396, son: 'bec', force: 0.9, hauteur: 1.04 },
    { temps: 666, son: 'bec', force: 0.85, hauteur: 0.97 },
  ],
  // Accroupi, il saute (vers 16 % de 420 ms) et se reçoit (vers 80 %).
  sautille: [
    { temps: 64, son: 'saut' },
    { temps: 336, son: 'atterrit', force: 0.5 },
  ],
  // Content : il pépie (dès 100 ms), plumes gonflées.
  content: [{ temps: 90, son: 'trille' }],

  // Il arrive d'en haut (360 ms) : deux coups d'aile, puis il se pose.
  atterrit: [...battements([0, 120], 0.6, 0.5), { temps: 260, son: 'atterrit', force: 0.6 }],
  // Il s'envole (600 ms) : les coups d'aile s'éloignent.
  sort: battements([0, 110, 210, 300, 380], 0.7, 0.25, 1.1),

  // Le geste propre de chaque pose, joué une fois à son apparition.
  'joue:accueil': [
    ...battements([130, 290, 460, 640], 0.45, 0.3, 1.25),
    { temps: 210, son: 'pepie' },
    { temps: 330, son: 'pepie', hauteur: 1.2 },
  ],
  // Accroupi, il saute ailes battantes (26 à 66 % de 1 100 ms) et retombe à 72 %.
  'joue:celebre': [
    { temps: 150, son: 'saut' },
    ...battements([286, 396, 506, 616], 0.6, 0.4, 1.15),
    { temps: 330, son: 'trille' },
    { temps: 792, son: 'atterrit', force: 0.6 },
  ],
  // Il arrive d'un saut (posé à 70 % de 700 ms), puis agite l'enveloppe.
  'joue:notification': [
    { temps: 490, son: 'atterrit', force: 0.5 },
    { temps: 640, son: 'froisse', force: 0.5 },
    { temps: 760, son: 'pepie' },
  ],
  // La carte se déplie, puis il pépie en hochant la tête.
  'joue:explique': [
    { temps: 40, son: 'froisse', force: 0.45 },
    { temps: 470, son: 'pepie' },
  ],
  // Gêné, il se gratte derrière la tête (18, 38 et 58 % de 1 000 ms).
  'joue:oups': [
    { temps: 110, son: 'piou', hauteur: 0.9 },
    { temps: 180, son: 'tapote', force: 0.35 },
    { temps: 380, son: 'tapote', force: 0.3 },
    { temps: 580, son: 'tapote', force: 0.25 },
  ],
  'joue:chut': [{ temps: 180, son: 'chut' }],
  // Il prend de la hauteur : des coups d'aile qui s'accélèrent.
  'joue:depart': battements([0, 120, 230, 330, 420, 500], 0.7, 0.5, 1.05),
  // L'aile salue en vol ; l'envol (« sort ») prend la suite.
  'joue:au-revoir': [{ temps: 100, son: 'pepie', hauteur: 1.1 }, ...battements([198, 418], 0.45, 0.4, 1.25)],
  // Trois bulles de pensée (300, 460 et 620 ms).
  'joue:reflechit': [
    { temps: 300, son: 'bulle' },
    { temps: 460, son: 'bulle', hauteur: 1.12 },
    { temps: 620, son: 'bulle', hauteur: 1.25 },
  ],
  'joue:pointer-haut': [{ temps: 80, son: 'froisse', force: 0.35 }],
  'joue:pointer-bas': [{ temps: 80, son: 'froisse', force: 0.35 }],
  'joue:pointer-gauche': [{ temps: 80, son: 'froisse', force: 0.35 }],
  'joue:pointer-droite': [{ temps: 80, son: 'froisse', force: 0.35 }],
};
