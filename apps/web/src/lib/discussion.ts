import { supabase } from './supabase';

/**
 * La discussion du voyage, et les endroits qu'on y épingle.
 *
 * Un voyage se prépare dans une conversation, pas dans un formulaire :
 * quelqu'un tombe sur un endroit dans une vidéo, colle le lien, et le groupe en
 * discute. Ce module transporte ces messages, et transforme ceux qui comptent
 * en épingles — un nom, une adresse, un point sur la carte.
 *
 * Comme le reste de la collaboration, il n'existe qu'avec un serveur :
 * `getDiscussion()` renvoie `null` en mode local plutôt qu'une conversation
 * qui ne parlerait qu'à soi-même.
 */

export interface Message {
  id: string;
  authorId: string;
  authorName: string;
  authorAvatar: string | null;
  body: string;
  createdAt: string;
  /** Épingle déjà créée à partir de ce message, s'il y en a une. */
  pinId: string | null;
}

export interface Epingle {
  id: string;
  label: string;
  address: string | null;
  lat: number | null;
  lng: number | null;
  url: string | null;
  note: string | null;
  createdBy: string;
  createdAt: string;
  messageId: string | null;
}

/** Ce qu'il faut pour poser une épingle. Les coordonnées restent optionnelles :
 *  on peut retenir un endroit avant de savoir où il est exactement. */
export interface NouvelleEpingle {
  label: string;
  address?: string | null;
  lat?: number | null;
  lng?: number | null;
  url?: string | null;
  note?: string | null;
  messageId?: string | null;
}

export interface DiscussionApi {
  listMessages(tripId: string): Promise<Message[]>;
  sendMessage(tripId: string, body: string): Promise<void>;
  deleteMessage(messageId: string): Promise<void>;
  listPins(tripId: string): Promise<Epingle[]>;
  addPin(tripId: string, epingle: NouvelleEpingle): Promise<Epingle>;
  updatePin(pinId: string, valeurs: Partial<NouvelleEpingle>): Promise<void>;
  removePin(pinId: string): Promise<void>;
  /** Rappelle `onChange` dès qu'un message ou une épingle bouge. */
  watchDiscussion(tripId: string, onChange: () => void): () => void;
}

interface LigneMessage {
  id: string;
  author_id: string;
  body: string;
  created_at: string;
  profiles: { display_name: string | null; avatar_url: string | null } | null;
}

function versEpingle(row: Record<string, unknown>): Epingle {
  return {
    id: row['id'] as string,
    label: row['label'] as string,
    address: (row['address'] as string | null) ?? null,
    lat: (row['lat'] as number | null) ?? null,
    lng: (row['lng'] as number | null) ?? null,
    url: (row['url'] as string | null) ?? null,
    note: (row['note'] as string | null) ?? null,
    createdBy: row['created_by'] as string,
    createdAt: row['created_at'] as string,
    messageId: (row['message_id'] as string | null) ?? null,
  };
}

function discussionApi(client: NonNullable<typeof supabase>): DiscussionApi {
  return {
    async listMessages(tripId) {
      const { data, error } = await client
        .from('trip_messages')
        .select('id, author_id, body, created_at, profiles:author_id(display_name, avatar_url)')
        .eq('trip_id', tripId)
        .is('deleted_at', null)
        .order('created_at', { ascending: true })
        .limit(500);
      if (error) throw error;

      // Les épingles portent le message dont elles viennent : on les relit ici
      // pour que le fil sache lesquels sont déjà retenus, sans second aller-retour
      // au moment de l'affichage.
      const { data: pins } = await client
        .from('trip_pins')
        .select('id, message_id')
        .eq('trip_id', tripId)
        .is('deleted_at', null);
      const parMessage = new Map<string, string>();
      for (const pin of pins ?? []) {
        const messageId = pin.message_id as string | null;
        if (messageId) parMessage.set(messageId, pin.id as string);
      }

      return ((data ?? []) as unknown as LigneMessage[]).map((row) => ({
        id: row.id,
        authorId: row.author_id,
        authorName: row.profiles?.display_name ?? 'Voyageur',
        authorAvatar: row.profiles?.avatar_url ?? null,
        body: row.body,
        createdAt: row.created_at,
        pinId: parMessage.get(row.id) ?? null,
      }));
    },

    async sendMessage(tripId, body) {
      const texte = body.trim();
      if (texte === '') return;
      const { data: session } = await client.auth.getUser();
      const userId = session.user?.id;
      if (!userId) throw new Error('Connexion requise pour écrire');

      const { error } = await client
        .from('trip_messages')
        .insert({ trip_id: tripId, author_id: userId, body: texte.slice(0, 2000) });
      if (error) throw error;
    },

    // Effacer laisse la ligne en place : une épingle issue de ce message garde
    // son origine, et le fil ne se réécrit pas sous les yeux des autres.
    async deleteMessage(messageId) {
      const { error } = await client
        .from('trip_messages')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', messageId);
      if (error) throw error;
    },

    async listPins(tripId) {
      const { data, error } = await client
        .from('trip_pins')
        .select('*')
        .eq('trip_id', tripId)
        .is('deleted_at', null)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data ?? []).map((row) => versEpingle(row as Record<string, unknown>));
    },

    async addPin(tripId, epingle) {
      const { data: session } = await client.auth.getUser();
      const userId = session.user?.id;
      if (!userId) throw new Error('Connexion requise pour épingler');

      const { data, error } = await client
        .from('trip_pins')
        .insert({
          trip_id: tripId,
          created_by: userId,
          label: epingle.label.trim().slice(0, 120),
          address: epingle.address?.trim().slice(0, 300) ?? null,
          // La contrainte de la base exige les deux ou aucune : une latitude
          // seule ne place rien, et laisserait une épingle au large de l'Afrique.
          lat: epingle.lat ?? null,
          lng: epingle.lng ?? null,
          url: epingle.url?.slice(0, 2000) ?? null,
          note: epingle.note?.trim().slice(0, 1000) ?? null,
          message_id: epingle.messageId ?? null,
        })
        .select('*')
        .single();
      if (error) throw error;
      return versEpingle(data as Record<string, unknown>);
    },

    async updatePin(pinId, valeurs) {
      const patch: Record<string, unknown> = {};
      if (valeurs.label !== undefined) patch['label'] = valeurs.label.trim().slice(0, 120);
      if (valeurs.address !== undefined) patch['address'] = valeurs.address?.trim() ?? null;
      if (valeurs.note !== undefined) patch['note'] = valeurs.note?.trim() ?? null;
      if (valeurs.lat !== undefined) patch['lat'] = valeurs.lat ?? null;
      if (valeurs.lng !== undefined) patch['lng'] = valeurs.lng ?? null;
      if (Object.keys(patch).length === 0) return;

      const { error } = await client.from('trip_pins').update(patch).eq('id', pinId);
      if (error) throw error;
    },

    async removePin(pinId) {
      const { error } = await client
        .from('trip_pins')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', pinId);
      if (error) throw error;
    },

    watchDiscussion(tripId, onChange) {
      const channel = client
        .channel(`discussion:${tripId}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'trip_messages', filter: `trip_id=eq.${tripId}` },
          onChange,
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'trip_pins', filter: `trip_id=eq.${tripId}` },
          onChange,
        )
        .subscribe();

      return () => {
        void client.removeChannel(channel);
      };
    },
  };
}

export function getDiscussion(): DiscussionApi | null {
  return supabase ? discussionApi(supabase) : null;
}
