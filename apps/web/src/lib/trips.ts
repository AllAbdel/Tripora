import {
  findDestination,
  normalizeWeights,
  rememberDestination,
  type MemberPreference,
  type PreferenceAxis,
  type PreferenceWeights,
  type TripConstraints,
} from '@tripora/core';
import { supabase } from './supabase';
import { destinationLocaleRetenue } from './votes';
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
  /** Code ISO du pays de la destination retenue, pour en afficher le drapeau. */
  destinationCountryCode: string | null;
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
        destinationCountryCode: null,
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
    const retenue = destinationLocaleRetenue(trip.id);
    return {
      summary: {
        id: trip.id,
        title: trip.title,
        status: retenue ? 'planned' : 'draft',
        participants: trip.draft.participants,
        destinationName: retenue ? (findDestination(retenue)?.name ?? retenue) : null,
        destinationCountryCode: retenue ? (findDestination(retenue)?.countryCode ?? null) : null,
        coverImageUrl: null,
        createdAt: trip.createdAt,
        localOnly: true,
      },
      constraints,
      isOwner: true,
      lockedDestinationId: retenue,
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

/**
 * Résout les villes découvertes avant d'afficher quoi que ce soit.
 *
 * Le catalogue curé est compilé dans l'application : il est là dès le premier
 * rendu. Une ville venue du géocodage ne l'est pas — elle vit dans la base.
 * Sans cette relecture, un voyage vers Kyoto rouvert le lendemain, ou ouvert
 * par un autre membre du groupe, n'afficherait que son identifiant technique.
 *
 * Silencieux en cas d'échec : le voyage s'affiche sans son nom de destination,
 * ce qui reste très au-dessus d'un écran vide.
 */
async function hydraterDecouvertes(
  client: NonNullable<typeof supabase>,
  ids: (string | null)[],
): Promise<void> {
  const manquantes = [...new Set(ids)].filter(
    (id): id is string => typeof id === 'string' && id !== '' && !findDestination(id),
  );
  if (manquantes.length === 0) return;

  const { data } = await client
    .from('destinations')
    .select('id, name, country, country_code, lat, lng, iata, tags, cost_index, poi_richness, best_months, timezone, image_url, discovered')
    .in('id', manquantes);

  for (const row of data ?? []) {
    rememberDestination({
      id: row.id as string,
      name: row.name as string,
      country: row.country as string,
      countryCode: row.country_code as string,
      lat: row.lat as number,
      lng: row.lng as number,
      iata: (row.iata ?? []) as string[],
      tags: normalizeWeights((row.tags ?? {}) as Record<string, number>),
      costIndex: Number(row.cost_index),
      poiRichness: Number(row.poi_richness),
      bestMonths: (row.best_months ?? []) as number[],
      ...(row.timezone ? { timezone: row.timezone as string } : {}),
      ...(row.image_url ? { imageUrl: row.image_url as string } : {}),
      discovered: Boolean(row.discovered),
    });
  }
}

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

      await hydraterDecouvertes(
        client,
        (data ?? []).map((row) => (row.destination_locked_id as string | null) ?? null),
      );

      return (data ?? []).map((row) => {
        const lockedId = (row.destination_locked_id as string | null) ?? null;
        return {
        id: row.id as string,
        title: row.title as string,
        status: row.status as string,
        participants: row.participants as number,
        // La colonne stocke un identifiant technique : on affiche le nom.
        destinationName: lockedId ? (findDestination(lockedId)?.name ?? lockedId) : null,
        destinationCountryCode: lockedId ? (findDestination(lockedId)?.countryCode ?? null) : null,
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
      await hydraterDecouvertes(client, [lockedId]);

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
          destinationCountryCode: lockedId
            ? (findDestination(lockedId)?.countryCode ?? null)
            : null,
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
