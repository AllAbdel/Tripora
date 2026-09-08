import type { Destination, Place, TripConstraints } from './types.js';

/**
 * Liens de réservation préremplis.
 *
 * Tripora ne réserve rien et n'en a pas les moyens : aucune plateforme
 * n'ouvre son API de réservation à un projet personnel gratuit. Ce qu'on peut
 * faire, en revanche, c'est éviter de ressaisir six fois les mêmes dates.
 *
 * Ces liens ouvrent la recherche déjà remplie — ville, dates, nombre de
 * voyageurs. Rien n'est engagé, aucun prix n'est promis : ce sont des raccourcis
 * vers des sites qui, eux, savent leurs prix.
 *
 * **Pourquoi cette page existe plutôt qu'une comparaison de prix d'hôtels :**
 * l'API Hotellook, qui devait fournir des prix indicatifs avec le même jeton
 * Travelpayouts, a été retirée. Vérifié le 6 septembre 2026 : tout l'hôte
 * `engine.hotellook.com` répond 404, y compris sur sa racine, alors que l'API
 * de vols du même compte répond normalement. Il n'existe plus de source
 * gratuite de prix d'hébergement. Plutôt que d'afficher une estimation
 * déguisée en relevé, on envoie vers ceux qui savent.
 *
 * Tout est construit ici, sans réseau et sans clé, et testé.
 */

export type BookingKind = 'stay' | 'flight' | 'train' | 'bus';

export interface BookingLink {
  id: string;
  label: string;
  kind: BookingKind;
  url: string;
  /** Ce que le lien ne dit pas, pour ne pas laisser croire à une promesse. */
  note?: string;
  /**
   * Vrai quand une réservation par ce lien peut rapporter une commission.
   *
   * Existe pour que l'interface le **dise**. Un lien affilié qui ne s'annonce
   * pas est exactement ce qui fait perdre confiance dans le reste de l'écran,
   * et la transparence sur un partenariat commercial est de toute façon une
   * obligation en France.
   */
  affilie?: boolean;
}

/** Dates au format AAAA-MM-JJ, déduites du voyage quand il en a. */
export interface Sejour {
  checkIn: string | null;
  checkOut: string | null;
  guests: number;
}

/**
 * Dates concrètes d'un voyage.
 *
 * Un groupe qui a dit « une semaine en octobre » n'a pas de dates ; les sites
 * de réservation, eux, en exigent. On ne les invente pas : sans date, le lien
 * ouvre la recherche sur la ville seule, et la personne choisit. Mieux vaut un
 * champ vide qu'une date fausse déjà remplie.
 */
export function sejourDe(constraints: TripConstraints): Sejour {
  const guests = Math.max(1, Math.min(30, constraints.participants));
  if (constraints.startDate && constraints.endDate) {
    return { checkIn: constraints.startDate, checkOut: constraints.endDate, guests };
  }
  if (constraints.startDate) {
    return {
      checkIn: constraints.startDate,
      checkOut: ajouterJours(constraints.startDate, constraints.durationDays),
      guests,
    };
  }
  return { checkIn: null, checkOut: null, guests };
}

/** Ajoute des jours à une date ISO, en UTC pour ignorer les fuseaux. */
export function ajouterJours(date: string, jours: number): string | null {
  const base = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(base.getTime())) return null;
  base.setUTCDate(base.getUTCDate() + jours);
  return base.toISOString().slice(0, 10);
}

/**
 * Où dormir. Trois plateformes aux logiques différentes exprès : l'hôtel, le
 * logement entier, le lit en dortoir. Un groupe de cinq n'a pas les mêmes
 * réponses selon celle qu'il ouvre.
 */
export function stayLinks(destination: Destination, sejour: Sejour): BookingLink[] {
  const ville = `${destination.name}, ${destination.country}`;

  const booking = new URL('https://www.booking.com/searchresults.fr.html');
  booking.searchParams.set('ss', ville);
  booking.searchParams.set('group_adults', String(sejour.guests));
  booking.searchParams.set('no_rooms', '1');
  if (sejour.checkIn) booking.searchParams.set('checkin', sejour.checkIn);
  if (sejour.checkOut) booking.searchParams.set('checkout', sejour.checkOut);

  const airbnb = new URL(
    `https://www.airbnb.fr/s/${encodeURIComponent(ville)}/homes`,
  );
  airbnb.searchParams.set('adults', String(sejour.guests));
  if (sejour.checkIn) airbnb.searchParams.set('checkin', sejour.checkIn);
  if (sejour.checkOut) airbnb.searchParams.set('checkout', sejour.checkOut);

  const hostelworld = new URL('https://www.hostelworld.com/search');
  hostelworld.searchParams.set('search_keywords', ville);
  hostelworld.searchParams.set('number_of_guests', String(sejour.guests));
  if (sejour.checkIn) hostelworld.searchParams.set('date_from', sejour.checkIn);
  if (sejour.checkOut) hostelworld.searchParams.set('date_to', sejour.checkOut);

  return [
    { id: 'booking', label: 'Booking', kind: 'stay', url: booking.toString() },
    { id: 'airbnb', label: 'Airbnb', kind: 'stay', url: airbnb.toString() },
    {
      id: 'hostelworld',
      label: 'Hostelworld',
      kind: 'stay',
      url: hostelworld.toString(),
      note: 'Auberges, souvent le moins cher à plusieurs',
    },
  ];
}

/**
 * Comment y aller. L'avion pointe vers la source de nos propres prix, pour que
 * le chiffre affiché soit vérifiable d'un clic ; le train et le bus vers des
 * sites généralistes, faute de source de prix gratuite pour eux.
 */
export function travelLinks(
  origin: Place,
  destination: Destination,
  sejour: Sejour,
): BookingLink[] {
  const liens: BookingLink[] = [];

  const departIata = origin.iata?.[0];
  const arriveeIata = destination.iata[0];
  if (departIata && arriveeIata) {
    const aviasales = new URL('https://www.aviasales.com/search');
    aviasales.searchParams.set('origin_iata', departIata);
    aviasales.searchParams.set('destination_iata', arriveeIata);
    aviasales.searchParams.set('adults', String(sejour.guests));
    if (sejour.checkIn) aviasales.searchParams.set('depart_date', sejour.checkIn);
    if (sejour.checkOut) aviasales.searchParams.set('return_date', sejour.checkOut);
    liens.push({
      id: 'aviasales',
      label: 'Aviasales',
      kind: 'flight',
      url: aviasales.toString(),
      note: 'La source de nos prix de vol : vérifiable d’un clic',
    });
  }

  const omio = new URL('https://www.omio.fr/');
  omio.searchParams.set('departurePosition', origin.name);
  omio.searchParams.set('arrivalPosition', destination.name);
  if (sejour.checkIn) omio.searchParams.set('departureDate', sejour.checkIn);
  liens.push({
    id: 'omio',
    label: 'Train et bus',
    kind: 'train',
    url: omio.toString(),
    note: 'Aucune source gratuite de prix : nos estimations restent indicatives',
  });

  return liens;
}

// ---------------------------------------------------------------------------
// Affiliation
// ---------------------------------------------------------------------------

/**
 * Les partenaires dont on connaît la façon d'attribuer une réservation.
 *
 * Volontairement court. Travelpayouts distribue des dizaines de programmes,
 * chacun avec sa propre forme de lien, et **inventer une forme ne produit pas
 * un lien qui rapporte : ça produit un lien qui ne rapporte rien, ou pire, qui
 * casse**. On ne décore donc que ce dont la forme est établie de longue date —
 * le paramètre `marker` sur Aviasales — et on laisse les autres intacts.
 *
 * Ajouter un partenaire se fait ici, en copiant la forme exacte depuis le
 * tableau de bord Travelpayouts, jamais de mémoire.
 */
const AFFILIABLES: Readonly<Record<string, (url: URL, marker: string) => void>> = {
  aviasales: (url, marker) => url.searchParams.set('marker', marker),
};

/**
 * Ajoute l'identifiant de partenaire aux liens qui savent l'exploiter.
 *
 * Trois garanties, et ce sont elles qui comptent plus que le code :
 *
 *  1. **la liste et son ordre ne changent pas.** Un écran qui réordonnerait
 *     ses liens selon ce qu'ils rapportent ne serait plus un service ;
 *  2. **sans identifiant, rien ne bouge** — pas même un paramètre vide ;
 *  3. **ce qui est décoré est marqué `affilie`**, pour que l'interface
 *     l'annonce plutôt que de le taire.
 *
 * Un test vérifie les trois, précisément parce qu'une intention se perd et
 * qu'un test non.
 */
export function affilierLiens(
  liens: readonly BookingLink[],
  marker: string | undefined,
): BookingLink[] {
  const propre = (marker ?? '').trim();
  // Un identifiant de partenaire est un nombre. Tout le reste est une faute de
  // saisie, et poser une faute de saisie dans une URL ne rapporte rien.
  if (!/^[0-9]{3,12}$/.test(propre)) return [...liens];

  return liens.map((lien) => {
    const decorer = AFFILIABLES[lien.id];
    if (!decorer) return lien;
    try {
      const url = new URL(lien.url);
      decorer(url, propre);
      return { ...lien, url: url.toString(), affilie: true };
    } catch {
      // Une URL illisible reste telle quelle : mieux vaut un lien qui marche
      // sans rapporter qu'un lien cassé.
      return lien;
    }
  });
}
