/**
 * Découvrir : les activités une par une, qu'on garde d'un glissement.
 *
 * Une liste de quarante idées se parcourt en diagonale ; une carte à la fois,
 * plein écran, se regarde. C'est le geste des applications de rencontre et
 * des vidéos courtes, et il a une vertu ici : chacun dit oui ou non à tout,
 * vite, et le groupe obtient un classement que personne n'a eu à rédiger.
 *
 * Ce module ne connaît ni l'écran ni la base : il ordonne un paquet, et il
 * classe ce que le groupe a gardé.
 */

import type { PreferenceAxis } from './preferences.js';

/** Ce que le paquet a besoin de savoir d'une idée. */
export interface IdeeADecouvrir {
  id: string;
  nom: string;
  axis: PreferenceAxis;
  prixCents: number;
}

/** Les avis du groupe sur une idée, comptés sans dire qui. */
export interface ComptesDAvis {
  pour: number;
  contre: number;
  /** Mon avis, s'il y en a un. */
  moi: 'envie' | 'sans-moi' | null;
}

/**
 * Le paquet à parcourir : ce que je n'ai pas encore jugé, le plus proche des
 * envies du groupe d'abord, et varié.
 *
 * Varié parce que cinq musées d'affilée font décrocher ; on intercale, sans
 * bouleverser l'ordre : parmi les trois suivantes, on prend la première qui
 * ne répète pas l'envie de la carte précédente.
 */
export function paquetADecouvrir<T extends IdeeADecouvrir>(
  idees: readonly T[],
  {
    avis,
    envies,
    filtre = null,
    revoirLesRefus = false,
  }: {
    avis: Readonly<Record<string, ComptesDAvis | undefined>>;
    /** Les envies générales du groupe, entre 0 et 1 par axe. */
    envies: Partial<Record<PreferenceAxis, number>>;
    filtre?: PreferenceAxis | null;
    /** Repasser ce que j'ai écarté, pour changer d'avis. */
    revoirLesRefus?: boolean;
  },
): T[] {
  const restantes = idees
    .filter((idee) => (filtre ? idee.axis === filtre : true))
    .filter((idee) => {
      const mien = avis[idee.id]?.moi ?? null;
      return revoirLesRefus ? mien === 'sans-moi' : mien === null;
    })
    .sort(
      (a, b) =>
        (envies[b.axis] ?? 0) - (envies[a.axis] ?? 0) ||
        a.prixCents - b.prixCents ||
        a.nom.localeCompare(b.nom, 'fr'),
    );
  return varier(restantes);
}

export function varier<T extends { axis: PreferenceAxis }>(liste: readonly T[]): T[] {
  const reste = [...liste];
  const sortie: T[] = [];
  while (reste.length > 0) {
    const precedente = sortie.at(-1)?.axis;
    const index = reste.slice(0, 3).findIndex((idee) => idee.axis !== precedente);
    sortie.push(...reste.splice(index === -1 ? 0 : index, 1));
  }
  return sortie;
}

export interface LigneDuClassement<T> {
  idee: T;
  pour: number;
  contre: number;
  moi: 'envie' | 'sans-moi' | null;
}

/**
 * Le classement du groupe : les idées gardées par le plus de monde d'abord,
 * sans jamais dire par qui.
 *
 * À égalité d'envies, celle que moins de gens ont écartée passe devant ; puis
 * la moins chère. Une idée que personne n'a gardée n'y figure pas : un
 * classement de choses dont personne ne veut n'aide personne.
 */
export function classementDuGroupe<T extends IdeeADecouvrir>(
  idees: readonly T[],
  avis: Readonly<Record<string, ComptesDAvis | undefined>>,
): LigneDuClassement<T>[] {
  return idees
    .map((idee) => {
      const compte = avis[idee.id];
      return { idee, pour: compte?.pour ?? 0, contre: compte?.contre ?? 0, moi: compte?.moi ?? null };
    })
    .filter((ligne) => ligne.pour > 0)
    .sort(
      (a, b) =>
        b.pour - a.pour ||
        a.contre - b.contre ||
        a.idee.prixCents - b.idee.prixCents ||
        a.idee.nom.localeCompare(b.idee.nom, 'fr'),
    );
}

/**
 * « Vous et 2 autres en avez envie », « 3 en ont envie » : combien, jamais
 * qui — sauf soi-même, qu'on a le droit de savoir.
 */
export function phraseDesEnvies(pour: number, moi: boolean): string {
  if (pour <= 0) return '';
  if (moi) {
    const autres = pour - 1;
    return autres === 0 ? 'Vous en avez envie' : `Vous et ${autres} autre${autres > 1 ? 's' : ''} en avez envie`;
  }
  return pour === 1 ? '1 personne en a envie' : `${pour} personnes en ont envie`;
}
