import type { Itinerary, PreferenceAxis, SlotKind } from '@tripora/core';
import { supabase } from './supabase';

/**
 * Enregistrement et modification de l'itinéraire.
 *
 * Le plan est déterministe : mêmes contraintes, mêmes envies, même résultat
 * pour tout le monde. On pourrait donc le recalculer à chaque affichage sans
 * rien stocker — mais dès que le groupe y touche, ce sont ses modifications
 * qui font foi. Le plan est donc **matérialisé à la première ouverture**, et
 * la base devient la vérité. Régénérer est ensuite un geste explicite, qui
 * prévient qu'il effacera les ajouts.
 */

export interface ItineraryItem {
  id: string;
  kind: SlotKind;
  axis: PreferenceAxis | null;
  title: string;
  startTime: string | null;
  endTime: string | null;
  costCents: number;
  notes: string | null;
  reason: string | null;
  forUserId: string | null;
  position: number;
}

export interface ItineraryDayView {
  id: string;
  dayIndex: number;
  date: string | null;
  summary: string;
  items: ItineraryItem[];
}

export interface ItineraryApi {
  readonly kind: 'supabase' | 'local';
  load(tripId: string): Promise<ItineraryDayView[] | null>;
  materialise(tripId: string, plan: Itinerary): Promise<void>;
  addItem(
    dayId: string,
    item: {
      title: string;
      startTime: string | null;
      costCents: number;
      notes: string | null;
      /** Laissée libre, l'élément va en fin de journée. */
      position?: number;
    },
  ): Promise<void>;
  updateItem(
    itemId: string,
    patch: Partial<Pick<ItineraryItem, 'title' | 'startTime' | 'costCents' | 'notes'>>,
  ): Promise<void>;
  removeItem(itemId: string): Promise<void>;
  /** Déplace un élément entre ses deux voisins, sans renuméroter les autres. */
  moveItem(itemId: string, avant: number | null, apres: number | null): Promise<void>;
  reset(tripId: string): Promise<void>;
}

/**
 * Position à mi-chemin de deux voisines.
 *
 * Des positions fractionnaires évitent de réécrire toute la journée pour
 * déplacer un élément : une seule ligne change, et deux personnes qui
 * réorganisent en même temps ne s'écrasent pas.
 */
export function positionEntre(avant: number | null, apres: number | null): number {
  if (avant === null && apres === null) return 10;
  if (avant === null) return apres! - 10;
  if (apres === null) return avant + 10;
  return (avant + apres) / 2;
}

/**
 * Où insérer un élément pour qu'il tombe à la bonne heure.
 *
 * Sans cela, un lieu ajouté à 10 h 30 se retrouvait après celui de 16 h 30,
 * simplement parce qu'il avait été saisi plus tard. L'ordre reste ensuite
 * modifiable à la main : on respecte l'heure au moment de l'ajout, pas après.
 */
export function positionPourHeure(
  items: readonly { position: number; startTime: string | null }[],
  heure: string | null,
): number | undefined {
  if (!heure) return undefined;
  const suivant = items.find((item) => item.startTime !== null && item.startTime > heure);
  if (!suivant) return undefined;
  const index = items.indexOf(suivant);
  return positionEntre(index > 0 ? items[index - 1]!.position : null, suivant.position);
}

// ------------------------------------------------------------- Mode local --

const CLE_LOCALE = 'tripora.local-itineraries';

type StockLocal = Record<string, ItineraryDayView[]>;

function lireLocal(): StockLocal {
  try {
    const brut = localStorage.getItem(CLE_LOCALE);
    return brut ? (JSON.parse(brut) as StockLocal) : {};
  } catch {
    return {};
  }
}

function ecrireLocal(stock: StockLocal): void {
  localStorage.setItem(CLE_LOCALE, JSON.stringify(stock));
}

function trouverLocal(
  stock: StockLocal,
  itemId: string,
): { jour: ItineraryDayView; index: number } | null {
  for (const jours of Object.values(stock)) {
    for (const jour of jours) {
      const index = jour.items.findIndex((item) => item.id === itemId);
      if (index >= 0) return { jour, index };
    }
  }
  return null;
}

const itineraireLocal: ItineraryApi = {
  kind: 'local',

  async load(tripId) {
    return lireLocal()[tripId] ?? null;
  },

  async materialise(tripId, plan) {
    const stock = lireLocal();
    stock[tripId] = plan.days.map((day) => ({
      id: `${tripId}-j${day.dayIndex}`,
      dayIndex: day.dayIndex,
      date: day.date ?? null,
      summary: day.summary,
      items: day.slots.map((slot) => ({
        id: crypto.randomUUID(),
        kind: slot.kind,
        axis: slot.axis ?? null,
        title: slot.title,
        startTime: slot.startTime,
        endTime: slot.endTime ?? null,
        costCents: slot.budgetCents,
        notes: null,
        reason: slot.reason,
        forUserId: slot.forUserId ?? null,
        position: slot.position,
      })),
    }));
    ecrireLocal(stock);
  },

  async addItem(dayId, item) {
    const stock = lireLocal();
    for (const jours of Object.values(stock)) {
      const jour = jours.find((entree) => entree.id === dayId);
      if (!jour) continue;
      const derniere = jour.items.at(-1)?.position ?? 0;
      jour.items.push({
        id: crypto.randomUUID(),
        kind: 'activity',
        axis: null,
        title: item.title,
        startTime: item.startTime,
        endTime: null,
        costCents: item.costCents,
        notes: item.notes,
        reason: 'Ajouté par le groupe',
        forUserId: null,
        position: item.position ?? derniere + 10,
      });
      jour.items.sort((a, b) => a.position - b.position);
      ecrireLocal(stock);
      return;
    }
  },

  async updateItem(itemId, patch) {
    const stock = lireLocal();
    const trouve = trouverLocal(stock, itemId);
    if (!trouve) return;
    trouve.jour.items[trouve.index] = { ...trouve.jour.items[trouve.index]!, ...patch };
    ecrireLocal(stock);
  },

  async removeItem(itemId) {
    const stock = lireLocal();
    const trouve = trouverLocal(stock, itemId);
    if (!trouve) return;
    trouve.jour.items.splice(trouve.index, 1);
    ecrireLocal(stock);
  },

  async moveItem(itemId, avant, apres) {
    const stock = lireLocal();
    const trouve = trouverLocal(stock, itemId);
    if (!trouve) return;
    trouve.jour.items[trouve.index]!.position = positionEntre(avant, apres);
    trouve.jour.items.sort((a, b) => a.position - b.position);
    ecrireLocal(stock);
  },

  async reset(tripId) {
    const stock = lireLocal();
    delete stock[tripId];
    ecrireLocal(stock);
  },
};

// ---------------------------------------------------------- Mode Supabase --

function itineraireSupabase(client: NonNullable<typeof supabase>): ItineraryApi {
  return {
    kind: 'supabase',

    async load(tripId) {
      const { data: itineraire, error } = await client
        .from('itineraries')
        .select('id')
        .eq('trip_id', tripId)
        .eq('is_active', true)
        .order('version', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      if (!itineraire) return null;

      const { data: jours, error: erreurJours } = await client
        .from('itinerary_days')
        .select('id, day_index, date, summary')
        .eq('itinerary_id', itineraire.id)
        .order('day_index');
      if (erreurJours) throw erreurJours;
      if (!jours || jours.length === 0) return null;

      const { data: items, error: erreurItems } = await client
        .from('itinerary_items')
        .select('id, day_id, position, kind, axis, title, start_time, end_time, cost_cents, notes, reason, for_user_id')
        .in('day_id', jours.map((jour) => jour.id))
        .order('position');
      if (erreurItems) throw erreurItems;

      const parJour = new Map<string, ItineraryItem[]>();
      for (const row of items ?? []) {
        const liste = parJour.get(row.day_id as string) ?? [];
        liste.push({
          id: row.id as string,
          kind: row.kind as SlotKind,
          axis: (row.axis as PreferenceAxis | null) ?? null,
          title: row.title as string,
          startTime: (row.start_time as string | null)?.slice(0, 5) ?? null,
          endTime: (row.end_time as string | null)?.slice(0, 5) ?? null,
          costCents: (row.cost_cents as number | null) ?? 0,
          notes: (row.notes as string | null) ?? null,
          reason: (row.reason as string | null) ?? null,
          forUserId: (row.for_user_id as string | null) ?? null,
          position: Number(row.position),
        });
        parJour.set(row.day_id as string, liste);
      }

      return jours.map((jour) => ({
        id: jour.id as string,
        dayIndex: jour.day_index as number,
        date: (jour.date as string | null) ?? null,
        summary: (jour.summary as string | null) ?? '',
        items: parJour.get(jour.id as string) ?? [],
      }));
    },

    async materialise(tripId, plan) {
      const { data: session } = await client.auth.getUser();
      const userId = session.user?.id ?? null;

      const { data: itineraire, error } = await client
        .from('itineraries')
        .insert({ trip_id: tripId, version: Date.now() % 30000, generated_by: 'engine' })
        .select('id')
        .single();
      if (error) throw error;

      const { data: jours, error: erreurJours } = await client
        .from('itinerary_days')
        .insert(
          plan.days.map((day) => ({
            itinerary_id: itineraire.id,
            day_index: day.dayIndex,
            date: day.date ?? null,
            summary: day.summary,
          })),
        )
        .select('id, day_index');
      if (erreurJours) throw erreurJours;

      const parIndex = new Map((jours ?? []).map((jour) => [jour.day_index as number, jour.id]));
      const items = plan.days.flatMap((day) =>
        day.slots.map((slot) => ({
          day_id: parIndex.get(day.dayIndex),
          position: slot.position,
          kind: slot.kind,
          axis: slot.axis ?? null,
          title: slot.title,
          start_time: slot.startTime,
          end_time: slot.endTime ?? null,
          cost_cents: slot.budgetCents,
          reason: slot.reason,
          for_user_id: slot.forUserId ?? null,
          created_by: userId,
        })),
      );
      const { error: erreurItems } = await client.from('itinerary_items').insert(items);
      if (erreurItems) throw erreurItems;
    },

    async addItem(dayId, item) {
      const { data: session } = await client.auth.getUser();
      const { data: derniere } = await client
        .from('itinerary_items')
        .select('position')
        .eq('day_id', dayId)
        .order('position', { ascending: false })
        .limit(1)
        .maybeSingle();

      const { error } = await client.from('itinerary_items').insert({
        day_id: dayId,
        position: item.position ?? Number(derniere?.position ?? 0) + 10,
        kind: 'activity',
        title: item.title,
        start_time: item.startTime,
        cost_cents: item.costCents,
        notes: item.notes,
        reason: 'Ajouté par le groupe',
        created_by: session.user?.id ?? null,
      });
      if (error) throw error;
    },

    async updateItem(itemId, patch) {
      const { error } = await client
        .from('itinerary_items')
        .update({
          ...(patch.title !== undefined ? { title: patch.title } : {}),
          ...(patch.startTime !== undefined ? { start_time: patch.startTime } : {}),
          ...(patch.costCents !== undefined ? { cost_cents: patch.costCents } : {}),
          ...(patch.notes !== undefined ? { notes: patch.notes } : {}),
        })
        .eq('id', itemId);
      if (error) throw error;
    },

    async removeItem(itemId) {
      const { error } = await client.from('itinerary_items').delete().eq('id', itemId);
      if (error) throw error;
    },

    async moveItem(itemId, avant, apres) {
      const { error } = await client
        .from('itinerary_items')
        .update({ position: positionEntre(avant, apres) })
        .eq('id', itemId);
      if (error) throw error;
    },

    async reset(tripId) {
      // La suppression en cascade emporte journées et créneaux.
      const { error } = await client.from('itineraries').delete().eq('trip_id', tripId);
      if (error) throw error;
    },
  };
}

export function getItinerary(): ItineraryApi {
  return supabase ? itineraireSupabase(supabase) : itineraireLocal;
}
