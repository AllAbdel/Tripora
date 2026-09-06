import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { buildProposals, selectCandidates, type ProposalResult } from '@tripora/core';
import { chargerPrixVols, moisCible, type PrixVols } from './flightPrices';
import type { TripDetails } from './trips';

/** Nombre de candidates étudiées, et nombre finalement présentées. */
const ETUDIEES = 20;
const PRESENTEES = 6;

/**
 * Les propositions d'un voyage, prix relevés compris.
 *
 * Partagé par l'écran du voyage et par la carte : deux calculs séparés
 * finiraient par diverger, et le classement affiché ne correspondrait plus aux
 * repères posés sur la carte.
 *
 * L'enchaînement est volontaire : on présélectionne d'abord, gratuitement, dans
 * le catalogue local ; on ne demande les prix que pour ces candidates-là ; puis
 * on note. Tant que les prix n'ont pas répondu, le classement s'affiche avec
 * les estimations — mieux vaut un écran utile tout de suite qu'un écran vide
 * en attendant le réseau.
 */
export function useProposals(details: TripDetails | null | undefined): {
  proposals: ProposalResult | null;
  prix: PrixVols | undefined;
  prixEnCours: boolean;
} {
  const candidates = useMemo(
    () => (details ? selectCandidates(details.constraints, { limit: ETUDIEES }) : []),
    [details],
  );

  const prix = useQuery({
    // La clé ne dépend que de ce qui change le prix : même départ, même mois,
    // même réponse — y compris d'un voyage à l'autre.
    queryKey: [
      'prix-vols',
      details?.constraints.origin.iata?.[0] ?? null,
      details ? moisCible(details.constraints) : null,
      candidates.length,
    ],
    queryFn: () => chargerPrixVols(details!.constraints, candidates),
    enabled: Boolean(details) && candidates.length > 0,
    staleTime: 60 * 60 * 1000,
  });

  const proposals = useMemo(() => {
    if (!details) return null;
    const releves = prix.data?.parDestination;
    return buildProposals(details.constraints, details.members, {
      limit: ETUDIEES,
      keep: PRESENTEES,
      ...(releves ? { sources: { transportPrice: (d) => releves[d.id] } } : {}),
    });
  }, [details, prix.data]);

  return { proposals, prix: prix.data, prixEnCours: prix.isLoading };
}
