import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  buildProposals,
  selectCandidates,
  targetMonth,
  type Destination,
  type ProposalResult,
} from '@tripora/core';
import { chargerPrixVols, moisCible, type PrixVols } from './flightPrices';
import { chargerNormales, sourceClimat, type NormalesParVille } from './climate';
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
  /** Normales relevées des candidates, pour les afficher sans les redemander. */
  normales: NormalesParVille;
} {
  /**
   * Un voyage dont la destination a été choisie à la création n'a rien à
   * comparer : le moteur ne saurait proposer que d'autres villes, et sa
   * présélection borne la distance à la durée du séjour — d'où des
   * propositions systématiquement proches du départ, sans le moindre rapport
   * avec la destination retenue. On ne calcule donc rien, et on n'appelle ni
   * les prix ni les normales climatiques pour rien.
   */
  const compare = details?.destinationMode !== 'fixed';

  const candidates = useMemo(
    () => (details && compare ? selectCandidates(details.constraints, { limit: ETUDIEES }) : []),
    [details, compare],
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

  // Les normales relevées ne changent pas d'un mois à l'autre : une requête,
  // gardée très longtemps, pour les seules candidates étudiées.
  const normales = useQuery({
    queryKey: ['normales', candidates.map((d) => d.id).join(',')],
    queryFn: () => chargerNormales(candidates),
    enabled: candidates.length > 0,
    staleTime: 30 * 24 * 60 * 60 * 1000,
  });

  const proposals = useMemo(() => {
    if (!details || !compare) return null;
    const releves = prix.data?.parDestination;
    // `moisCible` sert les prix de vol et rend « 2026-10 » ; le climat veut le
    // numéro du mois, que le moteur calcule déjà de son côté.
    const climat = sourceClimat(normales.data ?? {}, targetMonth(details.constraints));
    const sources = {
      ...(releves ? { transportPrice: (d: Destination) => releves[d.id] } : {}),
      ...(climat ? { climate: climat } : {}),
    };
    return buildProposals(details.constraints, details.members, {
      limit: ETUDIEES,
      keep: PRESENTEES,
      ...(Object.keys(sources).length > 0 ? { sources } : {}),
    });
  }, [details, compare, prix.data, normales.data]);

  return {
    proposals,
    prix: prix.data,
    prixEnCours: prix.isLoading,
    normales: normales.data ?? {},
  };
}
