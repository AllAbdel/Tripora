import { queryOptions } from '@tanstack/react-query';
import {
  trierLesReservations,
  type DonneesDeReservation,
  type Reservation,
  type TypeDeReservation,
} from '@tripora/core';
import { supabase } from './supabase';

/**
 * Les réservations du groupe : l'hôtel, les visites, les trajets.
 *
 * Dans la table `reservations`, que tout le groupe lit et où chacun écrit les
 * siennes (les règles sont testées dans `supabase/tests/rls_test.sql`). Sans
 * serveur, elles vivent dans ce navigateur, comme le reste du voyage.
 */

export interface ReservationsApi {
  lister(tripId: string): Promise<Reservation[]>;
  ajouter(tripId: string, donnees: DonneesDeReservation): Promise<Reservation>;
  modifier(id: string, donnees: DonneesDeReservation): Promise<void>;
  supprimer(id: string): Promise<void>;
  ecouter(tripId: string, surChangement: () => void): () => void;
}

/** Une ligne de la base, lue sans lui faire confiance. */
interface Ligne {
  id: string;
  trip_id: string;
  type: string;
  fournisseur: string;
  titre: string;
  debut_le: string;
  debut_a: string | null;
  fin_le: string | null;
  fin_a: string | null;
  adresse: string | null;
  lat: number | null;
  lng: number | null;
  reference: string | null;
  lien: string | null;
  prix_cents: number | null;
  devise: string;
  notes: string | null;
  cree_par: string | null;
}

const TYPES: readonly TypeDeReservation[] = ['hebergement', 'activite', 'transport', 'restaurant', 'autre'];

/** « 15:00:00 » en base, « 15:00 » à l'écran. */
function heure(valeur: string | null): string | null {
  return valeur ? valeur.slice(0, 5) : null;
}

export function depuisLaBase(ligne: Ligne): Reservation {
  return {
    id: ligne.id,
    tripId: ligne.trip_id,
    type: (TYPES as readonly string[]).includes(ligne.type) ? (ligne.type as TypeDeReservation) : 'autre',
    fournisseur: ligne.fournisseur,
    titre: ligne.titre,
    debutLe: ligne.debut_le,
    debutA: heure(ligne.debut_a),
    finLe: ligne.fin_le,
    finA: heure(ligne.fin_a),
    adresse: ligne.adresse,
    lat: ligne.lat,
    lng: ligne.lng,
    reference: ligne.reference,
    lien: ligne.lien,
    prixCents: ligne.prix_cents,
    devise: ligne.devise,
    notes: ligne.notes,
    creePar: ligne.cree_par,
  };
}

/** Ce qu'on envoie : jamais l'auteur ni le voyage, que la base fixe elle-même. */
export function versLaBase(donnees: DonneesDeReservation) {
  const vide = (valeur: string | null | undefined) => (valeur && valeur.trim() !== '' ? valeur.trim() : null);
  return {
    type: donnees.type,
    fournisseur: donnees.fournisseur || 'autre',
    titre: donnees.titre.trim(),
    debut_le: donnees.debutLe,
    debut_a: vide(donnees.debutA),
    fin_le: vide(donnees.finLe),
    fin_a: vide(donnees.finA),
    adresse: vide(donnees.adresse),
    lat: donnees.lat ?? null,
    lng: donnees.lng ?? null,
    reference: vide(donnees.reference),
    lien: vide(donnees.lien),
    prix_cents: donnees.prixCents ?? null,
    devise: donnees.devise ?? 'EUR',
    notes: vide(donnees.notes),
  };
}

/* ------------------------------------------------------------ Mode local -- */

const CLE_LOCALE = 'tripora.local-reservations';

function lireLocal(): Reservation[] {
  try {
    const brut = localStorage.getItem(CLE_LOCALE);
    return brut ? (JSON.parse(brut) as Reservation[]) : [];
  } catch {
    return [];
  }
}

function ecrireLocal(reservations: Reservation[]): void {
  try {
    localStorage.setItem(CLE_LOCALE, JSON.stringify(reservations));
  } catch {
    // Stockage plein ou refusé : la réservation ne survivra pas au
    // rechargement, mais l'écran reste utilisable.
  }
}

const reservationsLocales: ReservationsApi = {
  async lister(tripId) {
    return trierLesReservations(lireLocal().filter((reservation) => reservation.tripId === tripId));
  },
  async ajouter(tripId, donnees) {
    const reservation: Reservation = {
      ...donnees,
      id: crypto.randomUUID(),
      tripId,
      devise: donnees.devise ?? 'EUR',
      creePar: 'moi',
    };
    ecrireLocal([...lireLocal(), reservation]);
    return reservation;
  },
  async modifier(id, donnees) {
    ecrireLocal(
      lireLocal().map((reservation) =>
        reservation.id === id ? { ...reservation, ...donnees, devise: donnees.devise ?? reservation.devise } : reservation,
      ),
    );
  },
  async supprimer(id) {
    ecrireLocal(lireLocal().filter((reservation) => reservation.id !== id));
  },
  ecouter() {
    return () => {};
  },
};

/* ---------------------------------------------------------- Mode serveur -- */

export function getReservations(): ReservationsApi {
  const client = supabase;
  if (!client) return reservationsLocales;

  return {
    async lister(tripId) {
      const { data, error } = await client
        .from('reservations')
        .select('*')
        .eq('trip_id', tripId)
        .order('debut_le', { ascending: true })
        .order('debut_a', { ascending: true, nullsFirst: false });
      if (error) throw error;
      return (data as Ligne[]).map(depuisLaBase);
    },

    async ajouter(tripId, donnees) {
      const { data, error } = await client
        .from('reservations')
        .insert({ ...versLaBase(donnees), trip_id: tripId })
        .select('*')
        .single();
      if (error) throw error;
      return depuisLaBase(data as Ligne);
    },

    async modifier(id, donnees) {
      const { error } = await client.from('reservations').update(versLaBase(donnees)).eq('id', id);
      if (error) throw error;
    },

    async supprimer(id) {
      const { error } = await client.from('reservations').delete().eq('id', id);
      if (error) throw error;
    },

    ecouter(tripId, surChangement) {
      const canal = client
        .channel(`reservations:${tripId}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'reservations', filter: `trip_id=eq.${tripId}` },
          surChangement,
        )
        .subscribe();
      return () => {
        void client.removeChannel(canal);
      };
    },
  };
}

export const cleReservations = (tripId: string | undefined) => ['reservations', tripId] as const;

/** La même requête pour l'écran des réservations, l'itinéraire et l'aperçu. */
export function requeteDesReservations(tripId: string | undefined) {
  return queryOptions({
    queryKey: cleReservations(tripId),
    queryFn: () => getReservations().lister(tripId!),
    enabled: Boolean(tripId),
  });
}
