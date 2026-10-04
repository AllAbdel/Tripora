import { describe, expect, it } from 'vitest';
import {
  computeBalances, shareOf, simplifyDebts, splitEqually, totalSpent,
  type Expense,
} from './settle.js';

const GROUPE = ['abdel', 'thomas', 'mehdi'];

function depense(id: string, paidBy: string, amountCents: number, entre = GROUPE): Expense {
  return { id, paidBy, amountCents, shares: splitEqually(amountCents, entre) };
}

describe('partage d’une dépense', () => {
  it('ne perd ni n’invente un centime', () => {
    for (const montant of [10_000, 1, 9_999, 48_012, 100]) {
      for (const taille of [1, 2, 3, 5, 7]) {
        const parts = splitEqually(montant, GROUPE.slice(0, 1).concat(
          Array.from({ length: taille - 1 }, (_, i) => `u${i}`),
        ));
        expect(parts.reduce((s, p) => s + p.shareCents, 0), `${montant}/${taille}`).toBe(montant);
      }
    }
  });

  it('donne le centime restant aux premiers, pas au vide', () => {
    // 100 € à trois : 33,34 / 33,33 / 33,33, et non trois fois 33,33.
    expect(splitEqually(10_000, GROUPE).map((p) => p.shareCents)).toEqual([3334, 3333, 3333]);
  });

  it('ne partage rien entre personne', () => {
    expect(splitEqually(5000, [])).toEqual([]);
  });
});

describe('soldes', () => {
  it('somme exactement à zéro, toujours', () => {
    const depenses = [
      depense('a', 'abdel', 48_000),
      depense('b', 'thomas', 12_000),
      depense('c', 'mehdi', 30_001),
      depense('d', 'abdel', 7),
    ];
    const soldes = computeBalances(depenses, GROUPE);
    expect(soldes.reduce((s, b) => s + b.cents, 0)).toBe(0);
  });

  it('crédite celui qui a avancé, débite ceux qui ont consommé', () => {
    const soldes = computeBalances([depense('a', 'abdel', 3000)], GROUPE);
    // Abdel a payé 30 € et en devait 10 : on lui doit 20 €.
    expect(soldes.find((b) => b.userId === 'abdel')?.cents).toBe(2000);
    expect(soldes.find((b) => b.userId === 'thomas')?.cents).toBe(-1000);
  });

  it('gère une dépense qui ne concerne qu’une partie du groupe', () => {
    const soldes = computeBalances(
      [{ id: 'x', paidBy: 'abdel', amountCents: 2000, shares: splitEqually(2000, ['abdel', 'thomas']) }],
      GROUPE,
    );
    expect(soldes.find((b) => b.userId === 'mehdi')?.cents).toBe(0);
    expect(soldes.find((b) => b.userId === 'abdel')?.cents).toBe(1000);
  });

  it('laisse à zéro un participant qui n’a rien payé ni rien consommé', () => {
    const soldes = computeBalances([], GROUPE);
    expect(soldes.every((b) => b.cents === 0)).toBe(true);
  });
});

describe('simplification des remboursements', () => {
  it('remet tout le monde exactement à zéro', () => {
    const depenses = [
      depense('a', 'abdel', 48_000),
      depense('b', 'thomas', 12_000),
      depense('c', 'mehdi', 30_001),
    ];
    const soldes = computeBalances(depenses, GROUPE);
    const virements = simplifyDebts(soldes);

    const apres = new Map(soldes.map((b) => [b.userId, b.cents]));
    for (const v of virements) {
      apres.set(v.from, apres.get(v.from)! + v.cents);
      apres.set(v.to, apres.get(v.to)! - v.cents);
    }
    for (const [userId, reste] of apres) {
      expect(reste, `${userId} n'est pas soldé`).toBe(0);
    }
  });

  it('en demande au plus un de moins qu’il n’y a de participants', () => {
    const grand = Array.from({ length: 8 }, (_, i) => `u${i}`);
    const depenses = grand.map((payeur, i) => depense(`d${i}`, payeur, 1000 * (i + 1), grand));
    const virements = simplifyDebts(computeBalances(depenses, grand));
    expect(virements.length).toBeLessThanOrEqual(grand.length - 1);
  });

  it('regroupe les allers-retours inutiles', () => {
    // Abdel doit 20 à Thomas, Mehdi doit 40 à Thomas, Thomas doit 15 à Mehdi.
    // Naïvement trois virements ; deux suffisent.
    const soldes = [
      { userId: 'abdel', cents: -2000 },
      { userId: 'thomas', cents: 4500 },
      { userId: 'mehdi', cents: -2500 },
    ];
    const virements = simplifyDebts(soldes);
    expect(virements).toHaveLength(2);
    expect(virements.every((v) => v.to === 'thomas')).toBe(true);
    expect(virements.reduce((s, v) => s + v.cents, 0)).toBe(4500);
  });

  it('ne propose jamais un virement à zéro', () => {
    const virements = simplifyDebts([
      { userId: 'a', cents: 0 },
      { userId: 'b', cents: 500 },
      { userId: 'c', cents: -500 },
    ]);
    expect(virements).toHaveLength(1);
    expect(virements[0]).toEqual({ from: 'c', to: 'b', cents: 500 });
  });

  it('ne propose rien quand tout est déjà équilibré', () => {
    expect(simplifyDebts([{ userId: 'a', cents: 0 }, { userId: 'b', cents: 0 }])).toEqual([]);
  });

  it('refuse de travailler sur des soldes qui ne s’équilibrent pas', () => {
    // Plutôt que d'inventer un remboursement bancal sur une donnée corrompue.
    expect(() => simplifyDebts([{ userId: 'a', cents: 100 }])).toThrow(/équilibrent pas/);
  });

  it('est reproductible : deux personnes voient les mêmes remboursements', () => {
    const soldes = [
      { userId: 'zoe', cents: -3000 },
      { userId: 'abdel', cents: 1500 },
      { userId: 'mehdi', cents: 1500 },
    ];
    expect(simplifyDebts(soldes)).toEqual(simplifyDebts([...soldes].reverse()));
  });

  it('tient sur des montants inégaux au centime près', () => {
    const depenses = [
      depense('a', 'abdel', 1),
      depense('b', 'thomas', 2),
      depense('c', 'mehdi', 99_997),
    ];
    const soldes = computeBalances(depenses, GROUPE);
    const virements = simplifyDebts(soldes);
    const total = virements.reduce((s, v) => s + v.cents, 0);
    const du = soldes.filter((b) => b.cents > 0).reduce((s, b) => s + b.cents, 0);
    expect(total).toBe(du);
  });
});

describe('totaux', () => {
  it('additionne ce que le groupe a dépensé', () => {
    expect(totalSpent([depense('a', 'abdel', 3000), depense('b', 'thomas', 1250)])).toBe(4250);
  });

  it('dit ce que chacun a consommé, indépendamment de qui a avancé', () => {
    const depenses = [depense('a', 'abdel', 3000), depense('b', 'thomas', 3000)];
    expect(shareOf(depenses, 'mehdi')).toBe(2000);
    expect(shareOf(depenses, 'abdel')).toBe(2000);
  });
});
