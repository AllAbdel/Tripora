import { ecartAvecUtc } from './presentDuVoyage.js';
import type { Reservation } from './reservations.js';
import type { Tache } from './taches.js';

/**
 * Les rappels d'un voyage, posés sur le téléphone.
 *
 * Ce qu'on oublie d'un voyage à plusieurs, on l'oublie au mauvais moment : la
 * veille au soir (le passeport), trois heures avant le vol (la référence du
 * billet), le jour où l'assurance devait être prise. L'application ne tourne
 * pas à ces moments-là : c'est le téléphone qui doit les connaître d'avance.
 *
 * Ce module calcule seulement quoi rappeler et quand. Les poser, les retirer
 * et les réveiller est l'affaire de l'application (greffon Capacitor).
 */

export type GenreDeRappel = 'veille-du-depart' | 'tache' | 'reservation' | 'retour';

export interface Rappel {
  /**
   * Un entier positif stable : le même rappel, recalculé plus tard, garde le
   * même numéro et remplace l'ancien au lieu de s'y ajouter.
   */
  id: number;
  genre: GenreDeRappel;
  tripId: string;
  quand: Date;
  titre: string;
  texte: string;
  /** L'écran qu'ouvre un appui sur la notification. */
  lien: string;
}

export interface VoyageARappeler {
  id: string;
  /** La ville du séjour, quand elle est arrêtée. */
  ville?: string | null;
  /** Dates exactes du séjour, `AAAA-MM-JJ`, ou `null`. */
  debut: string | null;
  fin: string | null;
  /** Le fuseau de la destination : les réservations sur place s'y lisent. */
  fuseau?: string | null;
}

export interface ContexteDesRappels {
  maintenant: Date;
  /**
   * Le fuseau du téléphone : avant de partir et après être rentré, on vit à
   * son heure. Absent : celui de l'appareil qui exécute le calcul.
   */
  fuseauDuTelephone?: string | undefined;
  /** Pour ne rappeler que les tâches qui me sont confiées. */
  moi?: string | null | undefined;
  taches?: readonly Tache[] | undefined;
  reservations?: readonly Reservation[] | undefined;
}

/** Au-delà, un rappel posé aujourd'hui aura changé dix fois d'ici là. */
const HORIZON_EN_JOURS = 60;
/** iOS n'en garde que 64 en tout : on laisse de la place aux autres voyages. */
const RAPPELS_PAR_VOYAGE = 20;

const MINUTE = 60_000;
const HEURE = 60 * MINUTE;

/** Le numéro stable d'un rappel (FNV-1a sur 31 bits, jamais nul). */
export function numeroDuRappel(cle: string): number {
  let empreinte = 0x811c9dc5;
  for (let i = 0; i < cle.length; i++) {
    empreinte ^= cle.charCodeAt(i);
    empreinte = Math.imul(empreinte, 0x01000193);
  }
  return (empreinte & 0x7fffffff) || 1;
}

/**
 * L'instant où il sera `heure` le `date` à l'heure de `fuseau`. Sans fuseau,
 * à l'heure de l'appareil.
 */
export function instantLocal(date: string, heure: string, fuseau?: string | null): Date {
  const [annee = 0, mois = 1, jour = 1] = date.split('-').map(Number);
  const [h = 0, m = 0] = heure.split(':').map(Number);
  if (!fuseau) return new Date(annee, mois - 1, jour, h, m);
  const naif = Date.UTC(annee, mois - 1, jour, h, m);
  // Deux passes : l'écart se lit à l'instant visé, pas à l'instant naïf,
  // ce qui compte les jours de changement d'heure.
  const premier = ecartAvecUtc(fuseau, new Date(naif)) ?? 0;
  const second = ecartAvecUtc(fuseau, new Date(naif - premier * MINUTE)) ?? premier;
  return new Date(naif - second * MINUTE);
}

function decaler(date: string, jours: number): string {
  const jour = new Date(`${date}T00:00:00Z`);
  jour.setUTCDate(jour.getUTCDate() + jours);
  return jour.toISOString().slice(0, 10);
}

const DATE = /^\d{4}-\d{2}-\d{2}$/u;
const HEURE_LUE = /^\d{2}:\d{2}/u;

function rappelDeReservation(
  voyage: VoyageARappeler,
  reservation: Reservation,
  fuseauDuTelephone: string | undefined,
): Omit<Rappel, 'id' | 'tripId'> | null {
  if (!DATE.test(reservation.debutLe)) return null;
  const heure = reservation.debutA && HEURE_LUE.test(reservation.debutA) ? reservation.debutA.slice(0, 5) : null;
  const lien = `/voyages/${voyage.id}/reservations`;

  if (reservation.type === 'hebergement') {
    const fuseau = voyage.fuseau ?? fuseauDuTelephone;
    // Deux heures avant l'arrivée prévue ; à midi quand on ne la connaît pas.
    const quand = heure
      ? new Date(instantLocal(reservation.debutLe, heure, fuseau).getTime() - 2 * HEURE)
      : instantLocal(reservation.debutLe, '12:00', fuseau);
    return {
      genre: 'reservation',
      quand,
      titre: `Arrivée aujourd’hui : ${reservation.titre}`,
      texte: reservation.adresse?.trim() || 'L’adresse et les codes d’accès sont dans le coffre du voyage.',
      lien,
    };
  }

  if (!heure) return null;

  if (reservation.type === 'transport') {
    // Le trajet du premier jour part de chez soi : il se lit à l'heure du
    // téléphone. Les suivants partent de la destination.
    const depuisChezSoi = !voyage.debut || reservation.debutLe <= voyage.debut;
    const fuseau = depuisChezSoi ? fuseauDuTelephone : (voyage.fuseau ?? fuseauDuTelephone);
    return {
      genre: 'reservation',
      quand: new Date(instantLocal(reservation.debutLe, heure, fuseau).getTime() - 3 * HEURE),
      titre: `Dans 3 h : ${reservation.titre}`,
      texte: reservation.reference ? `Départ à ${heure} · référence ${reservation.reference}` : `Départ à ${heure}`,
      lien,
    };
  }

  return {
    genre: 'reservation',
    quand: new Date(instantLocal(reservation.debutLe, heure, voyage.fuseau ?? fuseauDuTelephone).getTime() - HEURE),
    titre: `Dans 1 h : ${reservation.titre}`,
    texte: reservation.adresse?.trim() || `À ${heure}`,
    lien,
  };
}

/** Les rappels à venir d'un voyage, du plus proche au plus lointain. */
export function rappelsDuVoyage(voyage: VoyageARappeler, contexte: ContexteDesRappels): Rappel[] {
  const { maintenant, fuseauDuTelephone } = contexte;
  const candidats: (Omit<Rappel, 'id' | 'tripId'> & { cle: string })[] = [];

  if (voyage.debut && DATE.test(voyage.debut)) {
    candidats.push({
      cle: 'veille',
      genre: 'veille-du-depart',
      quand: instantLocal(decaler(voyage.debut, -1), '19:00', fuseauDuTelephone),
      titre: voyage.ville ? `Départ demain pour ${voyage.ville}` : 'Départ demain',
      // Le même texte, qu'il soit calculé depuis la liste des voyages ou
      // depuis le voyage lui-même : sinon l'un remplacerait l'autre.
      texte: 'Passeport, billets, chargeur : un dernier coup d’œil à la valise et au coffre.',
      lien: `/voyages/${voyage.id}`,
    });
  }

  if (voyage.fin && DATE.test(voyage.fin)) {
    candidats.push({
      cle: 'retour',
      genre: 'retour',
      quand: instantLocal(decaler(voyage.fin, 1), '18:00', fuseauDuTelephone),
      titre: 'Bon retour !',
      texte: 'Il reste peut-être des comptes à solder : un coup d’œil à « Qui doit quoi ».',
      lien: `/voyages/${voyage.id}/budget`,
    });
  }

  for (const tache of contexte.taches ?? []) {
    if (tache.faite || !tache.echeance || !DATE.test(tache.echeance)) continue;
    if (!contexte.moi || tache.responsable !== contexte.moi) continue;
    candidats.push({
      cle: `tache:${tache.id}`,
      genre: 'tache',
      quand: instantLocal(tache.echeance, '09:00', fuseauDuTelephone),
      titre: 'À faire aujourd’hui',
      texte: tache.titre,
      lien: `/voyages/${voyage.id}/qui-fait-quoi`,
    });
  }

  for (const reservation of contexte.reservations ?? []) {
    const rappel = rappelDeReservation(voyage, reservation, fuseauDuTelephone);
    if (rappel) candidats.push({ cle: `reservation:${reservation.id}`, ...rappel });
  }

  const depuis = maintenant.getTime() + MINUTE;
  const jusqua = maintenant.getTime() + HORIZON_EN_JOURS * 24 * HEURE;
  return candidats
    .filter(({ quand }) => !Number.isNaN(quand.getTime()) && quand.getTime() > depuis && quand.getTime() < jusqua)
    .sort((a, b) => a.quand.getTime() - b.quand.getTime())
    .slice(0, RAPPELS_PAR_VOYAGE)
    .map(({ cle, ...rappel }) => ({ ...rappel, id: numeroDuRappel(`${voyage.id}:${cle}`), tripId: voyage.id }));
}
