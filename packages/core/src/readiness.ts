import { PREFERENCE_AXES, type PreferenceWeights } from './preferences.js';
import { targetMonth } from './dates.js';
import type { MemberPreference, TripConstraints } from './types.js';

/**
 * Ce qui manque avant que le groupe puisse trancher.
 *
 * La vraie raison pour laquelle un voyage entre amis n'avance pas n'est
 * presque jamais le manque d'idées : c'est que personne ne sait ce qu'on
 * attend, ni de qui. Trois personnes croient avoir répondu, deux attendent
 * qu'on leur demande, et le groupe conclut que « l'appli sert à rien ».
 *
 * Cette fonction répond à une seule question, en français et sans détour :
 * **qu'est-ce qui bloque, maintenant ?** Elle ne juge pas, elle n'insiste pas,
 * et elle ne nomme personne — la pression sociale n'est pas une fonctionnalité.
 * Elle compte, et elle dit ce que ça empêche.
 *
 * Entièrement déterministe : c'est du comptage, pas une appréciation.
 */

export type BlockerKind =
  | 'members'
  | 'preferences'
  | 'budget'
  | 'period'
  | 'vote'
  | 'decision';

export interface Blocker {
  kind: BlockerKind;
  /** Phrase affichable telle quelle. */
  label: string;
  /** Ce que ce manque empêche concrètement. */
  consequence: string;
  /** Vrai quand rien ne peut avancer sans ça. */
  blocking: boolean;
}

export interface Readiness {
  /** Ce qu'il reste à faire, du plus bloquant au moins gênant. */
  blockers: Blocker[];
  /** Part du chemin parcouru, de 0 à 100 — pour une barre, pas pour un score. */
  progress: number;
  /** Vrai quand le groupe a tout ce qu'il faut pour décider. */
  readyToDecide: boolean;
}

/**
 * Une personne a-t-elle exprimé quelque chose ?
 *
 * On teste « au moins une envie au-dessus de zéro », et non « au moins une
 * clé présente », parce que les préférences arrivent ici après
 * `normalizeWeights`, qui remplit les huit axes — un silence et huit « non
 * merci » sont alors le même objet. Distinguer les deux demanderait de
 * transporter la forme brute jusqu'ici, pour un cas que l'assistant de
 * création interdit déjà : il exige au moins une envie avant de continuer.
 *
 * Conséquence assumée : quelqu'un qui cocherait « non merci » partout serait
 * compté comme n'ayant pas répondu. C'est le bon comportement de toute façon —
 * un profil entièrement vide ne permet de servir personne.
 */
export function hasAnswered(weights: Partial<PreferenceWeights>): boolean {
  return PREFERENCE_AXES.some((axe) => (weights[axe] ?? 0) > 0);
}

export function tripReadiness({
  constraints,
  members,
  votes = 0,
  locked = false,
}: {
  constraints: TripConstraints;
  members: readonly MemberPreference[];
  /** Nombre de personnes ayant voté au moins une fois. */
  votes?: number;
  locked?: boolean;
}): Readiness {
  const blockers: Blocker[] = [];
  const attendus = Math.max(1, constraints.participants);

  const manquants = attendus - members.length;
  if (manquants > 0) {
    blockers.push({
      kind: 'members',
      label:
        manquants === 1
          ? 'Une personne n’a pas encore rejoint'
          : `${manquants} personnes n’ont pas encore rejoint`,
      consequence: 'Leur budget et leurs envies ne comptent pas dans le classement.',
      blocking: false,
    });
  }

  const sansEnvies = members.filter((membre) => !hasAnswered(membre.weights)).length;
  if (sansEnvies > 0) {
    blockers.push({
      kind: 'preferences',
      label:
        sansEnvies === 1
          ? 'Une personne n’a pas dit ses envies'
          : `${sansEnvies} personnes n’ont pas dit leurs envies`,
      // C'est le vrai enjeu : sans réponse, on ne peut pas garantir que
      // personne ne subit la destination des autres.
      consequence: 'Sans elles, l’équité du classement ne veut plus dire grand-chose.',
      blocking: true,
    });
  }

  const sansBudget = members.filter(
    (membre) => typeof membre.budgetMaxCents !== 'number' || membre.budgetMaxCents <= 0,
  ).length;
  if (sansBudget > 0 && constraints.budgetMode !== 'cheapest') {
    blockers.push({
      kind: 'budget',
      label:
        sansBudget === 1
          ? 'Une personne n’a pas donné son budget'
          : `${sansBudget} personnes n’ont pas donné leur budget`,
      consequence: 'Le budget retenu est celui du groupe, pas le plus bas réel.',
      blocking: false,
    });
  }

  if (targetMonth(constraints) === undefined) {
    blockers.push({
      kind: 'period',
      label: 'Aucune période n’est fixée',
      consequence: 'Ni les prix des vols ni la météo ne peuvent être calculés.',
      blocking: true,
    });
  }

  if (!locked) {
    if (votes === 0) {
      blockers.push({
        kind: 'vote',
        label: 'Personne n’a encore voté',
        consequence: 'Le classement propose ; c’est le vote qui décide.',
        blocking: true,
      });
    } else if (votes < members.length) {
      const reste = members.length - votes;
      blockers.push({
        kind: 'vote',
        label:
          reste === 1 ? 'Une personne n’a pas voté' : `${reste} personnes n’ont pas voté`,
        consequence: 'Trancher maintenant, c’est trancher sans elles.',
        blocking: false,
      });
    }
    blockers.push({
      kind: 'decision',
      label: 'La destination n’est pas arrêtée',
      consequence: 'L’itinéraire et la carte attendent cette décision.',
      blocking: false,
    });
  }

  // Les vrais blocages d'abord : on ne fait pas lire trois lignes de confort
  // avant celle qui empêche tout.
  blockers.sort((a, b) => Number(b.blocking) - Number(a.blocking));

  // Quatre jalons, comptés également : le groupe est là, il a parlé, il a
  // voté, il a décidé. Volontairement grossier — c'est une barre, pas une note.
  const jalons = [
    members.length >= attendus,
    sansEnvies === 0 && members.length > 0,
    votes > 0,
    locked,
  ];
  const progress = Math.round((jalons.filter(Boolean).length / jalons.length) * 100);

  return {
    blockers,
    progress,
    readyToDecide: !blockers.some((blocage) => blocage.blocking),
  };
}
