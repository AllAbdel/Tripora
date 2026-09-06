import { supabase } from './supabase';

/**
 * Le vote : le geste qui transforme une liste de propositions en décision.
 *
 * Les propositions ne sont pas enregistrées en base — elles se recalculent en
 * quelques millisecondes à partir des contraintes et des envies, de façon
 * déterministe, donc tout le monde voit la même liste. Les votes, eux, sont
 * rattachés directement à l'identifiant de la destination : ils survivent à un
 * changement de classement, et retrouvent leur place si une destination
 * ressort après que quelqu'un a modifié ses envies.
 */

export type VoteValue = 'like' | 'dislike' | 'favorite';

export interface VoteTally {
  destinationId: string;
  likes: number;
  dislikes: number;
  favorites: number;
  /** Ce que la personne connectée a choisi, s'il y a lieu. */
  mine: VoteValue | null;
}

export interface VotingApi {
  listTallies(tripId: string, userId: string): Promise<Map<string, VoteTally>>;
  cast(tripId: string, destinationId: string, value: VoteValue | null): Promise<void>;
  lockDestination(tripId: string, destinationId: string): Promise<void>;
  unlockDestination(tripId: string): Promise<void>;
  watchVotes(tripId: string, onChange: () => void): () => void;
}

export function getVoting(): VotingApi | null {
  const client = supabase;
  if (!client) return null;

  return {
    async listTallies(tripId, userId) {
      const { data, error } = await client
        .from('votes')
        .select('subject_id, user_id, value')
        .eq('trip_id', tripId)
        .eq('subject_type', 'proposal');
      if (error) throw error;

      const tallies = new Map<string, VoteTally>();
      for (const row of data ?? []) {
        const id = row.subject_id as string;
        const tally = tallies.get(id) ?? {
          destinationId: id,
          likes: 0,
          dislikes: 0,
          favorites: 0,
          mine: null,
        };
        const value = row.value as VoteValue;
        if (value === 'like') tally.likes += 1;
        else if (value === 'dislike') tally.dislikes += 1;
        else tally.favorites += 1;
        if (row.user_id === userId) tally.mine = value;
        tallies.set(id, tally);
      }
      return tallies;
    },

    async cast(tripId, destinationId, value) {
      const { data: session } = await client.auth.getUser();
      const userId = session.user?.id;
      if (!userId) throw new Error('Connexion requise pour voter');

      const cible = {
        trip_id: tripId,
        subject_type: 'proposal',
        subject_id: destinationId,
        user_id: userId,
      };

      // Retirer son vote se fait en recliquant dessus : un geste pour poser,
      // le même pour reprendre.
      if (value === null) {
        const { error } = await client
          .from('votes')
          .delete()
          .match(cible);
        if (error) throw error;
        return;
      }

      const { error } = await client
        .from('votes')
        .upsert(
          { ...cible, value },
          { onConflict: 'trip_id,subject_type,subject_id,user_id' },
        );
      if (error) throw error;
    },

    async lockDestination(tripId, destinationId) {
      const { error } = await client
        .from('trips')
        .update({ destination_locked_id: destinationId, status: 'planned' })
        .eq('id', tripId);
      if (error) throw error;
    },

    async unlockDestination(tripId) {
      const { error } = await client
        .from('trips')
        .update({ destination_locked_id: null, status: 'voting' })
        .eq('id', tripId);
      if (error) throw error;
    },

    watchVotes(tripId, onChange) {
      const channel = client
        .channel(`votes:${tripId}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'votes', filter: `trip_id=eq.${tripId}` },
          onChange,
        )
        .subscribe();
      return () => {
        void client.removeChannel(channel);
      };
    },
  };
}

/**
 * Le choix du groupe, tel qu'exprimé par les votes — distinct de ce que le
 * calcul recommande. Un favori compte double : c'est une préférence appuyée,
 * pas un simple accord poli. Un « je n'aime pas » retranche autant qu'un
 * « j'aime » ajoute, sans quoi une destination clivante l'emporterait sur un
 * consensus tiède.
 */
export function preferenceScore(tally: VoteTally | undefined): number {
  if (!tally) return 0;
  return tally.likes + tally.favorites * 2 - tally.dislikes;
}

export interface GroupChoice {
  destinationId: string;
  score: number;
  supporters: number;
}

/** La destination qui recueille le plus d'adhésion, s'il y en a une. */
export function groupChoice(
  tallies: ReadonlyMap<string, VoteTally>,
  candidates: readonly string[],
): GroupChoice | null {
  let best: GroupChoice | null = null;
  for (const destinationId of candidates) {
    const tally = tallies.get(destinationId);
    const score = preferenceScore(tally);
    if (score <= 0) continue;
    const supporters = (tally?.likes ?? 0) + (tally?.favorites ?? 0);
    // À égalité, on garde le premier du classement calculé : c'est déjà un
    // départage argumenté, plutôt qu'un tirage au sort.
    if (!best || score > best.score) best = { destinationId, score, supporters };
  }
  return best;
}
