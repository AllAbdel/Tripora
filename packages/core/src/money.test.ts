import { describe, expect, it } from 'vitest';
import { convertCents, formatCents, money, parseAmountToCents, splitCents, sumCents } from './money.js';

describe('money', () => {
  it('refuse un montant qui n’est pas en centimes entiers', () => {
    expect(() => money(12.5)).toThrow(TypeError);
  });

  it('lit une saisie française avec virgule', () => {
    expect(parseAmountToCents('12,50')).toBe(1250);
    expect(parseAmountToCents(' 7 ')).toBe(700);
    expect(parseAmountToCents(12.34)).toBe(1234);
    expect(parseAmountToCents('')).toBe(0);
  });

  it('refuse d’additionner deux devises différentes', () => {
    expect(() => sumCents([money(100, 'EUR'), money(100, 'HUF')])).toThrow(/conversion/);
  });

  it('additionne dans la même devise', () => {
    expect(sumCents([money(100), money(250), money(1)]).cents).toBe(351);
    expect(sumCents([]).cents).toBe(0);
  });
});

describe('splitCents', () => {
  it('répartit sans perdre ni inventer un centime', () => {
    for (const [total, parts] of [
      [1000, 3],
      [1, 4],
      [9999, 7],
      [48012, 5],
      [0, 3],
    ] as const) {
      const shares = splitCents(total, parts);
      expect(shares).toHaveLength(parts);
      expect(shares.reduce((a, b) => a + b, 0)).toBe(total);
    }
  });

  it('donne le reste aux premières parts', () => {
    expect(splitCents(1000, 3)).toEqual([334, 333, 333]);
  });

  it('gère les montants négatifs (remboursements)', () => {
    const shares = splitCents(-1000, 3);
    expect(shares.reduce((a, b) => a + b, 0)).toBe(-1000);
  });

  it('refuse un nombre de parts invalide', () => {
    expect(() => splitCents(100, 0)).toThrow(RangeError);
    expect(() => splitCents(100, 2.5)).toThrow(RangeError);
  });
});

describe('conversion et affichage', () => {
  it('convertit avec un taux et arrondit au centime', () => {
    expect(convertCents(10_000, 0.0026)).toBe(26);
    expect(() => convertCents(100, 0)).toThrow(RangeError);
  });

  it('formate en euros, sans centimes pour les estimations', () => {
    expect(formatCents(48_012, 'EUR', { hideCentimes: true })).toMatch(/480/);
    expect(formatCents(1250)).toMatch(/12,50/);
  });
});
