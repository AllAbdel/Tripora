import {
  normalizeWeights,
  topAxes,
  type MemberPreference,
  type PreferenceAxis,
  type PreferenceWeights,
} from '@tripora/core';
import { supabase } from './supabase';

/**
 * Tout ce qui n'a de sens qu'à plusieurs.
 *
 * Ces fonctions n'existent que lorsqu'un serveur est configuré. En mode local,
 * `getCollaboration()` renvoie `null` plutôt qu'une implémentation qui ferait
 * semblant : mieux vaut une capacité absente qu'une capacité qui ment, et
 * l'interface peut alors expliquer honnêtement pourquoi le bouton n'est pas là.
 */

export interface TripMember {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  role: 'owner' | 'member';
  joinedAt: string;
  /** A-t-il déjà dit ce qu'il voulait ? C'est ce qui bloque les propositions. */
  hasPreferences: boolean;
  budgetMaxCents: number | null;
  topAxes: PreferenceAxis[];
}

export interface Invite {
  code: string;
  url: string;
  expiresAt: string;
  remainingUses: number;
}

export interface CollaborationApi {
  listMembers(tripId: string): Promise<TripMember[]>;
  currentInvite(tripId: string): Promise<Invite | null>;
  createInvite(tripId: string): Promise<Invite>;
  revokeInvite(tripId: string): Promise<void>;
  joinWithCode(code: string): Promise<{ tripId: string; title: string }>;
  myPreferences(tripId: string): Promise<MemberPreference | null>;
  savePreferences(
    tripId: string,
    values: { weights: Partial<PreferenceWeights>; budgetMaxCents: number | null; avoid?: PreferenceAxis[] },
  ): Promise<void>;
  /** Rappelle `onChange` dès qu'un membre ou une préférence bouge. */
  watchGroup(tripId: string, onChange: () => void): () => void;
}

/**
 * Alphabet sans caractères ambigus : pas de O contre 0, ni de I contre 1.
 * Un code se lit à voix haute au téléphone et se recopie à la main.
 */
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

export function generateInviteCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return Array.from(bytes, (byte) => ALPHABET[byte % ALPHABET.length]).join('');
}

export function inviteUrl(code: string): string {
  return `${window.location.origin}/rejoindre/${code}`;
}

export function getCollaboration(): CollaborationApi | null {
  const client = supabase;
  if (!client) return null;

  return {
    async listMembers(tripId) {
      // Deux requêtes, et non une seule avec relation imbriquée : il n'existe
      // aucune clé étrangère entre trip_members et member_preferences (les
      // deux pointent vers trips et profiles, pas l'une vers l'autre), donc
      // PostgREST ne saurait pas les rapprocher. On les joint ici.
      const [membres, envies] = await Promise.all([
        client
          .from('trip_members')
          .select('user_id, role, joined_at, profiles(display_name, avatar_url)')
          .eq('trip_id', tripId)
          .order('joined_at'),
        client
          .from('member_preferences')
          .select('user_id, weights, budget_max_cents, submitted')
          .eq('trip_id', tripId),
      ]);
      if (membres.error) throw membres.error;
      if (envies.error) throw envies.error;

      const parPersonne = new Map(
        (envies.data ?? []).map((row) => [row.user_id as string, row]),
      );

      return (membres.data ?? []).map((row) => {
        const profil = (
          Array.isArray(row.profiles) ? row.profiles[0] : row.profiles
        ) as { display_name: string | null; avatar_url: string | null } | null;
        const envie = parPersonne.get(row.user_id as string);
        const weights = normalizeWeights(
          (envie?.weights ?? {}) as Partial<PreferenceWeights>,
        );

        return {
          userId: row.user_id as string,
          displayName: profil?.display_name ?? 'Voyageur',
          avatarUrl: profil?.avatar_url ?? null,
          role: row.role === 'owner' ? ('owner' as const) : ('member' as const),
          joinedAt: row.joined_at as string,
          hasPreferences: Boolean(envie?.submitted),
          budgetMaxCents: (envie?.budget_max_cents as number | null) ?? null,
          topAxes: topAxes(weights, 3),
        };
      });
    },

    async currentInvite(tripId) {
      const { data, error } = await client
        .from('trip_invites')
        .select('code, expires_at, max_uses, uses')
        .eq('trip_id', tripId)
        .eq('revoked', false)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;

      const remaining = (data.max_uses as number) - (data.uses as number);
      if (remaining <= 0) return null;

      return {
        code: data.code as string,
        url: inviteUrl(data.code as string),
        expiresAt: data.expires_at as string,
        remainingUses: remaining,
      };
    },

    async createInvite(tripId) {
      const { data: session } = await client.auth.getUser();
      const userId = session.user?.id;
      if (!userId) throw new Error('Connexion requise');

      // Une collision de code est improbable (31^8), mais deux essais coûtent
      // moins cher qu'un message d'erreur incompréhensible.
      let lastError: unknown = null;
      for (let attempt = 0; attempt < 3; attempt += 1) {
        const code = generateInviteCode();
        const { data, error } = await client
          .from('trip_invites')
          .insert({ trip_id: tripId, code, created_by: userId })
          .select('code, expires_at, max_uses, uses')
          .single();
        if (!error && data) {
          return {
            code: data.code as string,
            url: inviteUrl(data.code as string),
            expiresAt: data.expires_at as string,
            remainingUses: (data.max_uses as number) - (data.uses as number),
          };
        }
        lastError = error;
        if (error?.code !== '23505') break; // autre chose qu'une collision
      }
      throw lastError ?? new Error('Impossible de créer le lien d’invitation');
    },

    async revokeInvite(tripId) {
      const { error } = await client
        .from('trip_invites')
        .update({ revoked: true })
        .eq('trip_id', tripId)
        .eq('revoked', false);
      if (error) throw error;
    },

    async joinWithCode(code) {
      // Passage obligé par la fonction serveur : c'est elle qui vérifie le
      // code, son expiration et son nombre d'usages. Aucun client ne peut
      // s'ajouter à un voyage autrement.
      const { data, error } = await client.rpc('join_trip_with_code', {
        invite_code: code.trim().toUpperCase(),
      });
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      if (!row) throw new Error('Ce lien d’invitation n’est plus valable.');
      return { tripId: row.trip_id as string, title: row.title as string };
    },

    async myPreferences(tripId) {
      const { data: session } = await client.auth.getUser();
      const userId = session.user?.id;
      if (!userId) return null;

      const { data, error } = await client
        .from('member_preferences')
        .select('weights, budget_max_cents, avoid, submitted')
        .eq('trip_id', tripId)
        .eq('user_id', userId)
        .maybeSingle();
      if (error) throw error;
      if (!data || !data.submitted) return null;

      return {
        userId,
        weights: normalizeWeights((data.weights ?? {}) as Partial<PreferenceWeights>),
        budgetMaxCents: data.budget_max_cents as number | null,
        avoid: (data.avoid ?? []) as PreferenceAxis[],
      };
    },

    async savePreferences(tripId, values) {
      const { data: session } = await client.auth.getUser();
      const userId = session.user?.id;
      if (!userId) throw new Error('Connexion requise');

      const weights = Object.fromEntries(
        Object.entries(values.weights).filter(
          (entry): entry is [string, number] => typeof entry[1] === 'number' && entry[1] > 0,
        ),
      );

      const { error } = await client.from('member_preferences').upsert(
        {
          trip_id: tripId,
          user_id: userId,
          weights,
          budget_max_cents: values.budgetMaxCents,
          avoid: values.avoid ?? [],
          submitted: true,
        },
        { onConflict: 'trip_id,user_id' },
      );
      if (error) throw error;
    },

    watchGroup(tripId, onChange) {
      const channel = client
        .channel(`voyage:${tripId}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'trip_members', filter: `trip_id=eq.${tripId}` },
          onChange,
        )
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'member_preferences',
            filter: `trip_id=eq.${tripId}`,
          },
          onChange,
        )
        .subscribe();

      return () => {
        void client.removeChannel(channel);
      };
    },
  };
}
