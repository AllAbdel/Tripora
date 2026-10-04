import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getCollaboration } from './collaboration';
import { getVoting } from './votes';

/**
 * Garde l'écran à jour quand le groupe bouge : arrivées, envies et votes.
 *
 * Sans cela, Abdel devrait recharger la page pour voir que Thomas a rejoint et
 * rempli ses envies — et surtout, les propositions resteraient calculées pour
 * lui seul. On invalide donc le voyage et la liste des participants, ce qui
 * relance le calcul avec le groupe au complet.
 *
 * On ne recharge pas les données depuis l'événement lui-même : la charge utile
 * d'un événement temps réel n'est pas filtrée aussi finement qu'une requête, et
 * refaire la requête reste la façon la plus sûre d'obtenir un état cohérent.
 */
export function useGroupRealtime(tripId: string | undefined): void {
  const queryClient = useQueryClient();

  useEffect(() => {
    const collaboration = getCollaboration();
    const voting = getVoting();
    if (!tripId || !collaboration) return;

    const arreterGroupe = collaboration.watchGroup(tripId, () => {
      void queryClient.invalidateQueries({ queryKey: ['membres', tripId] });
      void queryClient.invalidateQueries({ queryKey: ['trip'] });
    });
    const arreterVotes = voting.watchVotes(tripId, () => {
      void queryClient.invalidateQueries({ queryKey: ['votes', tripId] });
    });

    return () => {
      arreterGroupe();
      arreterVotes();
    };
  }, [tripId, queryClient]);
}
