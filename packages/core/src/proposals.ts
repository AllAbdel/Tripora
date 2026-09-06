import { selectCandidates, type CandidateOptions } from './catalog/candidates.js';
import { cheapestTransport } from './transport.js';
import { estimateTripCost } from './cost.js';
import { rankDestinations, type ScoreContext } from './scoring.js';
import type { PricedValue } from './freshness.js';
import type {
  Destination,
  DestinationScore,
  MemberPreference,
  MonthlyClimate,
  TripConstraints,
} from './types.js';

/**
 * Construction des propositions de destinations.
 *
 * C'est le point où les trois couches se rejoignent, dans cet ordre strict :
 *
 *   1. présélection gratuite dans le catalogue local ;
 *   2. faits — prix et climat, relevés si une source répond, estimés sinon ;
 *   3. calcul — coût total et note, entièrement déterministe.
 *
 * L'IA n'intervient nulle part ici. Elle pourra plus tard reformuler les
 * explications déjà produites, jamais changer une note ni un prix.
 *
 * Les deux fonctions de recherche sont injectées : sans elles, tout est estimé
 * et clairement étiqueté comme tel, ce qui permet à Tripora de fonctionner
 * entièrement hors ligne et sans aucune clé d'API.
 */
export interface ProposalSources {
  /** Prix de transport aller-retour relevé, si une source en connaît un. */
  transportPrice?: (destination: Destination) => PricedValue | undefined;
  /** Normales climatiques du mois visé, si disponibles. */
  climate?: (destination: Destination) => MonthlyClimate | undefined;
  /** Prix d'hébergement relevé par nuit et par personne, si disponible. */
  accommodationPrice?: (destination: Destination) => PricedValue | undefined;
}

export interface ProposalOptions extends CandidateOptions {
  sources?: ProposalSources;
  /** Nombre de propositions finalement présentées au groupe. */
  keep?: number;
}

export interface ProposalResult {
  scores: DestinationScore[];
  /** Destinations effectivement étudiées, pour affichage et journalisation. */
  examined: number;
  /** Vrai si aucun prix relevé n'a pu être obtenu : tout est indicatif. */
  allEstimated: boolean;
}

export function buildProposals(
  constraints: TripConstraints,
  members: readonly MemberPreference[],
  options: ProposalOptions = {},
): ProposalResult {
  const sources = options.sources ?? {};
  const candidates = selectCandidates(constraints, options);

  // Premier passage : on établit le coût de chaque candidate. Le mode « le
  // moins cher possible » a besoin de connaître le minimum avant de noter.
  const priced = candidates.map((destination) => {
    const observed = sources.transportPrice?.(destination);
    const transport =
      observed ??
      cheapestTransport(constraints.origin, destination, constraints.participants)?.price ??
      ({ cents: null, source: 'unavailable' } as PricedValue);
    const accommodation = sources.accommodationPrice?.(destination);

    const cost = estimateTripCost({
      destination,
      durationDays: constraints.durationDays,
      comfortLevel: constraints.comfortLevel,
      transport,
      ...(accommodation ? { accommodationPerNight: accommodation } : {}),
    });

    return { destination, transport, accommodation, cost };
  });

  const totals = priced
    .map((entry) => entry.cost.totalCents)
    .filter((total) => total > 0);
  const cheapestTotalCents = totals.length > 0 ? Math.min(...totals) : null;

  const byId = new Map(priced.map((entry) => [entry.destination.id, entry]));

  const contextFor = (destination: Destination): ScoreContext => {
    const entry = byId.get(destination.id)!;
    const climate = sources.climate?.(destination);
    return {
      constraints,
      members,
      transport: entry.transport,
      cheapestTotalCents,
      ...(entry.accommodation ? { accommodationPerNight: entry.accommodation } : {}),
      ...(climate ? { climate } : {}),
    };
  };

  const scores = rankDestinations(candidates, contextFor).slice(0, options.keep ?? 6);

  return {
    scores,
    examined: candidates.length,
    allEstimated: priced.every((entry) => entry.transport.source !== 'observed'),
  };
}

/**
 * Phrase de tête d'une liste de propositions. Purement factuelle : elle décrit
 * ce que le calcul a produit, sans promettre que c'est le bon choix.
 */
export function summariseProposals(result: ProposalResult): string {
  if (result.scores.length === 0) {
    return 'Aucune destination ne correspond à ces critères. Essayez d’élargir le budget, la période ou la distance.';
  }
  const best = result.scores[0]!;
  const nombre = result.scores.length;
  const fiabilite = result.allEstimated
    ? 'Les prix affichés sont indicatifs tant qu’aucune source de tarifs n’est reliée.'
    : 'Les prix relevés portent leur date.';
  return `${nombre} destination${nombre > 1 ? 's' : ''} étudiée${nombre > 1 ? 's' : ''} sur ${result.examined} examinées. En tête : ${best.summary} ${fiabilite}`;
}
