import type { Besoin, ProfilValise, RubriqueValise } from '@tripora/core';
import { supabase } from './supabase';

/**
 * Ce qui s'écarte de la valise calculée, et qui emporte quoi.
 *
 * La liste elle-même n'est jamais stockée : elle se recalcule à chaque
 * ouverture depuis la ville, le mois, la durée et les envies. La garder en base
 * voudrait dire qu'elle se périme — un séjour rallongé, une destination
 * changée, et la valise conseillerait encore des shorts pour janvier.
 *
 * Ne voyagent donc jusqu'au serveur que les décisions : ce qui est coché, ce
 * qui a été écarté, une quantité corrigée, un article ajouté à la main, et la
 * seule information qui traverse les personnes — qui se charge d'un article
 * pour tout le groupe.
 */

export interface EtatArticle {
  itemId: string;
  checked: boolean;
  removed: boolean;
  /** Quantité corrigée à la main, ou `null` si celle du calcul convient. */
  quantity: number | null;
  /** Renseignés seulement pour un ajout personnel. */
  label: string | null;
  category: RubriqueValise | null;
  forGroup: boolean;
  userId: string;
}

export interface ValiseApi {
  /** Toutes les valises du voyage : la sienne, et les prises en charge des autres. */
  list(tripId: string): Promise<EtatArticle[]>;
  /** Le profil de la personne connectée. Celui des autres n'est pas lisible. */
  loadProfile(tripId: string): Promise<ProfilValise | null>;
  saveProfile(tripId: string, profil: ProfilValise): Promise<void>;
  /** Crée ou met à jour une ligne. Les champs absents ne sont pas touchés. */
  set(tripId: string, itemId: string, valeurs: Partial<Omit<EtatArticle, 'itemId' | 'userId'>>): Promise<void>;
  /** Supprime la ligne : l'article revient à ce que le calcul propose. */
  reset(tripId: string, itemId: string): Promise<void>;
  watch(tripId: string, onChange: () => void): () => void;
}

/** Un identifiant d'ajout personnel, dérivé de son intitulé. */
export function identifiantPersonnel(label: string): string {
  const base = label
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, '-')
    .replace(/^-+|-+$/gu, '')
    .slice(0, 50);
  return `perso:${base.length >= 2 ? base : 'article'}`;
}

function versEtat(row: Record<string, unknown>): EtatArticle {
  return {
    itemId: row['item_id'] as string,
    checked: Boolean(row['checked']),
    removed: Boolean(row['removed']),
    quantity: (row['quantity'] as number | null) ?? null,
    label: (row['label'] as string | null) ?? null,
    category: (row['category'] as RubriqueValise | null) ?? null,
    forGroup: Boolean(row['for_group']),
    userId: row['user_id'] as string,
  };
}

function valiseApi(client: NonNullable<typeof supabase>): ValiseApi {
  const moi = async () => (await client.auth.getUser()).data.user?.id ?? null;

  return {
    async list(tripId) {
      const { data, error } = await client
        .from('trip_packing')
        .select('item_id, checked, removed, quantity, label, category, for_group, user_id')
        .eq('trip_id', tripId)
        .limit(1000);
      if (error) throw error;
      return (data ?? []).map((row) => versEtat(row as unknown as Record<string, unknown>));
    },

    async loadProfile(tripId) {
      const id = await moi();
      if (!id) return null;
      const { data, error } = await client
        .from('trip_packing_profiles')
        .select('needs, laundry, cabin_only')
        .eq('trip_id', tripId)
        .eq('user_id', id)
        .maybeSingle();
      if (error || !data) return null;
      return {
        besoins: ((data.needs as string[] | null) ?? []) as Besoin[],
        lessivePossible: Boolean(data.laundry),
        cabineSeulement: Boolean(data.cabin_only),
      };
    },

    async saveProfile(tripId, profil) {
      const id = await moi();
      if (!id) throw new Error('Connectez-vous pour enregistrer votre profil.');
      const { error } = await client.from('trip_packing_profiles').upsert(
        {
          trip_id: tripId,
          user_id: id,
          needs: [...profil.besoins],
          laundry: profil.lessivePossible,
          cabin_only: profil.cabineSeulement,
        },
        { onConflict: 'trip_id,user_id' },
      );
      if (error) throw error;
    },

    async set(tripId, itemId, valeurs) {
      const id = await moi();
      if (!id) throw new Error('Connectez-vous pour préparer votre valise.');
      const ligne: Record<string, unknown> = { trip_id: tripId, user_id: id, item_id: itemId };
      if (valeurs.checked !== undefined) ligne['checked'] = valeurs.checked;
      if (valeurs.removed !== undefined) ligne['removed'] = valeurs.removed;
      if (valeurs.quantity !== undefined) ligne['quantity'] = valeurs.quantity;
      if (valeurs.label !== undefined) ligne['label'] = valeurs.label;
      if (valeurs.category !== undefined) ligne['category'] = valeurs.category;
      if (valeurs.forGroup !== undefined) ligne['for_group'] = valeurs.forGroup;

      const { error } = await client
        .from('trip_packing')
        .upsert(ligne, { onConflict: 'trip_id,user_id,item_id' });
      if (error) throw error;
    },

    async reset(tripId, itemId) {
      const id = await moi();
      if (!id) return;
      const { error } = await client
        .from('trip_packing')
        .delete()
        .eq('trip_id', tripId)
        .eq('user_id', id)
        .eq('item_id', itemId);
      if (error) throw error;
    },

    watch(tripId, onChange) {
      const channel = client
        .channel(`valise:${tripId}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'trip_packing', filter: `trip_id=eq.${tripId}` },
          onChange,
        )
        .subscribe();
      return () => {
        void client.removeChannel(channel);
      };
    },
  };
}

export function getValise(): ValiseApi | null {
  return supabase ? valiseApi(supabase) : null;
}
