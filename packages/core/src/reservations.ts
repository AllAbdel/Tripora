/**
 * Ce qui est réservé pour le voyage : l'hôtel, la visite, le train.
 *
 * Tripora ne réserve rien lui-même. Il garde la trace de ce que chacun a
 * réservé ailleurs — sur Booking, Airbnb, GetYourGuide — pour que tout le
 * groupe sache où il dort et à quelle heure part la visite, sans fouiller la
 * boîte mail de celui qui a payé.
 *
 * Les dates et heures sont celles **du lieu** : l'arrivée à l'hôtel est à
 * 15 h à Bali, quel que soit le téléphone qui la lit. C'est la convention de
 * l'itinéraire, et celle de l'e-mail de confirmation lui-même.
 */

import type { EvenementDuProgramme } from './calendrier.js';

export type TypeDeReservation = 'hebergement' | 'activite' | 'transport' | 'restaurant' | 'autre';

export const TYPES_DE_RESERVATION: readonly { id: TypeDeReservation; libelle: string }[] = [
  { id: 'hebergement', libelle: 'Hébergement' },
  { id: 'activite', libelle: 'Activité' },
  { id: 'transport', libelle: 'Transport' },
  { id: 'restaurant', libelle: 'Restaurant' },
  { id: 'autre', libelle: 'Autre' },
];

export interface Fournisseur {
  id: string;
  nom: string;
  /** Ce qu'on y réserve le plus souvent : le type proposé par défaut. */
  type: TypeDeReservation;
  /** Ce qui trahit le fournisseur dans un e-mail : ses domaines, son nom. */
  indices: readonly string[];
  /** Sa page d'accueil, quand l'e-mail n'a pas donné de lien plus précis. */
  site: string;
}

/**
 * Les plateformes qu'on rencontre dans les e-mails de confirmation.
 *
 * Les liens mènent aux pages d'accueil, jamais à une page de compte devinée :
 * une adresse inventée qui mène à une erreur ferait douter de toutes les
 * autres. Le lien précis — « gérer ma réservation » — vient de l'e-mail.
 */
export const FOURNISSEURS: readonly Fournisseur[] = [
  { id: 'booking', nom: 'Booking.com', type: 'hebergement', indices: ['booking.com'], site: 'https://www.booking.com' },
  { id: 'airbnb', nom: 'Airbnb', type: 'hebergement', indices: ['airbnb'], site: 'https://www.airbnb.fr' },
  { id: 'agoda', nom: 'Agoda', type: 'hebergement', indices: ['agoda'], site: 'https://www.agoda.com' },
  { id: 'hotels', nom: 'Hotels.com', type: 'hebergement', indices: ['hotels.com'], site: 'https://fr.hotels.com' },
  { id: 'expedia', nom: 'Expedia', type: 'hebergement', indices: ['expedia'], site: 'https://www.expedia.fr' },
  { id: 'vrbo', nom: 'Vrbo / Abritel', type: 'hebergement', indices: ['vrbo', 'abritel'], site: 'https://www.abritel.fr' },
  { id: 'hostelworld', nom: 'Hostelworld', type: 'hebergement', indices: ['hostelworld'], site: 'https://www.hostelworld.com' },
  { id: 'trip-com', nom: 'Trip.com', type: 'hebergement', indices: ['trip.com'], site: 'https://fr.trip.com' },
  { id: 'getyourguide', nom: 'GetYourGuide', type: 'activite', indices: ['getyourguide'], site: 'https://www.getyourguide.fr' },
  { id: 'viator', nom: 'Viator', type: 'activite', indices: ['viator'], site: 'https://www.viator.com' },
  { id: 'klook', nom: 'Klook', type: 'activite', indices: ['klook'], site: 'https://www.klook.com' },
  { id: 'tiqets', nom: 'Tiqets', type: 'activite', indices: ['tiqets'], site: 'https://www.tiqets.com' },
  { id: 'civitatis', nom: 'Civitatis', type: 'activite', indices: ['civitatis'], site: 'https://www.civitatis.com' },
  { id: 'musement', nom: 'Musement', type: 'activite', indices: ['musement'], site: 'https://www.musement.com' },
  { id: 'thefork', nom: 'TheFork', type: 'restaurant', indices: ['thefork', 'lafourchette'], site: 'https://www.thefork.fr' },
  { id: 'trainline', nom: 'Trainline', type: 'transport', indices: ['trainline'], site: 'https://www.thetrainline.com' },
  { id: 'sncf', nom: 'SNCF Connect', type: 'transport', indices: ['sncf'], site: 'https://www.sncf-connect.com' },
  { id: 'flixbus', nom: 'FlixBus', type: 'transport', indices: ['flixbus'], site: 'https://www.flixbus.fr' },
];

export function trouverFournisseur(id: string | null | undefined): Fournisseur | undefined {
  return FOURNISSEURS.find((fournisseur) => fournisseur.id === id);
}

/** Ce qu'on enregistre : tout ce qu'une réservation peut dire d'elle-même. */
export interface DonneesDeReservation {
  type: TypeDeReservation;
  /** Un identifiant de `FOURNISSEURS`, ou « autre ». */
  fournisseur: string;
  titre: string;
  /** « 2026-07-10 », date du lieu. */
  debutLe: string;
  /** « 15:00 », heure du lieu. */
  debutA?: string | null;
  finLe?: string | null;
  finA?: string | null;
  adresse?: string | null;
  lat?: number | null;
  lng?: number | null;
  /** Le numéro de confirmation, celui qu'on donne à l'accueil. */
  reference?: string | null;
  /** « Gérer ma réservation », toujours en https. */
  lien?: string | null;
  prixCents?: number | null;
  devise?: string;
  notes?: string | null;
}

export interface Reservation extends DonneesDeReservation {
  id: string;
  tripId: string;
  devise: string;
  creePar?: string | null;
}

const DATE = /^\d{4}-\d{2}-\d{2}$/u;

function jourSuivant(date: string): string {
  const jour = new Date(`${date}T00:00:00Z`);
  jour.setUTCDate(jour.getUTCDate() + 1);
  return jour.toISOString().slice(0, 10);
}

/** Le nombre de nuits d'un séjour, ou `null` quand la fin n'est pas connue. */
export function nuitsDe(reservation: Pick<DonneesDeReservation, 'debutLe' | 'finLe'>): number | null {
  if (!reservation.finLe || !DATE.test(reservation.debutLe) || !DATE.test(reservation.finLe)) return null;
  const ecart = Date.parse(`${reservation.finLe}T00:00:00Z`) - Date.parse(`${reservation.debutLe}T00:00:00Z`);
  return Math.max(0, Math.round(ecart / 86_400_000));
}

/** Ce qu'une journée du voyage doit rappeler d'une réservation. */
export type MomentDeReservation =
  | { quoi: 'arrivee'; reservation: Reservation }
  | { quoi: 'depart'; reservation: Reservation }
  | { quoi: 'nuit'; reservation: Reservation }
  | { quoi: 'rendez-vous'; reservation: Reservation };

/**
 * Les réservations d'une journée, dans l'ordre où elles se vivent.
 *
 * Un hôtel compte trois fois : le jour de l'arrivée, chaque nuit, le jour du
 * départ. Une activité, le jour où elle a lieu — et chaque jour qu'elle
 * couvre, pour une excursion de deux jours.
 */
export function reservationsDuJour(
  reservations: readonly Reservation[],
  date: string,
): MomentDeReservation[] {
  const moments: MomentDeReservation[] = [];
  for (const reservation of reservations) {
    const fin = reservation.finLe ?? reservation.debutLe;
    if (reservation.type === 'hebergement') {
      if (reservation.debutLe === date) moments.push({ quoi: 'arrivee', reservation });
      else if (reservation.finLe === date) moments.push({ quoi: 'depart', reservation });
      else if (reservation.debutLe < date && date < fin) moments.push({ quoi: 'nuit', reservation });
      continue;
    }
    if (reservation.debutLe <= date && date <= fin) moments.push({ quoi: 'rendez-vous', reservation });
  }
  const heure = (moment: MomentDeReservation): string =>
    (moment.quoi === 'depart' ? moment.reservation.finA : moment.reservation.debutA) ??
    (moment.quoi === 'depart' ? '00:00' : moment.quoi === 'nuit' ? '99:99' : '23:59');
  return moments.sort((a, b) => heure(a).localeCompare(heure(b)));
}

/** Toutes les dates, de l'arrivée au départ compris : pour ranger par jour. */
export function joursCouverts(reservation: Pick<DonneesDeReservation, 'debutLe' | 'finLe'>): string[] {
  if (!DATE.test(reservation.debutLe)) return [];
  const fin = reservation.finLe && DATE.test(reservation.finLe) ? reservation.finLe : reservation.debutLe;
  const jours: string[] = [];
  for (let jour = reservation.debutLe, garde = 0; jour <= fin && garde < 400; garde += 1) {
    jours.push(jour);
    jour = jourSuivant(jour);
  }
  return jours;
}

/** Du plus proche au plus lointain, l'heure départageant un même jour. */
export function trierLesReservations<T extends Pick<DonneesDeReservation, 'debutLe' | 'debutA'>>(
  reservations: readonly T[],
): T[] {
  return [...reservations].sort(
    (a, b) =>
      a.debutLe.localeCompare(b.debutLe) || (a.debutA ?? '99:99').localeCompare(b.debutA ?? '99:99'),
  );
}

/**
 * Les réservations, en événements d'agenda.
 *
 * Un hôtel donne deux rendez-vous, pas un bloc de six jours qui masquerait
 * tout le reste du calendrier : l'arrivée et le départ. Le numéro de
 * confirmation part dans la description — c'est lui qu'on cherche au comptoir.
 */
export function evenementsDesReservations(reservations: readonly Reservation[]): EvenementDuProgramme[] {
  const evenements: EvenementDuProgramme[] = [];
  for (const reservation of reservations) {
    const description = [
      reservation.reference ? `Réservation n° ${reservation.reference}` : null,
      reservation.adresse,
      reservation.lien,
    ]
      .filter(Boolean)
      .join('\n');
    const commun = description ? { description } : {};
    if (reservation.type === 'hebergement') {
      evenements.push({
        id: `reservation-${reservation.id}-arrivee`,
        titre: `Arrivée : ${reservation.titre}`,
        date: reservation.debutLe,
        debut: reservation.debutA ?? null,
        ...commun,
      });
      if (reservation.finLe) {
        evenements.push({
          id: `reservation-${reservation.id}-depart`,
          titre: `Départ : ${reservation.titre}`,
          date: reservation.finLe,
          debut: reservation.finA ?? null,
          ...commun,
        });
      }
      continue;
    }
    evenements.push({
      id: `reservation-${reservation.id}`,
      titre: reservation.titre,
      date: reservation.debutLe,
      debut: reservation.debutA ?? null,
      fin: reservation.finLe && reservation.finLe !== reservation.debutLe ? null : (reservation.finA ?? null),
      ...commun,
    });
  }
  return evenements;
}

/** « 14:00 » s'écrit « 14 h », « 09:30 » s'écrit « 9 h 30 ». */
export function heureLisible(heure: string | null | undefined): string | null {
  const trouvee = /^(\d{1,2}):(\d{2})/u.exec(heure ?? '');
  if (!trouvee) return null;
  const heures = Number(trouvee[1]);
  return trouvee[2] === '00' ? `${heures} h` : `${heures} h ${trouvee[2]}`;
}

/** « Arrivée à Ubud Tropical Villas, 14 h », « 2 h · Mont Batur (GetYourGuide) ». */
export function phraseDeReservation(moment: MomentDeReservation): string {
  const { reservation } = moment;
  switch (moment.quoi) {
    case 'arrivee':
      return [`Arrivée à ${reservation.titre}`, heureLisible(reservation.debutA)].filter(Boolean).join(', ');
    case 'depart':
      return [`Départ de ${reservation.titre}`, heureLisible(reservation.finA)].filter(Boolean).join(', ');
    case 'nuit':
      return `Nuit à ${reservation.titre}`;
    default: {
      const fournisseur = trouverFournisseur(reservation.fournisseur)?.nom;
      return [heureLisible(reservation.debutA), `${reservation.titre}${fournisseur ? ` (${fournisseur})` : ''}`]
        .filter(Boolean)
        .join(' · ');
    }
  }
}

/** Le fournisseur d'un lien collé : « airbnb.fr/rooms/… » est Airbnb. */
export function trouverFournisseurParLien(lien: string): Fournisseur | undefined {
  let hote: string;
  try {
    hote = new URL(lien).hostname.toLowerCase();
  } catch {
    return undefined;
  }
  return FOURNISSEURS.find((fournisseur) => fournisseur.indices.some((indice) => hote.includes(indice)));
}
