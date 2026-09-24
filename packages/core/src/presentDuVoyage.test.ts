import { describe, expect, it } from 'vitest';
import { dateDuJour, momentDuVoyage, nuitsSansHebergement, periodeLisible } from './presentDuVoyage.js';

describe('le jour qu’il est là-bas', () => {
  // 23 h 30 à Paris le 9 juillet : déjà le 10 à Bali, encore le 9 à New York.
  const maintenant = new Date('2026-07-09T21:30:00Z');

  it('suit le fuseau de la destination', () => {
    expect(dateDuJour('Asia/Makassar', maintenant)).toBe('2026-07-10');
    expect(dateDuJour('America/New_York', maintenant)).toBe('2026-07-09');
  });

  it('se rabat sur l’appareil quand le fuseau est inconnu', () => {
    expect(dateDuJour('Pas/UnFuseau', maintenant)).toMatch(/^2026-07-(09|10)$/u);
    expect(dateDuJour(null, maintenant)).toMatch(/^2026-07-(09|10)$/u);
  });
});

describe('avant, pendant, après', () => {
  it('compte les jours jusqu’au départ', () => {
    expect(momentDuVoyage('2026-07-10', '2026-07-17', '2026-06-28')).toEqual({
      phase: 'avant',
      dansJours: 12,
    });
    expect(momentDuVoyage('2026-07-10', '2026-07-17', '2026-07-09')).toEqual({
      phase: 'avant',
      dansJours: 1,
    });
  });

  it('dit quel jour du séjour on vit, premier et dernier compris', () => {
    expect(momentDuVoyage('2026-07-10', '2026-07-17', '2026-07-10')).toEqual({
      phase: 'pendant',
      jour: 1,
      sur: 8,
    });
    expect(momentDuVoyage('2026-07-10', '2026-07-17', '2026-07-17')).toEqual({
      phase: 'pendant',
      jour: 8,
      sur: 8,
    });
  });

  it('compte les jours depuis le retour', () => {
    expect(momentDuVoyage('2026-07-10', '2026-07-17', '2026-07-20')).toEqual({
      phase: 'apres',
      depuisJours: 3,
    });
  });

  it('se tait sans dates arrêtées', () => {
    expect(momentDuVoyage(null, null, '2026-07-01')).toBeNull();
    expect(momentDuVoyage('2026-07-10', undefined, '2026-07-01')).toBeNull();
    expect(momentDuVoyage('2026-07-17', '2026-07-10', '2026-07-01')).toBeNull();
  });
});

describe('les nuits sans hébergement', () => {
  const hotel = (debutLe: string, finLe: string | null) => ({ type: 'hebergement' as const, debutLe, finLe });

  it('sans rien de réservé, tout le séjour', () => {
    expect(nuitsSansHebergement('2026-07-10', '2026-07-14', [])).toEqual([
      { arrivee: '2026-07-10', depart: '2026-07-14', nuits: 4 },
    ]);
  });

  it('rien quand chaque nuit a son toit, en plusieurs étapes', () => {
    expect(
      nuitsSansHebergement('2026-07-10', '2026-07-14', [
        hotel('2026-07-10', '2026-07-12'),
        hotel('2026-07-12', '2026-07-14'),
      ]),
    ).toEqual([]);
  });

  it('les trous entre deux hôtels, regroupés', () => {
    expect(
      nuitsSansHebergement('2026-07-10', '2026-07-17', [
        hotel('2026-07-10', '2026-07-12'),
        hotel('2026-07-15', '2026-07-16'),
      ]),
    ).toEqual([
      { arrivee: '2026-07-12', depart: '2026-07-15', nuits: 3 },
      { arrivee: '2026-07-16', depart: '2026-07-17', nuits: 1 },
    ]);
  });

  it('un hébergement sans date de départ ne couvre que sa première nuit', () => {
    expect(nuitsSansHebergement('2026-07-10', '2026-07-12', [hotel('2026-07-10', null)])).toEqual([
      { arrivee: '2026-07-11', depart: '2026-07-12', nuits: 1 },
    ]);
  });

  it('ignore les visites, les trajets, et ce qui déborde du séjour', () => {
    expect(
      nuitsSansHebergement('2026-07-10', '2026-07-12', [
        { type: 'activite', debutLe: '2026-07-10', finLe: '2026-07-12' },
        hotel('2026-07-01', '2026-07-11'),
      ]),
    ).toEqual([{ arrivee: '2026-07-11', depart: '2026-07-12', nuits: 1 }]);
  });

  it('un aller-retour dans la journée n’a pas de nuit', () => {
    expect(nuitsSansHebergement('2026-07-10', '2026-07-10', [])).toEqual([]);
  });
});

describe('une période, dite comme on la dit', () => {
  it('écrit le mois une fois quand il ne change pas', () => {
    expect(periodeLisible('2026-07-12', '2026-07-15')).toBe('du 12 au 15 juillet');
  });

  it('écrit les deux mois quand on change de mois', () => {
    expect(periodeLisible('2026-06-30', '2026-07-02')).toBe('du 30 juin au 2 juillet');
  });

  it('un seul jour, et le premier du mois en ordinal', () => {
    expect(periodeLisible('2026-07-01', '2026-07-01')).toBe('le 1er juillet');
    expect(periodeLisible('2026-07-01', '2026-07-03')).toBe('du 1er au 3 juillet');
    expect(periodeLisible('2026-07-11', '2026-07-21')).toBe('du 11 au 21 juillet');
  });
});
