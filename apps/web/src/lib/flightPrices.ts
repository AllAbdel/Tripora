import type { Destination, PricedValue, TripConstraints } from '@tripora/core';
import { supabase } from './supabase';

/**
 * Prix de vols relevés, via la fonction serveur.
 *
 * Le jeton Travelpayouts ne quitte jamais le serveur, et la fonction ramène
 * toutes les destinations en un seul appel réseau, mis en cache 24 h et
 * partagé par tout le groupe. Côté application il n'y a donc qu'une requête,
 * quel que soit le nombre de candidates.
 *
 * Tout échec est silencieux par conception : sans prix relevé, le moteur
 * retombe sur ses estimations, qui sont étiquetées comme telles. Une panne de
 * fournisseur ne doit jamais vider un écran.
 */

export interface PrixVols {
  parDestination: Record<string, PricedValue>;
  /** Faux tant que le jeton n'est pas renseigné côté serveur. */
  configured: boolean;
  /** Vrai quand la limite gratuite du jour a été atteinte. */
  quotaExceeded: boolean;
}

const VIDE: PrixVols = { parDestination: {}, configured: false, quotaExceeded: false };

/**
 * Mois visé au format AAAA-MM.
 *
 * Un voyage « en mars » saisi en septembre parle de mars prochain, pas de mars
 * dernier : on avance d'un an quand le mois est déjà passé.
 */
export function moisCible(constraints: TripConstraints, maintenant = new Date()): string | null {
  if (constraints.startDate) return constraints.startDate.slice(0, 7);
  if (constraints.windowStart) return constraints.windowStart.slice(0, 7);
  if (!constraints.month) return null;

  const moisActuel = maintenant.getMonth() + 1;
  const annee = constraints.month >= moisActuel
    ? maintenant.getFullYear()
    : maintenant.getFullYear() + 1;
  return `${annee}-${String(constraints.month).padStart(2, '0')}`;
}

export async function chargerPrixVols(
  constraints: TripConstraints,
  candidates: readonly Destination[],
): Promise<PrixVols> {
  const client = supabase;
  const origine = constraints.origin.iata ?? [];
  if (!client || origine.length === 0 || candidates.length === 0) return VIDE;

  const mois = moisCible(constraints);

  const { data, error } = await client.functions.invoke('flight-prices', {
    body: {
      originIata: origine,
      ...(mois ? { month: mois } : {}),
      destinations: candidates.map((destination) => ({
        id: destination.id,
        iata: destination.iata,
      })),
    },
  });

  if (error || !data) return VIDE;
  return lirePrix(data);
}

/**
 * Lecture défensive de la réponse.
 *
 * Un prix affiché engage : on préfère retomber sur une estimation étiquetée
 * plutôt que d'afficher un montant issu d'un champ qu'on n'a pas su relire.
 * Chaque entrée douteuse est ignorée en silence, les autres sont conservées.
 */
export function lirePrix(data: unknown): PrixVols {
  if (typeof data !== 'object' || data === null) return VIDE;
  const enveloppe = data as Record<string, unknown>;
  const brut = enveloppe.prices;
  const parDestination: Record<string, PricedValue> = {};

  if (typeof brut === 'object' && brut !== null) {
    for (const [id, valeur] of Object.entries(brut as Record<string, unknown>)) {
      if (typeof valeur !== 'object' || valeur === null) continue;
      const entree = valeur as Record<string, unknown>;
      const cents = Number(entree.cents);
      if (!Number.isFinite(cents) || cents <= 0 || !Number.isInteger(cents)) continue;
      // Sans date de relevé, ce n'est pas une observation : on n'en fait rien.
      if (typeof entree.fetchedAt !== 'string' || Number.isNaN(Date.parse(entree.fetchedAt))) {
        continue;
      }
      parDestination[id] = {
        cents,
        source: 'observed',
        provider: typeof entree.provider === 'string' ? entree.provider : 'Aviasales',
        fetchedAt: entree.fetchedAt,
      };
    }
  }

  return {
    parDestination,
    configured: enveloppe.configured === true,
    quotaExceeded: enveloppe.quotaExceeded === true,
  };
}
