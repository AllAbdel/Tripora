import type { GesteDePlumio, PoseDeLaMascotte } from './Mascotte';

/**
 * Ce que l'interface fait entendre quand le guide bouge.
 *
 * Il y avait des battements d'ailes, des pépiements, des coups de bec : trop
 * enfantin pour une application qu'on ouvre entre adultes pour organiser un
 * voyage. Il reste quelques notes d'interface, rares et sobres — une apparition,
 * un repère, une validation, un départ —, de celles qu'on entend à peine et
 * qu'on ne remarque que si elles manquent.
 *
 * La règle : **un seul son par moment**, et la plupart des gestes n'en ont
 * aucun (parler, sautiller, se retourner, réfléchir). Chaque note reste calée
 * sur les images clés de `design/mascotte/animations.css` : l'apparition tombe
 * quand il se pose, pas pendant qu'il descend.
 */

/** Les sons, tous synthétisés (voir `synthese.ts`). */
export type Son =
  /** Une quinte douce qui monte : quelque chose arrive à l'écran. */
  | 'apparition'
  /** Un tic feutré : un repère, une étape. */
  | 'repere'
  /** Trois notes d'un accord majeur : c'est fait. */
  | 'validation'
  /** Deux notes qui descendent, plus bas : ça s'en va. */
  | 'depart'
  /** Deux notes égales : une information à voir. */
  | 'signal'
  /** Une tierce mineure qui descend : quelque chose n'a pas marché. */
  | 'erreur';

export interface Note {
  /** Quand, en millisecondes depuis le début du geste. */
  temps: number;
  son: Son;
  /** De 0 à 1 : l'intensité. 1 par défaut. */
  force?: number;
}

export type Partition = readonly Note[];

/** Ce qui fait jouer une partition : un geste, un passage, ou le geste propre d'une pose. */
export type MomentDePlumio = GesteDePlumio | 'atterrit' | 'sort' | `joue:${PoseDeLaMascotte}`;

export const PARTITIONS: Readonly<Partial<Record<MomentDePlumio, Partition>>> = {
  // Il descend et se pose à 66 % de 1 100 ms : la note tombe au contact.
  arrive: [{ temps: 726, son: 'apparition' }],
  // Il arrive d'en haut (360 ms) et se pose vers 72 %.
  atterrit: [{ temps: 260, son: 'apparition', force: 0.8 }],
  // Il s'en va (600 ms).
  sort: [{ temps: 0, son: 'depart', force: 0.8 }],

  // L'aile montre un élément : un repère, une seule fois.
  tapote: [{ temps: 98, son: 'repere', force: 0.8 }],
  picore: [{ temps: 126, son: 'repere', force: 0.7 }],
  // Content : la consigne est remplie.
  content: [{ temps: 90, son: 'validation', force: 0.8 }],

  'joue:celebre': [{ temps: 330, son: 'validation' }],
  // Posé à 70 % de 700 ms, il présente l'enveloppe.
  'joue:notification': [{ temps: 490, son: 'signal' }],
  'joue:oups': [{ temps: 110, son: 'erreur', force: 0.8 }],
  'joue:depart': [{ temps: 0, son: 'depart' }],
  'joue:pointer-haut': [{ temps: 80, son: 'repere', force: 0.6 }],
  'joue:pointer-bas': [{ temps: 80, son: 'repere', force: 0.6 }],
  'joue:pointer-gauche': [{ temps: 80, son: 'repere', force: 0.6 }],
  'joue:pointer-droite': [{ temps: 80, son: 'repere', force: 0.6 }],
};
