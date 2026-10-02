import { describe, expect, it } from 'vitest';
import {
  BANDES_DU_RELIEF,
  BANDES_VECTORIELLES,
  adresseDeLaTuile,
  planDesTuiles,
  plagesDeCaracteres,
  poidsEstime,
  tuilesAutour,
} from './tuiles.js';

const LISBONNE = { lat: 38.7223, lng: -9.1393 };
const FIDJI = { lat: -17.7134, lng: 178.065 };

describe('les tuiles autour d’une destination', () => {
  it('trouve la tuile de Lisbonne au zoom 14', () => {
    // Formule de référence du wiki OpenStreetMap (« Slippy map tilenames »),
    // calculée à part : Lisbonne centre au zoom 14 → 7776 / 6277.
    const tuiles = tuilesAutour(LISBONNE, 0.1, 14);
    expect(tuiles).toEqual([{ z: 14, x: 7776, y: 6277 }]);
  });

  it('couvre le monde entier aux tout petits zooms', () => {
    expect(tuilesAutour(LISBONNE, null, 2)).toHaveLength(16);
  });

  it('reboucle de l’autre côté de l’antiméridien', () => {
    const tuiles = tuilesAutour(FIDJI, 300, 6);
    const colonnes = new Set(tuiles.map((tuile) => tuile.x));
    expect(colonnes.has(0)).toBe(true);
    expect(colonnes.has(63)).toBe(true);
    expect(tuiles.every((tuile) => tuile.x >= 0 && tuile.x < 64)).toBe(true);
  });

  it('un entonnoir de quelques centaines de tuiles, sans doublon', () => {
    const vectorielles = planDesTuiles(LISBONNE, BANDES_VECTORIELLES, 14);
    const cles = new Set(vectorielles.map((tuile) => `${tuile.z}/${tuile.x}/${tuile.y}`));
    expect(cles.size).toBe(vectorielles.length);
    expect(vectorielles.length).toBeGreaterThan(200);
    expect(vectorielles.length).toBeLessThan(700);
    expect(Math.max(...vectorielles.map((tuile) => tuile.z))).toBe(14);
    // Le relief s'arrête au zoom maximal de sa source.
    expect(Math.max(...planDesTuiles(LISBONNE, BANDES_DU_RELIEF, 5).map((tuile) => tuile.z))).toBe(5);
  });

  it('remplit le gabarit d’adresse', () => {
    expect(adresseDeLaTuile('https://t.example/planet/v1/{z}/{x}/{y}.pbf', { z: 3, x: 4, y: 2 })).toBe(
      'https://t.example/planet/v1/3/4/2.pbf',
    );
  });
});

describe('les caractères des noms', () => {
  it('le latin partout, l’écriture du pays quand elle est autre', () => {
    expect(plagesDeCaracteres('PT')).toEqual(['0-255', '256-511', '512-767', '8192-8447']);
    expect(plagesDeCaracteres('GR')).toContain('768-1023');
    expect(plagesDeCaracteres('MA')).toContain('1536-1791');
    // Le japonais est dessiné par les polices du téléphone.
    expect(plagesDeCaracteres('JP')).toHaveLength(4);
  });

  it('annonce un poids arrondi au mégaoctet supérieur', () => {
    expect(poidsEstime(400)).toBe(14 * 1024 * 1024);
  });
});
