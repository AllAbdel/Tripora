import type { GeoPoint } from './types.js';

/**
 * Quelles tuiles de carte télécharger pour garder une destination hors ligne.
 *
 * Le principe des cartes en tuiles : à chaque niveau de zoom z, le monde est
 * un damier de 2^z × 2^z carrés. On ne garde pas tout — la planète entière au
 * zoom 14 pèse des centaines de gigaoctets — mais un entonnoir centré sur la
 * destination : le monde entier aux tout petits zooms (pour se situer), la
 * région autour, puis la ville rue par rue. Au-delà du zoom 14, la carte
 * agrandit les tuiles du zoom 14 elle-même : il n'y a rien de plus à prendre.
 */

export interface Tuile {
  z: number;
  x: number;
  y: number;
}

/** Une bande de zooms et le rayon couvert autour du point, en kilomètres (`null` : le monde entier). */
export interface Bande {
  de: number;
  a: number;
  rayonKm: number | null;
}

/** L'entonnoir des tuiles vectorielles (rues, noms, bâtiments). */
export const BANDES_VECTORIELLES: readonly Bande[] = [
  { de: 0, a: 2, rayonKm: null },
  { de: 3, a: 5, rayonKm: 800 },
  { de: 6, a: 8, rayonKm: 200 },
  { de: 9, a: 11, rayonKm: 50 },
  { de: 12, a: 13, rayonKm: 15 },
  { de: 14, a: 14, rayonKm: 7 },
];

/** Le relief ombré des petits zooms (images, au-delà du zoom 6 il n'existe plus). */
export const BANDES_DU_RELIEF: readonly Bande[] = [
  { de: 0, a: 2, rayonKm: null },
  { de: 3, a: 5, rayonKm: 800 },
];

const RAYON_TERRE_KM = 6371;
/** Au-delà, la projection de Mercator part à l'infini : les tuiles s'arrêtent là. */
const LATITUDE_MAX = 85.0511;

function colonne(lng: number, z: number): number {
  return Math.floor(((lng + 180) / 360) * 2 ** z);
}

function ligne(lat: number, z: number): number {
  const borne = Math.max(-LATITUDE_MAX, Math.min(LATITUDE_MAX, lat));
  const radians = (borne * Math.PI) / 180;
  return Math.floor(((1 - Math.log(Math.tan(radians) + 1 / Math.cos(radians)) / Math.PI) / 2) * 2 ** z);
}

/** Les tuiles d'un zoom qui couvrent un carré de `rayonKm` autour du point. */
export function tuilesAutour(point: GeoPoint, rayonKm: number | null, z: number): Tuile[] {
  const cote = 2 ** z;
  if (rayonKm === null) {
    return Array.from({ length: cote * cote }, (_, i) => ({ z, x: i % cote, y: Math.floor(i / cote) }));
  }
  const deltaLat = (rayonKm / RAYON_TERRE_KM) * (180 / Math.PI);
  const cosLat = Math.max(0.05, Math.cos((point.lat * Math.PI) / 180));
  const deltaLng = Math.min(180, deltaLat / cosLat);
  const xMin = colonne(point.lng - deltaLng, z);
  const xMax = colonne(point.lng + deltaLng, z);
  const yMin = Math.max(0, ligne(point.lat + deltaLat, z));
  const yMax = Math.min(cote - 1, ligne(point.lat - deltaLat, z));
  const tuiles: Tuile[] = [];
  for (let x = xMin; x <= xMax; x += 1) {
    // De part et d'autre de l'antiméridien (Fidji, Kamtchatka), le damier reboucle.
    const xBoucle = ((x % cote) + cote) % cote;
    for (let y = yMin; y <= yMax; y += 1) tuiles.push({ z, x: xBoucle, y });
  }
  return tuiles;
}

/** Toutes les tuiles d'un entonnoir, sans doublon, jusqu'au zoom maximal de la source. */
export function planDesTuiles(point: GeoPoint, bandes: readonly Bande[], zoomMax: number): Tuile[] {
  const vues = new Set<string>();
  const plan: Tuile[] = [];
  for (const bande of bandes) {
    for (let z = bande.de; z <= Math.min(bande.a, zoomMax); z += 1) {
      for (const tuile of tuilesAutour(point, bande.rayonKm, z)) {
        const cle = `${tuile.z}/${tuile.x}/${tuile.y}`;
        if (vues.has(cle)) continue;
        vues.add(cle);
        plan.push(tuile);
      }
    }
  }
  return plan;
}

/** « https://…/{z}/{x}/{y}.pbf » avec une tuile. */
export function adresseDeLaTuile(gabarit: string, tuile: Tuile): string {
  return gabarit.replace('{z}', String(tuile.z)).replace('{x}', String(tuile.x)).replace('{y}', String(tuile.y));
}

/**
 * Les plages de caractères à télécharger pour les noms de la carte.
 *
 * Les polices d'une carte vectorielle arrivent par paquets de 256 caractères.
 * L'alphabet latin et la ponctuation suffisent presque partout ; on ajoute
 * l'écriture du pays quand elle est autre. Le chinois, le japonais et le
 * coréen n'en ont pas besoin : la carte les dessine avec les polices du
 * téléphone.
 */
const ECRITURES: Record<string, readonly number[]> = {
  cyrillique: [1024],
  grec: [768],
  arabe: [1536, 1792, 64256, 64512, 64768, 65024, 65280],
  hebreu: [1280],
  armenien: [1280],
  georgien: [4096],
  thai: [3584],
  khmer: [6144],
  lao: [3584],
  devanagari: [2304],
  cinghalais: [3328],
};

const ECRITURE_DU_PAYS: Record<string, keyof typeof ECRITURES> = {
  RU: 'cyrillique', UA: 'cyrillique', BG: 'cyrillique', RS: 'cyrillique', MK: 'cyrillique', BY: 'cyrillique',
  ME: 'cyrillique', KZ: 'cyrillique', KG: 'cyrillique', MN: 'cyrillique',
  GR: 'grec', CY: 'grec',
  MA: 'arabe', DZ: 'arabe', TN: 'arabe', EG: 'arabe', JO: 'arabe', AE: 'arabe', SA: 'arabe', QA: 'arabe',
  OM: 'arabe', BH: 'arabe', KW: 'arabe', LB: 'arabe', IR: 'arabe',
  IL: 'hebreu', AM: 'armenien', GE: 'georgien', TH: 'thai', KH: 'khmer', LA: 'lao', NP: 'devanagari',
  IN: 'devanagari', LK: 'cinghalais',
};

export function plagesDeCaracteres(codePays: string | undefined): string[] {
  const debuts = new Set<number>([0, 256, 512, 8192]);
  const ecriture = codePays ? ECRITURE_DU_PAYS[codePays.toUpperCase()] : undefined;
  for (const debut of ecriture ? ECRITURES[ecriture]! : []) debuts.add(debut);
  return [...debuts].sort((a, b) => a - b).map((debut) => `${debut}-${debut + 255}`);
}

/**
 * Le poids qu'on annonce avant de télécharger. Une tuile de ville au zoom 14
 * pèse souvent 50 à 150 Ko, une tuile de campagne quelques kilo-octets : on
 * compte 35 Ko en moyenne, arrondi au mégaoctet supérieur — mieux vaut
 * annoncer un peu trop que l'inverse.
 */
export function poidsEstime(nombreDeTuiles: number): number {
  return Math.ceil((nombreDeTuiles * 35 * 1024) / (1024 * 1024)) * 1024 * 1024;
}
