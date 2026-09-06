import { formatCents } from '../money.js';
import { monthNameFr, targetMonth } from '../dates.js';
import { AXIS_LABELS_FR, PREFERENCE_AXES, type PreferenceAxis } from '../preferences.js';
import { bindingBudgetCents } from '../scoring.js';
import type { DestinationScore, MemberPreference, TripConstraints } from '../types.js';

/**
 * Le dossier de faits remis à l'assistant.
 *
 * C'est la pièce qui rend applicable la règle du projet — *l'IA interprète, elle
 * ne mesure pas*. Tout ce qui part d'ici a été calculé par le moteur : les
 * notes, les coûts, le budget contraignant, ce qui manque au groupe. Le modèle
 * n'a rien à deviner, et s'il invente un chiffre il invente contre son propre
 * contexte, ce qui se voit immédiatement.
 *
 * **Ce qui ne part jamais**, et c'est vérifié par les tests : aucun nom, aucun
 * e-mail, aucun identifiant. Les participants sont « Participant A », « B »,
 * « C ». Les offres gratuites s'entraînent sur ce qu'on leur envoie, et un
 * groupe d'amis n'a pas à financer ça avec ses prénoms.
 *
 * Le dossier est volontairement compact : un contexte court coûte moins de
 * jetons, tient dans tous les quotas gratuits, et donne de meilleures réponses
 * qu'un pavé où l'essentiel se noie.
 */

export interface BriefingInput {
  constraints: TripConstraints;
  members: readonly MemberPreference[];
  /** Classement déjà calculé, dans l'ordre. */
  scores: readonly DestinationScore[];
  /** Nom de la destination arrêtée, si le groupe a tranché. */
  lockedName?: string | undefined;
  /** Ce qu'il manque au groupe, tel que `tripReadiness` le formule. */
  blockers?: readonly { label: string; consequence: string }[];
}

/** Les faits, en texte compact. Rien d'autre ne doit être envoyé au modèle. */
export function buildBriefing(input: BriefingInput): string {
  const { constraints, members, scores } = input;
  const mois = targetMonth(constraints);

  const lignes: string[] = [
    '## Le voyage',
    `Départ de ${constraints.origin.name}.`,
    `${constraints.participants} personnes, ${constraints.durationDays} jours.`,
    `Période : ${mois === undefined ? 'pas encore fixée' : monthNameFr(mois)}.`,
    `Confort visé : ${CONFORT[constraints.comfortLevel]}.`,
  ];

  const contraignant = bindingBudgetCents(members, constraints);
  lignes.push(
    contraignant === null
      ? 'Budget : aucun plafond, le groupe cherche le moins cher.'
      : `Budget contraignant : ${euros(contraignant)} par personne — c’est le plus bas du groupe, et c’est lui qui compte.`,
  );

  if (input.lockedName) lignes.push(`Destination arrêtée : ${input.lockedName}.`);

  lignes.push('', '## Les envies, par participant anonymisé');
  if (members.length === 0) {
    lignes.push('Personne n’a encore renseigné ses envies.');
  }
  for (const [index, membre] of members.entries()) {
    const fortes = PREFERENCE_AXES.filter((axe) => (membre.weights[axe] ?? 0) >= 0.6)
      .map((axe) => `${AXIS_LABELS_FR[axe]} ${note(membre.weights[axe])}`)
      .join(', ');
    const budget =
      typeof membre.budgetMaxCents === 'number' && membre.budgetMaxCents > 0
        ? `budget ${euros(membre.budgetMaxCents)}`
        : 'budget non renseigné';
    lignes.push(
      `- Participant ${lettre(index)} : ${fortes || 'aucune envie forte exprimée'} ; ${budget}.`,
    );
  }

  if (scores.length > 0) {
    lignes.push('', '## Le classement calculé');
    for (const [rang, score] of scores.entries()) {
      const facteurs = score.factors
        .map((facteur) => `${facteur.label} ${Math.round(facteur.score)}`)
        .join(', ');
      lignes.push(
        `${rang + 1}. ${score.destinationId} — note ${score.total}/100, ` +
          `coût total ${euros(score.cost.totalCents)} par personne ` +
          `(transport ${score.cost.transportSource === 'observed' ? 'relevé' : 'estimé'}). ` +
          `Facteurs : ${facteurs}.`,
      );
    }
  }

  if (input.blockers && input.blockers.length > 0) {
    lignes.push('', '## Ce qui manque au groupe');
    for (const blocage of input.blockers) {
      lignes.push(`- ${blocage.label} — ${blocage.consequence}`);
    }
  }

  return lignes.join('\n');
}

/**
 * Consigne de l'assistant.
 *
 * Longue et catégorique à dessein : c'est le seul endroit du produit où un
 * modèle parle librement à un utilisateur, et la moindre latitude se paie en
 * chiffres inventés.
 */
export const CONSIGNE_ASSISTANT = `Tu réponds aux questions d’un groupe d’amis sur LEUR voyage, à partir du dossier de faits fourni.

Règles absolues :
- Tu n’utilises QUE les chiffres du dossier. Tu n’en inventes aucun, tu n’en estimes aucun, tu n’en ajoutes aucun venu de tes connaissances.
- Si le dossier ne contient pas la réponse, dis-le en une phrase et indique ce qui manque. Ne comble jamais un trou par une supposition.
- Tu ne recommandes aucun restaurant, hôtel, activité ou lieu précis : tu n’en as pas la liste et tu ne dois pas en inventer.
- Tu ne décides pas à la place du groupe. Tu peux comparer et éclairer, jamais trancher.
- Les participants sont « Participant A, B, C ». Ne cherche pas leur identité.
- Réponds en français, 3 phrases maximum, sans titre ni liste ni markdown.
- Ton direct et concret. Pas de formule d’accueil, pas de « bien sûr ! ». Va au fait.`;

const CONFORT = {
  budget: 'petit budget',
  mid: 'confort normal',
  comfort: 'confortable',
} as const;

const euros = (cents: number): string => formatCents(cents, 'EUR', { hideCentimes: true });

/** « Participant A », puis B, C… et au-delà de 26, A2, B2. */
function lettre(index: number): string {
  const base = String.fromCharCode(65 + (index % 26));
  const tour = Math.floor(index / 26);
  return tour === 0 ? base : `${base}${tour + 1}`;
}

function note(poids: number | undefined): string {
  return `${Math.round((poids ?? 0) * 10)}/10`;
}

/**
 * Dernier contrôle avant l'envoi.
 *
 * `assertAnonyme`, côté serveur, attrape les e-mails et les identifiants. Ceci
 * attrape ce qui lui échapperait : un prénom de participant qui aurait glissé
 * dans le dossier. On compare au lieu de faire confiance, parce que la
 * promesse « aucun nom ne part » ne vaut que si quelque chose la vérifie.
 */
export function briefingLeaksNames(
  briefing: string,
  members: readonly MemberPreference[],
): string[] {
  const fuites: string[] = [];
  for (const membre of members) {
    for (const valeur of [membre.displayName, membre.userId]) {
      if (typeof valeur !== 'string' || valeur.length < 3) continue;
      if (briefing.toLowerCase().includes(valeur.toLowerCase())) fuites.push(valeur);
    }
  }
  return fuites;
}

export type { PreferenceAxis };
