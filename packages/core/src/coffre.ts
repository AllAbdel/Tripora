/**
 * Le coffre du voyage : ce qu'on se transmet d'habitude en capture d'écran.
 *
 * Le code de la boîte à clés, le mot de passe du wifi, l'adresse exacte de
 * l'appartement, le numéro de l'hôte : quatre messages perdus dans la
 * discussion du groupe, qu'on cherche à 23 h devant une porte fermée. Une
 * ligne par info, rangée par genre, à portée de pouce pendant le séjour.
 */

export type GenreDInfo = 'adresse' | 'code' | 'wifi' | 'contact' | 'note';

export interface InfoDuVoyage {
  id: string;
  tripId: string;
  genre: GenreDInfo;
  /** Le nom : « Porte de l'immeuble », le réseau wifi, « Maria (l'hôte) ». */
  titre: string;
  /** L'essentiel : le code, le mot de passe, l'adresse, le numéro, le texte. */
  valeur: string;
  /** Ce qui aide à s'en servir : « 3e étage, porte de gauche ». */
  complement: string | null;
  creePar?: string | null;
  creeLe: string;
}

interface DescriptionDuGenre {
  libelle: string;
  /** Ce que désigne le titre pour ce genre, et un exemple. */
  titre: string;
  exempleDeTitre: string;
  /** Ce que désigne la valeur, et un exemple. */
  valeur: string;
  exempleDeValeur: string;
  titreManquant: string;
  valeurManquante: string;
}

/** Dans l'ordre où on en a besoin en arrivant : où, comment entrer, puis le reste. */
export const GENRES_D_INFO: Record<GenreDInfo, DescriptionDuGenre> = {
  adresse: {
    libelle: 'Adresse',
    titre: 'Lieu',
    exempleDeTitre: 'L’appartement',
    valeur: 'Adresse',
    exempleDeValeur: '12 rua da Rosa, Lisbonne',
    titreManquant: 'Donnez un nom à ce lieu.',
    valeurManquante: 'Indiquez l’adresse.',
  },
  code: {
    libelle: 'Code',
    titre: 'Ce qu’il ouvre',
    exempleDeTitre: 'Boîte à clés',
    valeur: 'Code',
    exempleDeValeur: '4521B',
    titreManquant: 'Dites ce que ce code ouvre.',
    valeurManquante: 'Indiquez le code.',
  },
  wifi: {
    libelle: 'Wifi',
    titre: 'Réseau',
    exempleDeTitre: 'Casa-Rosa-5G',
    valeur: 'Mot de passe',
    exempleDeValeur: 'bemvindo2026',
    titreManquant: 'Indiquez le nom du réseau.',
    valeurManquante: 'Indiquez le mot de passe.',
  },
  contact: {
    libelle: 'Contact',
    titre: 'Qui',
    exempleDeTitre: 'Maria (l’hôte)',
    valeur: 'Téléphone',
    exempleDeValeur: '+351 912 345 678',
    titreManquant: 'Indiquez de qui il s’agit.',
    valeurManquante: 'Indiquez le numéro.',
  },
  note: {
    libelle: 'Note',
    titre: 'Sujet',
    exempleDeTitre: 'Poubelles',
    valeur: 'Note',
    exempleDeValeur: 'Tri sélectif sous l’évier, ramassage le mardi',
    titreManquant: 'Donnez un titre à la note.',
    valeurManquante: 'La note est vide.',
  },
};

export const ORDRE_DES_GENRES: readonly GenreDInfo[] = ['adresse', 'code', 'wifi', 'contact', 'note'];

export const LIMITES_D_INFO = { titre: 80, valeur: 500, complement: 300 } as const;

/** Rangées par genre, puis dans l'ordre où on les a ajoutées. */
export function trierLesInfos(infos: readonly InfoDuVoyage[]): InfoDuVoyage[] {
  return [...infos].sort(
    (a, b) =>
      ORDRE_DES_GENRES.indexOf(a.genre) - ORDRE_DES_GENRES.indexOf(b.genre) || a.creeLe.localeCompare(b.creeLe),
  );
}

export interface BrouillonDInfo {
  genre: GenreDInfo;
  titre: string;
  valeur: string;
  complement?: string | null;
}

/** Ce qui empêche d'enregistrer l'info, ou `null`. */
export function problemeDeLInfo(info: BrouillonDInfo): string | null {
  const description = GENRES_D_INFO[info.genre];
  const titre = info.titre.trim();
  const valeur = info.valeur.trim();
  // Un wifi ouvert n'a pas de mot de passe ; tout le reste a une valeur.
  if (!titre) return description.titreManquant;
  if (!valeur && info.genre !== 'wifi') return description.valeurManquante;
  if (titre.length > LIMITES_D_INFO.titre) return `« ${description.titre} » : ${LIMITES_D_INFO.titre} caractères au plus.`;
  if (valeur.length > LIMITES_D_INFO.valeur) return `« ${description.valeur} » : ${LIMITES_D_INFO.valeur} caractères au plus.`;
  if ((info.complement ?? '').trim().length > LIMITES_D_INFO.complement) {
    return `Le complément : ${LIMITES_D_INFO.complement} caractères au plus.`;
  }
  if (info.genre === 'contact' && !numeroAppelable(valeur)) {
    return 'Ce numéro ne ressemble pas à un numéro de téléphone.';
  }
  return null;
}

/* ------------------------------------------------------------------ Wifi -- */

/** Les caractères que le format des QR wifi demande d'échapper. */
function echapperPourLeWifi(texte: string): string {
  return texte.replace(/([\\;,:"])/gu, '\\$1');
}

/**
 * Le texte d'un QR code qui connecte au réseau : l'appareil photo d'un
 * téléphone le reconnaît et propose de rejoindre le wifi, sans rien taper.
 * Format reconnu par Android et iOS (`WIFI:T:WPA;S:…;P:…;;`).
 */
export function qrDuWifi(reseau: string, motDePasse: string): string {
  const s = echapperPourLeWifi(reseau.trim());
  const mdp = motDePasse.trim();
  if (!mdp) return `WIFI:T:nopass;S:${s};;`;
  return `WIFI:T:WPA;S:${s};P:${echapperPourLeWifi(mdp)};;`;
}

/* ------------------------------------------------------------- Téléphone -- */

/** Les chiffres d'un numéro, avec le « + » international s'il y en a un. */
export function numeroAppelable(numero: string): string | null {
  const compact = numero.trim().replace(/^00/u, '+').replace(/[\s.\-()/]/gu, '');
  if (!/^\+?\d{4,16}$/u.test(compact)) return null;
  return compact;
}

export function lienDAppel(numero: string): string | null {
  const appelable = numeroAppelable(numero);
  return appelable ? `tel:${appelable}` : null;
}

/**
 * WhatsApp, pour l'hôte à l'étranger qu'on n'appelle pas au prix d'un appel
 * international. Seulement pour un numéro au format international : sans
 * indicatif, WhatsApp ne saurait pas de quel pays il s'agit.
 */
export function lienWhatsApp(numero: string): string | null {
  const appelable = numeroAppelable(numero);
  if (!appelable?.startsWith('+')) return null;
  return `https://wa.me/${appelable.slice(1)}`;
}

/* ----------------------------------------------------------------- Carte -- */

/** L'adresse dans l'application de cartes du téléphone. */
export function lienDeLAdresse(adresse: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(adresse.trim())}`;
}

/* ---------------------------------------------------------------- Résumé -- */

/** « 1 wifi · 2 codes · 1 adresse » : pour la case du coffre sur l'accueil du voyage. */
export function resumerLeCoffre(infos: readonly InfoDuVoyage[], documents = 0): string | null {
  const parties: string[] = [];
  for (const genre of ORDRE_DES_GENRES) {
    const nombre = infos.filter((info) => info.genre === genre).length;
    if (nombre === 0) continue;
    const libelle = GENRES_D_INFO[genre].libelle.toLowerCase();
    parties.push(`${nombre} ${nombre > 1 && genre !== 'wifi' ? `${libelle}s` : libelle}`);
  }
  if (documents > 0) parties.push(`${documents} document${documents > 1 ? 's' : ''}`);
  return parties.length > 0 ? parties.join(' · ') : null;
}
