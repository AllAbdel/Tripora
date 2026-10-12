import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { Continent } from '@tripora/core';
import { cleVoyage, getTripRepository, type TripDetails } from './trips';
import { signaler } from './feedback';

/** Ce que l'organisateur règle sur les propositions : où chercher, ce qu'on écarte. */
export interface ReglagesDesPropositions {
  regions?: Continent[];
  ecartees?: string[];
}

/**
 * Change où le moteur cherche, ou ce qu'il écarte, sans attendre le serveur.
 *
 * Les propositions se calculent sur l'appareil : il suffit de corriger le
 * voyage en cache pour que la nouvelle liste s'affiche tout de suite. Le
 * serveur confirme ensuite ; en cas d'échec, l'ancienne liste revient et un
 * message le dit. Les autres membres reçoivent le changement en temps réel.
 */
export function useReglagesDesPropositions(tripId: string | undefined) {
  const queryClient = useQueryClient();
  const cle = cleVoyage(tripId);
  const mutationKey = ['reglages-des-propositions', tripId];

  return useMutation({
    mutationKey,
    // Deux puces touchées coup sur coup : les écritures partent dans l'ordre.
    scope: { id: `reglages-des-propositions:${tripId}` },
    mutationFn: (reglages: ReglagesDesPropositions) => getTripRepository().update(tripId!, reglages),
    onMutate: async (reglages) => {
      await queryClient.cancelQueries({ queryKey: cle });
      const avant = queryClient.getQueryData<TripDetails | null>(cle);
      if (avant) {
        queryClient.setQueryData<TripDetails>(cle, {
          ...avant,
          ...(reglages.ecartees ? { ecartees: reglages.ecartees } : {}),
          ...(reglages.regions
            ? { constraints: { ...avant.constraints, regions: reglages.regions } }
            : {}),
        });
      }
      return { avant };
    },
    onError: (_erreur, _reglages, contexte) => {
      if (contexte?.avant) queryClient.setQueryData(cle, contexte.avant);
      signaler('echec');
    },
    // Relire le voyage seulement après la dernière écriture : une relecture
    // intermédiaire effacerait le choix suivant, déjà affiché.
    onSettled: () =>
      queryClient.isMutating({ mutationKey }) === 1
        ? queryClient.invalidateQueries({ queryKey: ['trip'] })
        : undefined,
  });
}
