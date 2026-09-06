import {
  findDestination,
  normalizeWeights,
  type MemberPreference,
  type PreferenceAxis,
  type PreferenceWeights,
  type TripConstraints,
} from '@tripora/core';
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

/** Un voyage complet : de quoi recalculer des propositions sans rien inventer. */
export interface TripDetails {
  summary: TripSummary;
  constraints: TripConstraints;
  members: MemberPreference[];
  /** Seul l'organisateur peut verrouiller la destination du groupe. */
  isOwner: boolean;
  /** Destination tranchée par le groupe, si le vote a abouti. */
  lockedDestinationId: string | null;
}

export interface TripRepository {
  readonly kind: 'supabase' | 'local';
  list(): Promise<TripSummary[]>;
  get(id: string): Promise<TripDetails | null>;
  create(draft: TripDraft, title: string): Promise<string>;
  remove(id: string): Promise<void>;
}

/** Reconstitue les contraintes du moteur depuis un brouillon enregistré. */
function constraintsFromDraft(draft: TripDraft): TripConstraints | null {
  if (!draft.origin) return null;
  return {
    participants: draft.participants,
    origin: draft.origin,
    durationDays: draft.durationDays,
    dateMode: draft.dateMode,
    ...(draft.startDate ? { startDate: draft.startDate } : {}),
    ...(draft.endDate ? { endDate: draft.endDate } : {}),
    ...(draft.windowStart ? { windowStart: draft.windowStart } : {}),
    ...(draft.windowEnd ? { windowEnd: draft.windowEnd } : {}),
    ...(draft.month !== null ? { month: draft.month } : {}),
    budgetMode: draft.budgetMode,
    budgetPerPersonCents: draft.budgetPerPersonCents,
    comfortLevel: draft.comfortLevel,
    groupType: draft.groupType,
  };
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

  async get(id) {
    const trip = readLocal().find((entry) => entry.id === id);
    if (!trip) return null;
    const constraints = constraintsFromDraft(trip.draft);
    if (!constraints) return null;
    return {
      summary: {
        id: trip.id,
        title: trip.title,
        status: 'draft',
        participants: trip.draft.participants,
        destinationName: null,
        coverImageUrl: null,
        createdAt: trip.createdAt,
        localOnly: true,
      },
      constraints,
      isOwner: true,
      lockedDestinationId: null,
      members: [
        {
          userId: 'moi',
          displayName: 'Vous',
          weights: normalizeWeights(trip.draft.weights),
          budgetMaxCents: trip.draft.budgetPerPersonCents,
          avoid: trip.draft.avoid,
        },
      ],
    };
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

      return (data ?? []).map((row) => {
        const lockedId = (row.destination_locked_id as string | null) ?? null;
        return {
        id: row.id as string,
        title: row.title as string,
        status: row.status as string,
        participants: row.participants as number,
        // La colonne stocke un identifiant technique : on affiche le nom.
        destinationName: lockedId ? (findDestination(lockedId)?.name ?? lockedId) : null,
        coverImageUrl: (row.cover_image_url as string | null) ?? null,
        createdAt: row.created_at as string,
        localOnly: false,
        };
      });
    },

    async get(id) {
      const { data, error } = await client
        .from('trips')
        .select('*, member_preferences(*)')
        .eq('id', id)
        .is('deleted_at', null)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;

      const originLat = data.origin_lat as number | null;
      const originLng = data.origin_lng as number | null;
      if (originLat === null || originLng === null) return null;

      const { data: session } = await client.auth.getUser();
      const lockedId = (data.destination_locked_id as string | null) ?? null;

      const preferences = (data.member_preferences ?? []) as {
        user_id: string;
        weights: Record<string, number>;
        budget_max_cents: number | null;
        avoid: string[] | null;
      }[];

      return {
        isOwner: data.owner_id === session.user?.id,
        lockedDestinationId: lockedId,
        summary: {
          id: data.id as string,
          title: data.title as string,
          status: data.status as string,
          participants: data.participants as number,
          destinationName: lockedId ? (findDestination(lockedId)?.name ?? lockedId) : null,
          coverImageUrl: (data.cover_image_url as string | null) ?? null,
          createdAt: data.created_at as string,
          localOnly: false,
        },
        constraints: {
          participants: data.participants as number,
          origin: {
            name: (data.origin_name as string) ?? 'Départ',
            lat: originLat,
            lng: originLng,
            ...(data.origin_iata ? { iata: data.origin_iata as string[] } : {}),
          },
          durationDays: data.duration_days as number,
          dateMode: data.date_mode as TripConstraints['dateMode'],
          ...(data.start_date ? { startDate: data.start_date as string } : {}),
          ...(data.end_date ? { endDate: data.end_date as string } : {}),
          ...(data.window_start ? { windowStart: data.window_start as string } : {}),
          ...(data.window_end ? { windowEnd: data.window_end as string } : {}),
          ...(data.target_month ? { month: data.target_month as number } : {}),
          budgetMode: data.budget_mode as TripConstraints['budgetMode'],
          budgetPerPersonCents: data.budget_per_person_cents as number | null,
          comfortLevel: data.comfort_level as TripConstraints['comfortLevel'],
          groupType: data.group_type as TripConstraints['groupType'],
        },
        members: preferences.map((row) => ({
          userId: row.user_id,
          weights: normalizeWeights(row.weights),
          budgetMaxCents: row.budget_max_cents,
          avoid: (row.avoid ?? []) as PreferenceAxis[],
        })),
      };
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
