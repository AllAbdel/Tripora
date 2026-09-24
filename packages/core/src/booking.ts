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

export type BookingKind = 'stay' | 'flight' | 'train' | 'bus' | 'activity';

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

/**
 * Que faire sur place : les visites, billets et excursions à réserver.
 *
 * Une recherche sur la ville, pas une activité précise : le carnet propose
 * déjà les idées, ce lien sert au moment de payer un billet. La recherche se
 * fait sur le nom court (« Bergen et les fjords » cherche « Bergen ») : le
 * moteur du site ne connaît que les villes.
 */
export function activityLinks(destination: Destination): BookingLink[] {
  const klook = new URL('https://www.klook.com/search/result/');
  klook.searchParams.set('query', nomCourt(destination.name));
  return [
    {
      id: 'klook',
      label: 'Klook',
      kind: 'activity',
      url: klook.toString(),
      note: 'Visites, billets coupe-file et excursions',
    },
  ];
}

/** « Bergen et les fjords » → « Bergen » ; « Crète — La Canée » → « La Canée ». */
function nomCourt(nom: string): string {
  const apresLeTiret = nom.split(' — ').at(-1) ?? nom;
  return (apresLeTiret.split(' et ')[0] ?? apresLeTiret).trim() || nom;
}

// ---------------------------------------------------------------------------
// Affiliation
// ---------------------------------------------------------------------------

/**
 * L'identité de partenaire Travelpayouts. **Publique** : les deux nombres
 * figurent en clair dans chaque lien affilié.
 */
export interface Partenaire {
  /** L'identifiant de partenaire (« marker »), à qui revient la commission. */
  marker?: string;
  /** Le projet (« trs ») auquel le tableau de bord rattache les clics. */
  projet?: string;
}

/**
 * Les programmes Travelpayouts rejoints, et leurs numéros.
 *
 * Volontairement court. Chaque programme a son numéro, et **inventer un numéro
 * ne produit pas un lien qui rapporte : ça produit un lien qui ne rapporte
 * rien, ou pire, qui casse**. Ceux-ci sont relevés sur les liens générés par
 * le tableau de bord de Tripora (le 24 septembre 2026) :
 *
 *   https://tp.media/r?campaign_id=100&marker=…&p=4114&trs=…&u=https://aviasales.com
 *   https://tp.media/r?campaign_id=137&marker=…&p=4110&trs=…&u=https://klook.com
 *
 * Ajouter un partenaire se fait ici, en relevant ses numéros sur un lien du
 * tableau de bord, jamais de mémoire.
 */
const PROGRAMMES: Readonly<Record<string, { programme: string; campagne: string }>> = {
  aviasales: { programme: '4114', campagne: '100' },
  klook: { programme: '4110', campagne: '137' },
};

/**
 * Fait passer par Travelpayouts les liens des partenaires rejoints.
 *
 * Le lien d'origine — la recherche préremplie — devient la destination (`u`)
 * d'un lien `tp.media`, la forme exacte que produit le tableau de bord : le
 * clic y est compté, puis la personne arrive sur la même page qu'avant.
 *
 * Trois garanties, et ce sont elles qui comptent plus que le code :
 *
 *  1. **la liste et son ordre ne changent pas.** Un écran qui réordonnerait
 *     ses liens selon ce qu'ils rapportent ne serait plus un service ;
 *  2. **sans identité complète, rien ne bouge** — pas même un paramètre vide ;
 *  3. **ce qui est décoré est marqué `affilie`**, pour que l'interface
 *     l'annonce plutôt que de le taire.
 *
 * Un test vérifie les trois, précisément parce qu'une intention se perd et
 * qu'un test non.
 */
export function affilierLiens(
  liens: readonly BookingLink[],
  partenaire: Partenaire | undefined,
): BookingLink[] {
  const marker = (partenaire?.marker ?? '').trim();
  const projet = (partenaire?.projet ?? '').trim();
  // Ce sont des nombres. Tout le reste est une faute de saisie, et poser une
  // faute de saisie dans une URL ne rapporte rien.
  if (!/^[0-9]{3,12}$/.test(marker) || !/^[0-9]{3,12}$/.test(projet)) return [...liens];

  return liens.map((lien) => {
    const numeros = PROGRAMMES[lien.id];
    if (!numeros) return lien;
    try {
      // Relire l'URL d'origine écarte ce qui n'en est pas une.
      const destination = new URL(lien.url).toString();
      const url = new URL('https://tp.media/r');
      url.searchParams.set('campaign_id', numeros.campagne);
      url.searchParams.set('marker', marker);
      url.searchParams.set('p', numeros.programme);
      url.searchParams.set('trs', projet);
      url.searchParams.set('u', destination);
      return { ...lien, url: url.toString(), affilie: true };
    } catch {
      // Une URL illisible reste telle quelle : mieux vaut un lien qui marche
      // sans rapporter qu'un lien cassé.
      return lien;
    }
  });
}
