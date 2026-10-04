import { queryOptions } from '@tanstack/react-query';
import { LIMITES_DU_JOURNAL, priseDeVuePlausible, type PhotoDuVoyage } from '@tripora/core';
import { supabase } from './supabase';
import { operer as opererSurLaBase } from './baseLocale';

/**
 * Le journal photo du voyage.
 *
 * En ligne, chaque photo part en deux fichiers dans l'espace privé `journal`
 * de Supabase — la photo (1 600 pixels) et sa vignette (480) — et sa fiche
 * dans `photos_du_voyage`. Tout le groupe voit toutes les photos ; l'auteur
 * et l'organisateur peuvent en retirer (testé dans
 * `supabase/tests/journal_test.sql`).
 *
 * Chaque photo est redessinée avant l'envoi : orientée comme le téléphone
 * l'affichait, allégée, et débarrassée de ses métadonnées — dont la position
 * GPS que l'appareil photo y inscrit. Rien de cela ne quitte l'appareil.
 *
 * Sans serveur, les fichiers vivent dans ce navigateur (IndexedDB).
 */

export interface NouvellePhoto {
  fichier: File;
  legende?: string;
}

export interface EspaceDuJournal {
  utilise: number;
  limite: number;
}

export type Taille = 'mini' | 'photo';

export interface JournalApi {
  lister(tripId: string): Promise<PhotoDuVoyage[]>;
  deposer(tripId: string, photo: NouvellePhoto): Promise<void>;
  /** Des adresses lisibles quelques temps, par identifiant de photo. */
  adresses(photos: readonly PhotoDuVoyage[], taille: Taille): Promise<Record<string, string>>;
  legender(id: string, legende: string): Promise<void>;
  supprimer(photo: PhotoDuVoyage): Promise<void>;
  espace(): Promise<EspaceDuJournal | null>;
  ecouter(tripId: string, surChangement: () => void): () => void;
}

/** Une erreur dont le message peut être montré tel quel. */
export class ErreurDuJournal extends Error {}

const ESPACE = 'journal';
/** Une adresse signée vaut une heure : la grille se recharge bien avant. */
const VALIDITE_SECONDES = 60 * 60;

/* ---------------------------------------------------- Préparer la photo -- */

interface PhotoPreparee {
  photo: Blob;
  mini: Blob;
  largeur: number;
  hauteur: number;
}

async function redessiner(image: ImageBitmap, cote: number, qualite: number): Promise<{ blob: Blob; largeur: number; hauteur: number }> {
  const echelle = Math.min(1, cote / Math.max(image.width, image.height));
  const largeur = Math.max(1, Math.round(image.width * echelle));
  const hauteur = Math.max(1, Math.round(image.height * echelle));
  const toile = document.createElement('canvas');
  toile.width = largeur;
  toile.height = hauteur;
  const contexte = toile.getContext('2d');
  if (!contexte) throw new ErreurDuJournal('Ce navigateur ne sait pas préparer la photo.');
  contexte.drawImage(image, 0, 0, largeur, hauteur);
  const blob = await new Promise<Blob | null>((resoudre) => toile.toBlob(resoudre, 'image/jpeg', qualite));
  if (!blob) throw new ErreurDuJournal('Ce navigateur ne sait pas préparer la photo.');
  return { blob, largeur, hauteur };
}

export async function preparerLaPhoto(fichier: Blob): Promise<PhotoPreparee> {
  let image: ImageBitmap;
  try {
    image = await createImageBitmap(fichier, { imageOrientation: 'from-image' });
  } catch {
    throw new ErreurDuJournal(
      'Cette photo ne s’ouvre pas dans ce navigateur (format HEIC ?). Choisissez-la en JPEG, ou depuis l’appareil photo.',
    );
  }
  try {
    let photo = await redessiner(image, LIMITES_DU_JOURNAL.cotePhoto, 0.82);
    // Au-delà de 2 Mo, l'espace la refuserait : on baisse la qualité.
    if (photo.blob.size > 1.9 * 1024 * 1024) photo = await redessiner(image, LIMITES_DU_JOURNAL.cotePhoto, 0.6);
    const mini = await redessiner(image, LIMITES_DU_JOURNAL.coteVignette, 0.72);
    return { photo: photo.blob, mini: mini.blob, largeur: photo.largeur, hauteur: photo.hauteur };
  } finally {
    image.close();
  }
}

/* ---------------------------------------------------------- Mode serveur -- */

interface Ligne {
  id: string;
  trip_id: string;
  chemin: string;
  chemin_mini: string;
  legende: string | null;
  prise_le: string | null;
  largeur: number | null;
  hauteur: number | null;
  taille: number | null;
  ajoute_par: string | null;
  ajoute_le: string;
}

export function depuisLaBase(ligne: Ligne): PhotoDuVoyage {
  return {
    id: ligne.id,
    tripId: ligne.trip_id,
    chemin: ligne.chemin,
    cheminMini: ligne.chemin_mini,
    legende: ligne.legende,
    priseLe: ligne.prise_le,
    largeur: ligne.largeur,
    hauteur: ligne.hauteur,
    taille: ligne.taille,
    ajoutePar: ligne.ajoute_par,
    ajouteLe: ligne.ajoute_le,
  };
}

/** Le refus du stockage, dit dans les mots de la personne. */
function expliquerLeRefus(erreur: { message?: string; statusCode?: string | number }): ErreurDuJournal {
  const message = erreur.message ?? '';
  const statut = Number(erreur.statusCode);
  if (statut === 413 || /too large|maximum allowed size/iu.test(message)) {
    return new ErreurDuJournal('Cette photo est trop lourde, même allégée.');
  }
  if (statut === 403 || /row-level security|unauthorized/iu.test(message)) {
    return new ErreurDuJournal(
      'Envoi refusé : vos photos occupent déjà 80 Mo, ou vous ne faites plus partie de ce voyage.',
    );
  }
  return new ErreurDuJournal('La photo n’a pas pu être envoyée. Réessayez dans un instant.');
}

export function getJournal(): JournalApi {
  const client = supabase;
  if (!client) return journalLocal;

  return {
    async lister(tripId) {
      const { data, error } = await client
        .from('photos_du_voyage')
        .select('id, trip_id, chemin, chemin_mini, legende, prise_le, largeur, hauteur, taille, ajoute_par, ajoute_le')
        .eq('trip_id', tripId);
      if (error) throw error;
      return (data as Ligne[]).map(depuisLaBase);
    },
    async deposer(tripId, { fichier, legende }) {
      const preparee = await preparerLaPhoto(fichier);
      const id = crypto.randomUUID();
      const chemin = `${tripId}/${id}.jpg`;
      const cheminMini = `${tripId}/${id}.mini.jpg`;
      const options = { contentType: 'image/jpeg', upsert: false, cacheControl: '31536000' };
      const envoi = await client.storage.from(ESPACE).upload(chemin, preparee.photo, options);
      if (envoi.error) throw expliquerLeRefus(envoi.error as { message?: string; statusCode?: string });
      const envoiMini = await client.storage.from(ESPACE).upload(cheminMini, preparee.mini, options);
      if (envoiMini.error) {
        await client.storage.from(ESPACE).remove([chemin]);
        throw expliquerLeRefus(envoiMini.error as { message?: string; statusCode?: string });
      }
      const { error } = await client.from('photos_du_voyage').insert({
        id,
        trip_id: tripId,
        chemin,
        chemin_mini: cheminMini,
        legende: legende?.trim() || null,
        prise_le: priseDeVuePlausible(fichier.lastModified),
        largeur: preparee.largeur,
        hauteur: preparee.hauteur,
      });
      if (error) {
        // Pas de fichier sans fiche : il occuperait le quota sans que
        // personne puisse le voir.
        await client.storage.from(ESPACE).remove([chemin, cheminMini]);
        throw /plein/u.test(error.message) ? new ErreurDuJournal(error.message) : error;
      }
    },
    async adresses(photos, taille) {
      if (photos.length === 0) return {};
      const chemins = photos.map((photo) => (taille === 'mini' ? photo.cheminMini : photo.chemin));
      const { data, error } = await client.storage.from(ESPACE).createSignedUrls(chemins, VALIDITE_SECONDES);
      if (error || !data) throw new ErreurDuJournal('Les photos ne se chargent pas. Êtes-vous connecté ?');
      const parChemin = new Map(data.map((entree) => [entree.path, entree.signedUrl]));
      return Object.fromEntries(
        photos.flatMap((photo, index) => {
          const adresse = parChemin.get(chemins[index]!);
          return adresse ? [[photo.id, adresse]] : [];
        }),
      );
    },
    async legender(id, legende) {
      const { error } = await client
        .from('photos_du_voyage')
        .update({ legende: legende.trim() || null })
        .eq('id', id);
      if (error) throw error;
    },
    async supprimer(photo) {
      // Les fichiers d'abord : c'est la fiche qui les rend visibles à
      // l'organisateur. Sans elle, il ne pourrait plus les retirer.
      const { error: erreurDesFichiers } = await client.storage.from(ESPACE).remove([photo.chemin, photo.cheminMini]);
      if (erreurDesFichiers) throw erreurDesFichiers;
      const { error } = await client.from('photos_du_voyage').delete().eq('id', photo.id);
      if (error) throw error;
    },
    async espace() {
      const { data, error } = await client.rpc('espace_du_journal');
      if (error) return null;
      const ligne = (data as { utilise: number; limite: number }[] | null)?.[0];
      return ligne ? { utilise: Number(ligne.utilise), limite: Number(ligne.limite) } : null;
    },
    ecouter(tripId, surChangement) {
      const canal = client
        .channel(`journal:${tripId}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'photos_du_voyage', filter: `trip_id=eq.${tripId}` },
          surChangement,
        )
        .subscribe();
      return () => {
        void client.removeChannel(canal);
      };
    },
  };
}

export const cleJournal = (tripId: string | undefined) => ['journal', tripId] as const;

export function requeteDuJournal(tripId: string | undefined) {
  return queryOptions({
    queryKey: cleJournal(tripId),
    queryFn: () => getJournal().lister(tripId!),
    enabled: Boolean(tripId),
  });
}

/* ------------------------------------------------------------ Mode local -- */

const CLE_DES_FICHES = 'tripora.local-journal';
const BASE_LOCALE = 'tripora-journal';
const MAGASIN = 'photos';

function lireLesFiches(): PhotoDuVoyage[] {
  try {
    const brut = localStorage.getItem(CLE_DES_FICHES);
    return brut ? (JSON.parse(brut) as PhotoDuVoyage[]) : [];
  } catch {
    return [];
  }
}

function ecrireLesFiches(fiches: PhotoDuVoyage[]): void {
  try {
    localStorage.setItem(CLE_DES_FICHES, JSON.stringify(fiches));
  } catch {
    // Stockage plein ou refusé : la fiche ne survivra pas au rechargement.
  }
}

function operer<T>(mode: IDBTransactionMode, geste: (magasin: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return opererSurLaBase(BASE_LOCALE, MAGASIN, mode, geste);
}

/** Les adresses déjà fabriquées, pour ne pas en créer une à chaque affichage. */
const adressesLocales = new Map<string, string>();

const journalLocal: JournalApi = {
  async lister(tripId) {
    return lireLesFiches().filter((fiche) => fiche.tripId === tripId);
  },
  async deposer(tripId, { fichier, legende }) {
    const preparee = await preparerLaPhoto(fichier);
    const id = crypto.randomUUID();
    const chemin = `${tripId}/${id}.jpg`;
    const cheminMini = `${tripId}/${id}.mini.jpg`;
    await operer('readwrite', (magasin) => magasin.put(preparee.photo, chemin));
    await operer('readwrite', (magasin) => magasin.put(preparee.mini, cheminMini));
    ecrireLesFiches([
      ...lireLesFiches(),
      {
        id,
        tripId,
        chemin,
        cheminMini,
        legende: legende?.trim() || null,
        priseLe: priseDeVuePlausible(fichier.lastModified),
        largeur: preparee.largeur,
        hauteur: preparee.hauteur,
        taille: preparee.photo.size,
        ajoutePar: 'moi',
        ajouteLe: new Date().toISOString(),
      },
    ]);
  },
  async adresses(photos, taille) {
    const sortie: Record<string, string> = {};
    for (const photo of photos) {
      const chemin = taille === 'mini' ? photo.cheminMini : photo.chemin;
      let adresse = adressesLocales.get(chemin);
      if (!adresse) {
        const fichier = await operer<Blob | undefined>('readonly', (magasin) => magasin.get(chemin));
        if (!fichier) continue;
        adresse = URL.createObjectURL(fichier);
        adressesLocales.set(chemin, adresse);
      }
      sortie[photo.id] = adresse;
    }
    return sortie;
  },
  async legender(id, legende) {
    ecrireLesFiches(
      lireLesFiches().map((fiche) => (fiche.id === id ? { ...fiche, legende: legende.trim() || null } : fiche)),
    );
  },
  async supprimer(photo) {
    for (const chemin of [photo.chemin, photo.cheminMini]) {
      await operer('readwrite', (magasin) => magasin.delete(chemin));
      const adresse = adressesLocales.get(chemin);
      if (adresse) URL.revokeObjectURL(adresse);
      adressesLocales.delete(chemin);
    }
    ecrireLesFiches(lireLesFiches().filter((fiche) => fiche.id !== photo.id));
  },
  async espace() {
    return null;
  },
  ecouter() {
    return () => {};
  },
};
