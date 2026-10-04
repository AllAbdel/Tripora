import { COLONNES, GRILLE, LIGNES, NORD, PAS, SUD } from './carteDuMonde.donnees';

/**
 * La carte du monde en points du passeport : la grille décodée, et la
 * projection d'un lieu sur elle (équirectangulaire, colonne et ligne).
 */

export interface PointDeTerre {
  colonne: number;
  ligne: number;
  /** Le code ISO du pays que couvre le point. */
  code: string;
}

export { COLONNES, LIGNES };

let enCache: PointDeTerre[] | null = null;

export function pointsDeTerre(): readonly PointDeTerre[] {
  if (enCache) return enCache;
  const points: PointDeTerre[] = [];
  GRILLE.forEach((texte, ligne) => {
    let colonne = 0;
    for (const [, code, nombre] of texte.matchAll(/([A-Z.]{2})(\d+)/gu)) {
      const combien = Number(nombre);
      if (code !== '..') {
        for (let i = 0; i < combien; i++) points.push({ colonne: colonne + i, ligne, code: code! });
      }
      colonne += combien;
    }
  });
  enCache = points;
  return points;
}

/** Où tombe un lieu sur la grille, en fractions de colonne et de ligne. */
export function projeter(lat: number, lng: number): { x: number; y: number } {
  const latBornee = Math.min(NORD, Math.max(SUD, lat));
  return { x: (lng + 180) / PAS, y: (NORD - latBornee) / PAS };
}

/** Le pays du point le plus proche d'un lieu, pour vérifier la grille. */
export function paysSous(lat: number, lng: number): string | null {
  const { x, y } = projeter(lat, lng);
  const colonne = Math.floor(x);
  const ligne = Math.floor(y);
  return pointsDeTerre().find((point) => point.colonne === colonne && point.ligne === ligne)?.code ?? null;
}
