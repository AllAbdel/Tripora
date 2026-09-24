/**
 * Où en est le voyage, aujourd'hui.
 *
 * Tout Tripora était tourné vers la préparation : les envies, le vote,
 * l'itinéraire. Une fois les dates arrivées, l'accueil du voyage continuait
 * de parler de ce qui restait à décider, alors que la question devient
 * « qu'est-ce qu'on fait aujourd'hui, et où dort-on ce soir ».
 *
 * Les dates sont celles **du lieu**, comme dans l'itinéraire et les
 * réservations : à Bali, le troisième jour commence à minuit à Bali, pas à
 * Paris.
 */

import type { DonneesDeReservation } from './reservations.js';

const DATE = /^\d{4}-\d{2}-\d{2}$/u;
const JOUR = 86_400_000;

function ecartEnJours(de: string, a: string): number {
  return Math.round((Date.parse(`${a}T00:00:00Z`) - Date.parse(`${de}T00:00:00Z`)) / JOUR);
}

function decaler(date: string, jours: number): string {
  const jour = new Date(`${date}T00:00:00Z`);
  jour.setUTCDate(jour.getUTCDate() + jours);
  return jour.toISOString().slice(0, 10);
}

/**
 * La date du jour là-bas, au format `AAAA-MM-JJ`.
 *
 * Sans fuseau connu — ou avec un fuseau que le moteur ne connaît pas — on
 * prend celle de l'appareil : se tromper d'un jour au pire, plutôt que de ne
 * rien afficher.
 */
export function dateDuJour(fuseau?: string | null, maintenant: Date = new Date()): string {
  const locale = (options: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit', ...options });
  try {
    return locale(fuseau ? { timeZone: fuseau } : {}).format(maintenant);
  } catch {
    return locale({}).format(maintenant);
  }
}

export type MomentDuVoyage =
  | { phase: 'avant'; dansJours: number }
  | { phase: 'pendant'; jour: number; sur: number }
  | { phase: 'apres'; depuisJours: number };

/**
 * Avant, pendant ou après — et à quelle distance.
 *
 * `null` quand les dates ne sont pas arrêtées : un voyage « en juillet » n'a
 * pas de compte à rebours honnête.
 */
export function momentDuVoyage(
  debut: string | null | undefined,
  fin: string | null | undefined,
  aujourdhui: string,
): MomentDuVoyage | null {
  if (!debut || !fin || !DATE.test(debut) || !DATE.test(fin) || fin < debut) return null;
  if (aujourdhui < debut) return { phase: 'avant', dansJours: ecartEnJours(aujourdhui, debut) };
  if (aujourdhui <= fin) {
    return { phase: 'pendant', jour: ecartEnJours(debut, aujourdhui) + 1, sur: ecartEnJours(debut, fin) + 1 };
  }
  return { phase: 'apres', depuisJours: ecartEnJours(fin, aujourdhui) };
}

/** Une suite de nuits sans toit : on arrive le `arrivee`, on repart le `depart`. */
export interface NuitsSansHebergement {
  arrivee: string;
  depart: string;
  nuits: number;
}

/**
 * Les nuits du séjour qu'aucun hébergement réservé ne couvre.
 *
 * Une nuit porte la date du soir où l'on s'endort : un séjour du 10 au 14 a
 * quatre nuits, du 10 au 13. Un hôtel du 10 au 12 couvre les nuits du 10 et
 * du 11. Un hébergement sans date de départ ne couvre que sa première nuit —
 * on ne suppose pas un séjour plus long que ce qui est écrit.
 *
 * Les nuits manquantes consécutives sont regroupées : « du 12 au 14 » se lit
 * mieux que trois lignes.
 */
export function nuitsSansHebergement(
  debut: string,
  fin: string,
  reservations: readonly Pick<DonneesDeReservation, 'type' | 'debutLe' | 'finLe'>[],
): NuitsSansHebergement[] {
  if (!DATE.test(debut) || !DATE.test(fin) || fin <= debut) return [];
  const toits = reservations.filter(
    (reservation) => reservation.type === 'hebergement' && DATE.test(reservation.debutLe),
  );
  const couverte = (nuit: string) =>
    toits.some((toit) => {
      const depart = toit.finLe && DATE.test(toit.finLe) && toit.finLe > toit.debutLe
        ? toit.finLe
        : decaler(toit.debutLe, 1);
      return toit.debutLe <= nuit && nuit < depart;
    });

  const trous: NuitsSansHebergement[] = [];
  for (let nuit = debut, garde = 0; nuit < fin && garde < 400; nuit = decaler(nuit, 1), garde += 1) {
    if (couverte(nuit)) continue;
    const dernier = trous.at(-1);
    if (dernier && dernier.depart === nuit) {
      dernier.depart = decaler(nuit, 1);
      dernier.nuits += 1;
    } else {
      trous.push({ arrivee: nuit, depart: decaler(nuit, 1), nuits: 1 });
    }
  }
  return trous;
}

const JOUR_ET_MOIS = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', timeZone: 'UTC' });
const JOUR_SEUL = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', timeZone: 'UTC' });

function lue(date: string, format: Intl.DateTimeFormat): string {
  // « le 1er juillet », pas « le 1 juillet » : le premier du mois s'écrit en
  // ordinal, et Intl ne le fait pas.
  return format.format(new Date(`${date}T00:00:00Z`)).replace(/^1(?=\s|$)/u, '1er');
}

/**
 * « du 12 au 15 juillet », « du 30 juin au 2 juillet ».
 *
 * Le mois n'est écrit qu'une fois quand il est le même : c'est ainsi qu'on le
 * dit, et la ligne tient sur un téléphone.
 */
export function periodeLisible(de: string, a: string): string {
  if (!DATE.test(de) || !DATE.test(a)) return '';
  if (de === a) return `le ${lue(de, JOUR_ET_MOIS)}`;
  const memeMois = de.slice(0, 7) === a.slice(0, 7);
  return `du ${lue(de, memeMois ? JOUR_SEUL : JOUR_ET_MOIS)} au ${lue(a, JOUR_ET_MOIS)}`;
}
