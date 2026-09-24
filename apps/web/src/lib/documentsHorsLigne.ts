import type { DocumentDuVoyage } from '@tripora/core';
import { operer, supprimerLaBase } from './baseLocale';

/**
 * Les copies des documents du coffre gardées sur cet appareil.
 *
 * La carte d'embarquement se cherche au comptoir, dans un aéroport où le
 * réseau ne passe pas, ou à l'étranger sans forfait. Un document « gardé sur
 * cet appareil » est téléchargé une fois et s'ouvre ensuite depuis cette
 * copie, avec ou sans réseau.
 *
 * Les copies partent quand le document quitte le coffre, et toutes à la
 * déconnexion : un scan de passeport n'a pas à rester sur un téléphone prêté.
 */

const BASE = 'tripora-hors-ligne';
const MAGASIN = 'documents';

interface Copie {
  tripId: string;
  fichier: Blob;
  taille: number;
  gardeLe: string;
}

export async function garderUneCopie(document: DocumentDuVoyage, fichier: Blob): Promise<void> {
  const copie: Copie = { tripId: document.tripId, fichier, taille: fichier.size, gardeLe: new Date().toISOString() };
  await operer(BASE, MAGASIN, 'readwrite', (magasin) => magasin.put(copie, document.chemin));
}

export async function copieDe(chemin: string): Promise<Blob | undefined> {
  try {
    const copie = await operer<Copie | undefined>(BASE, MAGASIN, 'readonly', (magasin) => magasin.get(chemin));
    return copie?.fichier;
  } catch {
    return undefined;
  }
}

/** Les documents d'un voyage gardés ici, et la place qu'ils prennent. */
export async function copiesDuVoyage(tripId: string): Promise<Record<string, number>> {
  try {
    const [cles, copies] = await Promise.all([
      operer<IDBValidKey[]>(BASE, MAGASIN, 'readonly', (magasin) => magasin.getAllKeys()),
      operer<Copie[]>(BASE, MAGASIN, 'readonly', (magasin) => magasin.getAll()),
    ]);
    const resultat: Record<string, number> = {};
    cles.forEach((cle, index) => {
      const copie = copies[index];
      if (copie?.tripId === tripId) resultat[String(cle)] = copie.taille;
    });
    return resultat;
  } catch {
    return {};
  }
}

export async function oublierLaCopie(chemin: string): Promise<void> {
  try {
    await operer(BASE, MAGASIN, 'readwrite', (magasin) => magasin.delete(chemin));
  } catch {
    // Pas de base : pas de copie.
  }
}

/** Retire les copies d'un voyage dont le document a quitté le coffre. */
export async function oublierLesCopiesDisparues(tripId: string, cheminsExistants: ReadonlySet<string>): Promise<void> {
  const gardees = await copiesDuVoyage(tripId);
  for (const chemin of Object.keys(gardees)) {
    if (!cheminsExistants.has(chemin)) await oublierLaCopie(chemin);
  }
}

/** Toutes les copies de cet appareil, à la déconnexion. */
export function oublierToutesLesCopies(): Promise<void> {
  return supprimerLaBase(BASE);
}
