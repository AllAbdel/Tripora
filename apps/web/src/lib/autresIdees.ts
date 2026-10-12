import type { VoteTally } from './votes';

/**
 * « D'autres idées » : ce qui part, ce qui reste.
 *
 * Le groupe peut n'aimer aucune des destinations proposées. L'organisateur
 * demande alors d'autres idées : celles que personne n'a aimées sont mises de
 * côté, et le moteur en étudie de nouvelles à leur place. Celles qui ont reçu
 * un « j'aime » ou un « préféré » restent : quelqu'un y tient, et les retirer
 * effacerait son vote sans le lui demander.
 *
 * La liste est cumulative : on ne revoit pas au deuxième tour ce qu'on a
 * écarté au premier. « Revoir les destinations mises de côté » la vide.
 */

/** Les destinations affichées que personne n'a aimées, dans l'ordre affiché. */
export function aMettreDeCote(
  affichees: readonly string[],
  tallies: Readonly<Record<string, VoteTally>> | undefined,
): string[] {
  return affichees.filter((id) => {
    const tally = tallies?.[id];
    return (tally?.likes ?? 0) + (tally?.favorites ?? 0) === 0;
  });
}

/** La nouvelle liste des destinations mises de côté : l'ancienne, plus celles-ci, sans doublon. */
export function ecarteesApres(
  ecartees: readonly string[] | undefined,
  nouvelles: readonly string[],
): string[] {
  return [...new Set([...(ecartees ?? []), ...nouvelles])];
}
