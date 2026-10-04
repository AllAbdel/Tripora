import { describe, expect, it } from 'vitest';
import { COLONNES, LIGNES, paysSous, pointsDeTerre, projeter } from './carteDuMonde';

describe('la carte du monde en points', () => {
  it('décode toute la grille, et rien qu’elle', () => {
    const points = pointsDeTerre();
    expect(points.length).toBe(3888);
    expect(points.every((point) => point.colonne >= 0 && point.colonne < COLONNES)).toBe(true);
    expect(points.every((point) => point.ligne >= 0 && point.ligne < LIGNES)).toBe(true);
  });

  it('met les villes dans leur pays', () => {
    expect(paysSous(48.86, 2.35)).toBe('FR'); // Paris
    expect(paysSous(40.42, -3.7)).toBe('ES'); // Madrid
    expect(paysSous(-23.55, -46.63)).toBe('BR'); // São Paulo
    expect(paysSous(35.68, 139.69)).toBe('JP'); // Tokyo
    expect(paysSous(-0.8, 114)).toBe('ID'); // Bornéo indonésien
    // La Norvège, que Natural Earth code « -99 », a bien ses points.
    expect(pointsDeTerre().some((point) => point.code === 'NO')).toBe(true);
  });

  it('laisse la mer vide', () => {
    expect(paysSous(30, -40)).toBeNull(); // Atlantique
  });

  it('projette de l’ouest à l’est et du nord au sud', () => {
    expect(projeter(84, -180)).toEqual({ x: 0, y: 0 });
    expect(projeter(0, 0)).toEqual({ x: 90, y: 42 });
    // Au-delà des bords, le lieu reste sur la carte.
    expect(projeter(-80, 10).y).toBe(LIGNES);
  });
});
