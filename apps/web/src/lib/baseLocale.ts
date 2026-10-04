/**
 * Une petite base IndexedDB, pour les fichiers que `localStorage` ne sait
 * pas garder (il ne range que du texte, et quelques mégaoctets au plus).
 *
 * Un seul magasin par base, des clés en texte. Chaque opération ouvre la
 * base et la referme : rien ne reste ouvert entre deux gestes, et une base
 * supprimée entre-temps (déconnexion) ne laisse pas de connexion pendante.
 */

function ouvrir(base: string, magasin: string): Promise<IDBDatabase> {
  return new Promise((resoudre, rejeter) => {
    const demande = indexedDB.open(base, 1);
    demande.onupgradeneeded = () => demande.result.createObjectStore(magasin);
    demande.onsuccess = () => resoudre(demande.result);
    demande.onerror = () => rejeter(demande.error ?? new Error('IndexedDB indisponible'));
  });
}

export async function operer<T>(
  base: string,
  magasin: string,
  mode: IDBTransactionMode,
  geste: (magasin: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const connexion = await ouvrir(base, magasin);
  try {
    return await new Promise<T>((resoudre, rejeter) => {
      const demande = geste(connexion.transaction(magasin, mode).objectStore(magasin));
      demande.onsuccess = () => resoudre(demande.result);
      demande.onerror = () => rejeter(demande.error ?? new Error('IndexedDB'));
    });
  } finally {
    connexion.close();
  }
}

/** Efface la base entière. Sans erreur si elle n'existe pas. */
export function supprimerLaBase(base: string): Promise<void> {
  return new Promise((resoudre) => {
    try {
      const demande = indexedDB.deleteDatabase(base);
      demande.onsuccess = () => resoudre();
      demande.onerror = () => resoudre();
      // Une autre fenêtre la tient ouverte : elle sera effacée à sa fermeture.
      demande.onblocked = () => resoudre();
    } catch {
      resoudre();
    }
  });
}
