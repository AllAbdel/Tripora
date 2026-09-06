import type { PreferenceWeights } from '@tripora/core';
import { supabase } from './supabase';
import type { TripDraft } from '@/stores/tripDraft';

/**
 * Accès aux voyages.
 *
 * Deux implémentations derrière la même interface : la base Supabase quand elle
 * est configurée, le stockage de l'appareil sinon. L'interface ne peut pas
 * exposer de fonctions de collaboration, puisque le mode local ne saurait pas
 * les tenir — c'est volontaire : mieux vaut une capacité absente qu'une
 * capacité qui ment.
 */
export interface TripSummary {
  id: string;
  title: string;
  status: string;
  participants: number;
  destinationName: string | null;
  coverImageUrl: string | null;
  createdAt: string;
  /** Vrai quand le voyage ne vit que sur cet appareil. */
  localOnly: boolean;
}

export interface TripRepository {
  readonly kind: 'supabase' | 'local';
  list(): Promise<TripSummary[]>;
  create(draft: TripDraft, title: string): Promise<string>;
  remove(id: string): Promise<void>;
}

const LOCAL_KEY = 'tripora.local-trips';

interface LocalTrip {
  id: string;
  title: string;
  createdAt: string;
  draft: TripDraft;
}

function readLocal(): LocalTrip[] {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    return raw ? (JSON.parse(raw) as LocalTrip[]) : [];
  } catch {
    return [];
  }
}

function writeLocal(trips: LocalTrip[]): void {
  localStorage.setItem(LOCAL_KEY, JSON.stringify(trips));
}

const localRepository: TripRepository = {
  kind: 'local',

  async list() {
    return readLocal()
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((trip) => ({
        id: trip.id,
        title: trip.title,
        status: 'draft',
        participants: trip.draft.participants,
        destinationName: null,
        coverImageUrl: null,
        createdAt: trip.createdAt,
        localOnly: true,
      }));
  },

  async create(draft, title) {
    const trip: LocalTrip = {
      id: crypto.randomUUID(),
      title,
      createdAt: new Date().toISOString(),
      draft,
    };
    writeLocal([trip, ...readLocal()]);
    return trip.id;
  },

  async remove(id) {
    writeLocal(readLocal().filter((trip) => trip.id !== id));
  },
};

function supabaseRepository(client: NonNullable<typeof supabase>): TripRepository {
  return {
    kind: 'supabase',

    async list() {
      const { data, error } = await client
        .from('trips')
        .select('id, title, status, participants, cover_image_url, created_at, destination_locked_id')
        .is('deleted_at', null)
        .order('created_at', { ascending: false });
      if (error) throw error;

      return (data ?? []).map((row) => ({
        id: row.id as string,
        title: row.title as string,
        status: row.status as string,
        participants: row.participants as number,
        destinationName: (row.destination_locked_id as string | null) ?? null,
        coverImageUrl: (row.cover_image_url as string | null) ?? null,
        createdAt: row.created_at as string,
        localOnly: false,
      }));
    },

    async create(draft, title) {
      const { data: session } = await client.auth.getUser();
      const userId = session.user?.id;
      if (!userId) throw new Error('Connexion requise pour créer un voyage');

      const { data, error } = await client
        .from('trips')
        .insert({
          owner_id: userId,
          title,
          status: draft.destinationMode === 'suggest' ? 'proposing' : 'planned',
          origin_name: draft.origin?.name ?? null,
          origin_lat: draft.origin?.lat ?? null,
          origin_lng: draft.origin?.lng ?? null,
          origin_iata: draft.origin?.iata ?? null,
          destination_locked_id:
            draft.destinationMode === 'fixed' ? (draft.destinationIds[0] ?? null) : null,
          participants: draft.participants,
          group_type: draft.groupType,
          date_mode: draft.dateMode,
          start_date: draft.startDate,
          end_date: draft.endDate,
          window_start: draft.windowStart,
          window_end: draft.windowEnd,
          target_month: draft.month,
          duration_days: draft.durationDays,
          budget_mode: draft.budgetMode,
          budget_per_person_cents: draft.budgetPerPersonCents,
          comfort_level: draft.comfortLevel,
        })
        .select('id')
        .single();
      if (error) throw error;

      const tripId = data.id as string;

      // Les envies du créateur sont ses préférences personnelles, pas celles du
      // groupe : elles sont enregistrées comme celles de n'importe quel membre.
      const { error: preferenceError } = await client.from('member_preferences').insert({
        trip_id: tripId,
        user_id: userId,
        weights: pruneWeights(draft.weights),
        budget_max_cents: draft.budgetPerPersonCents,
        avoid: draft.avoid,
        submitted: true,
      });
      if (preferenceError) throw preferenceError;

      return tripId;
    },

    async remove(id) {
      const { error } = await client
        .from('trips')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
  };
}

/** N'enregistre que les axes réellement exprimés : le reste est du bruit. */
function pruneWeights(weights: Partial<PreferenceWeights>): Record<string, number> {
  return Object.fromEntries(
    Object.entries(weights).filter(
      (entry): entry is [string, number] => typeof entry[1] === 'number' && entry[1] > 0,
    ),
  );
}

export function getTripRepository(): TripRepository {
  return supabase ? supabaseRepository(supabase) : localRepository;
}
