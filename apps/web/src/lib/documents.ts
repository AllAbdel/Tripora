import { queryOptions } from '@tanstack/react-query';
import { TYPES_DE_DOCUMENTS, type DocumentDuVoyage } from '@tripora/core';
import { supabase } from './supabase';
import { operer as opererSurLaBase } from './baseLocale';

/**
 * Les documents du coffre : billets, confirmations, scans.
 *
 * En ligne, le fichier va dans l'espace de stockage privé `documents` de
 * Supabase (`<voyage>/<fichier>`), et sa fiche dans `documents_du_voyage`.
 * Les politiques du stockage suivent la fiche : on ne lit un fichier que si
 * l'on peut lire sa fiche, et une fiche privée n'est lue que par son auteur
 * (testé dans `supabase/tests/documents_test.sql`).
 *
 * Sans serveur, les fichiers vivent dans ce navigateur (IndexedDB) et leurs
 * fiches à côté des autres données locales.
 */

export interface NouveauDocument {
  fichier: Blob;
  nom: string;
  prive: boolean;
}

export interface EspaceDesDocuments {
  utilise: number;
  limite: number;
}

export interface DocumentsApi {
  lister(tripId: string): Promise<DocumentDuVoyage[]>;
  deposer(tripId: string, document: NouveauDocument): Promise<void>;
  /** Une adresse d'où lire le fichier, valable quelques minutes. */
  adresse(document: DocumentDuVoyage): Promise<string>;
  /** Le fichier lui-même : pour l'afficher dans l'application, ou le garder. */
  telecharger(document: DocumentDuVoyage): Promise<Blob>;
  modifier(id: string, modification: { nom?: string; prive?: boolean }): Promise<void>;
  supprimer(document: DocumentDuVoyage): Promise<void>;
  espace(): Promise<EspaceDesDocuments | null>;
  ecouter(tripId: string, surChangement: () => void): () => void;
}

/** Une erreur dont le message peut être montré tel quel. */
export class ErreurDeDocument extends Error {}

const ESPACE = 'documents';

/* ---------------------------------------------------- Photos allégées -- */

/** Au-delà, une photo de billet est plus lourde qu'utile. */
const SEUIL_DE_COMPRESSION = 1.5 * 1024 * 1024;
const COTE_MAX = 2400;

/**
 * Une photo de téléphone pèse 3 à 5 Mo ; le QR code d'un billet reste
 * lisible à 2 400 pixels de côté, en JPEG, pour dix fois moins. On allège
 * les grosses photos avant de les envoyer : le quota gratuit dure dix fois
 * plus longtemps. Le HEIC, que les navigateurs ne savent pas toujours
 * décoder, part tel quel ; le PDF aussi.
 */
export async function alleger(fichier: Blob): Promise<Blob> {
  if (fichier.size <= SEUIL_DE_COMPRESSION) return fichier;
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(fichier.type)) return fichier;
  if (typeof createImageBitmap !== 'function' || typeof document === 'undefined') return fichier;
  try {
    const image = await createImageBitmap(fichier);
    const echelle = Math.min(1, COTE_MAX / Math.max(image.width, image.height));
    const toile = document.createElement('canvas');
    toile.width = Math.round(image.width * echelle);
    toile.height = Math.round(image.height * echelle);
    const contexte = toile.getContext('2d');
    if (!contexte) return fichier;
    contexte.drawImage(image, 0, 0, toile.width, toile.height);
    image.close();
    const allege = await new Promise<Blob | null>((resoudre) => toile.toBlob(resoudre, 'image/jpeg', 0.85));
    return allege && allege.size < fichier.size ? allege : fichier;
  } catch {
    return fichier;
  }
}

/* ---------------------------------------------------------- Mode serveur -- */

interface Ligne {
  id: string;
  trip_id: string;
  nom: string;
  chemin: string;
  type_mime: string | null;
  taille: number | null;
  prive: boolean;
  ajoute_par: string | null;
  ajoute_le: string;
}

function depuisLaBase(ligne: Ligne): DocumentDuVoyage {
  return {
    id: ligne.id,
    tripId: ligne.trip_id,
    nom: ligne.nom,
    chemin: ligne.chemin,
    typeMime: ligne.type_mime,
    taille: ligne.taille,
    prive: ligne.prive,
    ajoutePar: ligne.ajoute_par,
    ajouteLe: ligne.ajoute_le,
  };
}

/** Le refus du stockage, dit dans les mots de la personne. */
function expliquerLeRefus(erreur: { message?: string; statusCode?: string | number }): ErreurDeDocument {
  const message = erreur.message ?? '';
  const statut = Number(erreur.statusCode);
  if (statut === 413 || /too large|maximum allowed size/iu.test(message)) {
    return new ErreurDeDocument('Ce fichier est trop lourd : 10 Mo au plus.');
  }
  if (statut === 415 || /mime type/iu.test(message)) {
    return new ErreurDeDocument('Seuls les PDF et les photos vont dans le coffre.');
  }
  if (statut === 403 || /row-level security|unauthorized/iu.test(message)) {
    return new ErreurDeDocument(
      'Dépôt refusé : votre espace de documents est plein (50 Mo), ou vous ne faites plus partie de ce voyage.',
    );
  }
  return new ErreurDeDocument('Le fichier n’a pas pu être envoyé. Réessayez dans un instant.');
}

export function getDocuments(): DocumentsApi {
  const client = supabase;
  if (!client) return documentsLocaux;

  return {
    async lister(tripId) {
      const { data, error } = await client
        .from('documents_du_voyage')
        .select('id, trip_id, nom, chemin, type_mime, taille, prive, ajoute_par, ajoute_le')
        .eq('trip_id', tripId)
        .order('ajoute_le', { ascending: false });
      if (error) throw error;
      return (data as Ligne[]).map(depuisLaBase);
    },
    async deposer(tripId, { fichier, nom, prive }) {
      const leger = await alleger(fichier);
      const extension = TYPES_DE_DOCUMENTS[leger.type] ?? 'bin';
      const chemin = `${tripId}/${crypto.randomUUID()}.${extension}`;
      const envoi = await client.storage
        .from(ESPACE)
        .upload(chemin, leger, { contentType: leger.type, upsert: false, cacheControl: '3600' });
      if (envoi.error) throw expliquerLeRefus(envoi.error as { message?: string; statusCode?: string });
      const { error } = await client.from('documents_du_voyage').insert({ trip_id: tripId, nom: nom.trim(), chemin, prive });
      if (error) {
        // Pas de fichier sans fiche : il occuperait le quota sans que
        // personne puisse le voir.
        await client.storage.from(ESPACE).remove([chemin]);
        throw /plein/u.test(error.message) ? new ErreurDeDocument(error.message) : error;
      }
    },
    async adresse(document) {
      const { data, error } = await client.storage.from(ESPACE).createSignedUrl(document.chemin, 10 * 60);
      if (error || !data?.signedUrl) throw new ErreurDeDocument('Ce document ne s’ouvre pas. A-t-il été retiré ?');
      return data.signedUrl;
    },
    async telecharger(document) {
      const { data, error } = await client.storage.from(ESPACE).download(document.chemin);
      if (error || !data) throw new ErreurDeDocument('Ce document ne se télécharge pas. Êtes-vous connecté ?');
      return data;
    },
    async modifier(id, modification) {
      const { error } = await client
        .from('documents_du_voyage')
        .update({
          ...(modification.nom !== undefined ? { nom: modification.nom.trim() } : {}),
          ...(modification.prive !== undefined ? { prive: modification.prive } : {}),
        })
        .eq('id', id);
      if (error) throw error;
    },
    async supprimer(document) {
      // Le fichier d'abord : c'est la fiche qui le rend visible à
      // l'organisateur. Sans elle, il ne pourrait plus le retirer.
      const { error: erreurDuFichier } = await client.storage.from(ESPACE).remove([document.chemin]);
      if (erreurDuFichier) throw erreurDuFichier;
      const { error } = await client.from('documents_du_voyage').delete().eq('id', document.id);
      if (error) throw error;
    },
    async espace() {
      const { data, error } = await client.rpc('espace_des_documents');
      if (error) return null;
      const ligne = (data as { utilise: number; limite: number }[] | null)?.[0];
      return ligne ? { utilise: Number(ligne.utilise), limite: Number(ligne.limite) } : null;
    },
    ecouter(tripId, surChangement) {
      const canal = client
        .channel(`documents:${tripId}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'documents_du_voyage', filter: `trip_id=eq.${tripId}` },
          surChangement,
        )
        .subscribe();
      return () => {
        void client.removeChannel(canal);
      };
    },
  };
}

export const cleDocuments = (tripId: string | undefined) => ['documents', tripId] as const;

export function requeteDesDocuments(tripId: string | undefined) {
  return queryOptions({
    queryKey: cleDocuments(tripId),
    queryFn: () => getDocuments().lister(tripId!),
    enabled: Boolean(tripId),
  });
}

/* ------------------------------------------------------------ Mode local -- */

const CLE_DES_FICHES = 'tripora.local-documents';
const BASE_LOCALE = 'tripora-documents';
const MAGASIN = 'fichiers';

function lireLesFiches(): DocumentDuVoyage[] {
  try {
    const brut = localStorage.getItem(CLE_DES_FICHES);
    return brut ? (JSON.parse(brut) as DocumentDuVoyage[]) : [];
  } catch {
    return [];
  }
}

function ecrireLesFiches(fiches: DocumentDuVoyage[]): void {
  try {
    localStorage.setItem(CLE_DES_FICHES, JSON.stringify(fiches));
  } catch {
    // Stockage plein ou refusé : la fiche ne survivra pas au rechargement.
  }
}

function operer<T>(mode: IDBTransactionMode, geste: (magasin: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return opererSurLaBase(BASE_LOCALE, MAGASIN, mode, geste);
}

const documentsLocaux: DocumentsApi = {
  async lister(tripId) {
    return lireLesFiches()
      .filter((fiche) => fiche.tripId === tripId)
      .sort((a, b) => b.ajouteLe.localeCompare(a.ajouteLe));
  },
  async deposer(tripId, { fichier, nom, prive }) {
    const leger = await alleger(fichier);
    const chemin = `${tripId}/${crypto.randomUUID()}.${TYPES_DE_DOCUMENTS[leger.type] ?? 'bin'}`;
    await operer('readwrite', (magasin) => magasin.put(leger, chemin));
    ecrireLesFiches([
      ...lireLesFiches(),
      {
        id: crypto.randomUUID(),
        tripId,
        nom: nom.trim(),
        chemin,
        typeMime: leger.type,
        taille: leger.size,
        prive,
        ajoutePar: 'moi',
        ajouteLe: new Date().toISOString(),
      },
    ]);
  },
  async adresse(document) {
    return URL.createObjectURL(await documentsLocaux.telecharger(document));
  },
  async telecharger(document) {
    const fichier = await operer<Blob | undefined>('readonly', (magasin) => magasin.get(document.chemin));
    if (!fichier) throw new ErreurDeDocument('Ce document ne s’ouvre pas. A-t-il été retiré ?');
    return fichier;
  },
  async modifier(id, modification) {
    ecrireLesFiches(
      lireLesFiches().map((fiche) =>
        fiche.id === id
          ? {
              ...fiche,
              ...(modification.nom !== undefined ? { nom: modification.nom.trim() } : {}),
              ...(modification.prive !== undefined ? { prive: modification.prive } : {}),
            }
          : fiche,
      ),
    );
  },
  async supprimer(document) {
    await operer('readwrite', (magasin) => magasin.delete(document.chemin));
    ecrireLesFiches(lireLesFiches().filter((fiche) => fiche.id !== document.id));
  },
  async espace() {
    return null;
  },
  ecouter() {
    return () => {};
  },
};
