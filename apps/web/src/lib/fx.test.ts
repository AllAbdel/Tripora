import { describe, expect, it } from 'vitest';
import { devisesProposees } from './fx';
import type { FxRates } from '@tripora/core';

const TAUX: FxRates = {
  base: 'EUR',
  date: '2026-09-04',
  // Relevé réel du 4 septembre 2026, réduit à ce dont les tests ont besoin.
  rates: { PLN: 4.3148, CHF: 0.9382, HUF: 394.28, USD: 1.1642 },
};

describe('devises proposées à la saisie', () => {
  it('met la monnaie du pays en tête', () => {
    const codes = devisesProposees(TAUX, 'PLN').map((devise) => devise.code);
    expect(codes[0]).toBe('PLN');
    expect(codes[1]).toBe('EUR');
  });

  it('garde l’euro en tête quand on voyage dans la zone euro', () => {
    expect(devisesProposees(TAUX, 'EUR')[0]?.code).toBe('EUR');
  });

  it('ne propose que ce que la BCE publie ce jour-là', () => {
    const codes = devisesProposees(TAUX, undefined).map((devise) => devise.code);
    expect(codes.sort()).toEqual(['CHF', 'EUR', 'HUF', 'PLN', 'USD']);
  });

  it('ignore une monnaie locale que la BCE ne publie pas', () => {
    // Marrakech : pas de dirham dans les taux de référence, donc pas de
    // conversion — et surtout pas une entrée qui ferait croire le contraire.
    const codes = devisesProposees(TAUX, 'MAD').map((devise) => devise.code);
    expect(codes).not.toContain('MAD');
    expect(codes[0]).toBe('EUR');
  });

  it('se rabat sur l’euro seul quand les taux manquent', () => {
    expect(devisesProposees(null, 'PLN')).toEqual([
      { code: 'EUR', name: 'euro', symbol: '€' },
    ]);
  });

  it('ne propose jamais deux fois la même devise', () => {
    const codes = devisesProposees(TAUX, 'PLN').map((devise) => devise.code);
    expect(new Set(codes).size).toBe(codes.length);
  });
});
