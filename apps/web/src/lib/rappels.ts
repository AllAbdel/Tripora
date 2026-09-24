import { useEffect, useMemo, useSyncExternalStore } from 'react';
import {
  findDestination,
  rappelsDuVoyage,
  type GenreDeRappel,
  type Rappel,
  type Reservation,
  type Tache,
  type VoyageARappeler,
} from '@tripora/core';
import { estNatif } from './natif';
import type { TripSummary } from './trips';

/**
 * Les rappels posés sur le téléphone (application Android et iOS).
 *
 * `rappelsDuVoyage` (core) calcule quoi rappeler et quand ; ce module les
 * pose avec le greffon de notifications locales, les retire quand ils ne
 * valent plus, et retient si la personne en veut. Sur le site, rien : un
 * navigateur fermé ne réveille personne sans serveur de notifications.
 *
 * Les rappels sont des alarmes « non exactes » : Android peut les retarder de
 * quelques minutes pour économiser la batterie. C'est sans importance pour
 * un rappel la veille au soir, et cela évite de demander l'autorisation des
 * alarmes exactes, qui ouvre un écran de réglages.
 */

export type ChoixDesRappels = 'actifs' | 'refuses' | null;

const CLE = 'tripora.rappels';
const abonnes = new Set<() => void>();

function lire(): ChoixDesRappels {
  try {
    const valeur = localStorage.getItem(CLE);
    return valeur === 'actifs' || valeur === 'refuses' ? valeur : null;
  } catch {
    return null;
  }
}

function retenir(choix: Exclude<ChoixDesRappels, null>): void {
  try {
    localStorage.setItem(CLE, choix);
  } catch {
    // Stockage refusé : on redemandera, tant pis.
  }
  for (const abonne of abonnes) abonne();
}

/** Le choix de la personne ; `null` tant qu'on ne lui a rien demandé. */
export function useChoixDesRappels(): ChoixDesRappels {
  return useSyncExternalStore(
    (abonne) => {
      abonnes.add(abonne);
      return () => abonnes.delete(abonne);
    },
    lire,
    () => null,
  );
}

/** Les rappels n'existent que dans l'application. */
export const rappelsPossibles: boolean = estNatif;

async function greffon() {
  const { LocalNotifications } = await import('@capacitor/local-notifications');
  return LocalNotifications;
}

/**
 * Demande l'autorisation d'afficher des notifications, et retient la
 * réponse. Vrai si les rappels sont actifs.
 */
export async function activerLesRappels(): Promise<boolean> {
  if (!rappelsPossibles) return false;
  try {
    const notifications = await greffon();
    const { display } = await notifications.requestPermissions();
    const accorde = display === 'granted';
    retenir(accorde ? 'actifs' : 'refuses');
    return accorde;
  } catch {
    retenir('refuses');
    return false;
  }
}

/** Plus de rappels : on retire tous ceux de Tripora déjà posés. */
export async function desactiverLesRappels(): Promise<void> {
  retenir('refuses');
  if (!rappelsPossibles) return;
  try {
    const notifications = await greffon();
    const { notifications: enAttente } = await notifications.getPending();
    if (enAttente.length > 0) {
      await notifications.cancel({ notifications: enAttente.map(({ id }) => ({ id })) });
    }
  } catch {
    // Greffon indisponible : il n'y a rien à retirer.
  }
}

interface Supplement {
  tripId?: unknown;
  genre?: unknown;
  lien?: unknown;
}

/**
 * Remplace les rappels d'un voyage par ceux-ci.
 *
 * Seuls les genres donnés sont touchés : la liste des voyages, qui ne connaît
 * que les dates, pose la veille du départ et le retour sans effacer les
 * rappels de tâches et de réservations posés depuis l'écran du voyage.
 */
export async function poserLesRappels(
  tripId: string,
  rappels: readonly Rappel[],
  genres: readonly GenreDeRappel[] = ['veille-du-depart', 'tache', 'reservation', 'retour'],
): Promise<void> {
  if (!rappelsPossibles || lire() !== 'actifs') return;
  try {
    const notifications = await greffon();
    const { notifications: enAttente } = await notifications.getPending();
    const perimes = enAttente.filter((notification) => {
      const supplement = (notification.extra ?? {}) as Supplement;
      return supplement.tripId === tripId && genres.includes(supplement.genre as GenreDeRappel);
    });
    if (perimes.length > 0) {
      await notifications.cancel({ notifications: perimes.map(({ id }) => ({ id })) });
    }
    const aPoser = rappels.filter((rappel) => genres.includes(rappel.genre));
    if (aPoser.length === 0) return;
    await notifications.schedule({
      notifications: aPoser.map((rappel) => ({
        id: rappel.id,
        title: rappel.titre,
        body: rappel.texte,
        schedule: { at: rappel.quand, allowWhileIdle: true },
        // Pas d'alarme exacte : voir l'en-tête du module.
        isExactNotification: false,
        extra: { tripId: rappel.tripId, genre: rappel.genre, lien: rappel.lien },
      })),
    });
  } catch {
    // Autorisation retirée dans les réglages du téléphone, ou greffon absent :
    // pas de rappel, et rien à signaler au milieu d'un écran.
  }
}

/** Retire les rappels des voyages qui ne sont plus dans la liste. */
export async function oublierLesAutresVoyages(voyagesConnus: ReadonlySet<string>): Promise<void> {
  if (!rappelsPossibles || lire() !== 'actifs') return;
  try {
    const notifications = await greffon();
    const { notifications: enAttente } = await notifications.getPending();
    const orphelins = enAttente.filter((notification) => {
      const { tripId } = (notification.extra ?? {}) as Supplement;
      return typeof tripId === 'string' && !voyagesConnus.has(tripId);
    });
    if (orphelins.length > 0) {
      await notifications.cancel({ notifications: orphelins.map(({ id }) => ({ id })) });
    }
  } catch {
    // Rien à faire.
  }
}

/**
 * Un appui sur un rappel ouvre l'écran dont il parle. Renvoie de quoi se
 * désabonner.
 */
export function suivreLesAppuis(ouvrir: (lien: string) => void): () => void {
  if (!rappelsPossibles) return () => {};
  let retrait: (() => void) | null = null;
  let actif = true;
  void greffon()
    .then((notifications) =>
      notifications.addListener('localNotificationActionPerformed', ({ notification }) => {
        const { lien } = (notification.extra ?? {}) as Supplement;
        // Seulement un chemin de l'application : jamais une adresse extérieure.
        if (typeof lien === 'string' && lien.startsWith('/') && !lien.startsWith('//')) ouvrir(lien);
      }),
    )
    .then((abonnement) => {
      if (actif) retrait = () => void abonnement.remove();
      else void abonnement.remove();
    })
    .catch(() => undefined);
  return () => {
    actif = false;
    retrait?.();
  };
}

/* ----------------------------------------------------------------- Hooks -- */

/** Ce qui distingue deux listes de rappels : inutile de reposer les mêmes. */
function empreinte(rappels: readonly Rappel[]): string {
  return rappels.map((rappel) => `${rappel.id}@${rappel.quand.getTime()}:${rappel.titre}:${rappel.texte}`).join('|');
}

/**
 * Depuis la liste des voyages : la veille de chaque départ et le lendemain
 * de chaque retour, même pour un voyage qu'on n'a pas rouvert depuis. Les
 * rappels d'un voyage disparu de la liste sont retirés.
 */
export function useRappelsDesVoyages(voyages: readonly TripSummary[] | undefined): void {
  const choix = useChoixDesRappels();
  const cle = voyages?.map((voyage) => `${voyage.id}:${voyage.startDate ?? ''}:${voyage.endDate ?? ''}:${voyage.destinationId ?? ''}`).join('|');

  useEffect(() => {
    if (!rappelsPossibles || choix !== 'actifs' || !voyages) return;
    const maintenant = new Date();
    void (async () => {
      for (const voyage of voyages) {
        const destination = voyage.destinationId ? findDestination(voyage.destinationId) : undefined;
        const rappels = rappelsDuVoyage(
          {
            id: voyage.id,
            ville: destination?.name ?? null,
            debut: voyage.startDate ?? null,
            fin: voyage.endDate ?? null,
            fuseau: destination?.timezone ?? null,
          },
          { maintenant },
        );
        await poserLesRappels(voyage.id, rappels, ['veille-du-depart', 'retour']);
      }
      await oublierLesAutresVoyages(new Set(voyages.map((voyage) => voyage.id)));
    })();
    // La clé résume les voyages : une nouvelle liste identique ne repose rien.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cle, choix]);
}

/** Depuis l'écran d'un voyage : tous ses rappels, tâches et réservations compris. */
export function useRappelsDuVoyage(
  voyage: VoyageARappeler | null,
  contexte: { moi: string | null | undefined; taches: readonly Tache[] | undefined; reservations: readonly Reservation[] | undefined },
): void {
  const choix = useChoixDesRappels();
  const { moi, taches, reservations } = contexte;
  const rappels = useMemo(
    () => (voyage ? rappelsDuVoyage(voyage, { maintenant: new Date(), moi, taches, reservations }) : []),
    [voyage, moi, taches, reservations],
  );
  const cle = empreinte(rappels);
  // Tant que les tâches ou les réservations ne sont pas chargées, on ne sait
  // pas : mieux vaut attendre que d'effacer leurs rappels.
  const pret = Boolean(voyage) && taches !== undefined && reservations !== undefined;

  useEffect(() => {
    if (!rappelsPossibles || choix !== 'actifs' || !pret || !voyage) return;
    void poserLesRappels(voyage.id, rappels);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cle, choix, pret, voyage?.id]);
}
