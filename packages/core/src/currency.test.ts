import { describe, expect, it } from 'vitest';
import {
  CURRENCIES,
  currencyForCountry,
  currencyName,
  describeRate,
  isConvertible,
  referenceRate,
  toReferenceCents,
} from './currency.js';
import { DESTINATIONS } from './catalog/destinations.js';
import { formatCents } from './money.js';

describe('catalogue des devises', () => {
  it('ne contient que des codes ISO à trois lettres, sans doublon', () => {
    const codes = CURRENCIES.map((devise) => devise.code);
    expect(new Set(codes).size).toBe(codes.length);
    for (const code of codes) expect(code).toMatch(/^[A-Z]{3}$/u);
  });

  it('donne une devise à chaque pays du catalogue', () => {
    // Sinon l'écran des dépenses proposerait l'euro au Maroc sans le dire.
    const manquants = [...new Set(DESTINATIONS.map((lieu) => lieu.countryCode))]
      .filter((pays) => currencyForCountry(pays) === undefined);
    expect(manquants).toEqual([]);
  });

  it('sait ce que la BCE ne publie pas', () => {
    // Relevé sur l'API le 6 septembre 2026 : ces trois-là en sont absentes.
    expect(isConvertible('MAD')).toBe(false);
    expect(isConvertible('RSD')).toBe(false);
    expect(isConvertible('ALL')).toBe(false);
    expect(isConvertible('PLN')).toBe(true);
    expect(isConvertible('pln')).toBe(true);
  });

  it('nomme aussi ce qu’il ne sait pas convertir', () => {
    // « la BCE ne publie pas de taux pour le dirham marocain » est une phrase
    // qu'un utilisateur comprend ; « devise MAD non prise en charge » non.
    expect(currencyName('MAD')).toBe('dirham marocain');
    expect(currencyName('PLN')).toBe('zloty polonais');
    expect(currencyName('XXX')).toBe('XXX');
  });

  it('a suivi le passage de la Bulgarie à l’euro', () => {
    // Le lev a quitté les taux de référence le 1er janvier 2026.
    expect(currencyForCountry('BG')).toBe('EUR');
    expect(isConvertible('BGN')).toBe(false);
  });
});

describe('conversion', () => {
  it('ramène une somme en devise locale vers l’euro', () => {
    // 100 zł au taux du 4 septembre 2026 : 1 € = 4,3148 zł.
    expect(toReferenceCents(10_000, 4.3148)).toBe(2318);
  });

  it('ne touche à rien quand la devise est déjà la bonne', () => {
    expect(toReferenceCents(4850, 1)).toBe(4850);
  });

  it('reste en centimes entiers', () => {
    for (const montant of [1, 7, 333, 99_999]) {
      expect(Number.isInteger(toReferenceCents(montant, 4.3148))).toBe(true);
    }
  });

  it('refuse un taux absurde plutôt que de produire un montant faux', () => {
    expect(() => toReferenceCents(1000, 0)).toThrow(RangeError);
    expect(() => toReferenceCents(1000, -2)).toThrow(RangeError);
    expect(() => toReferenceCents(1000, Number.NaN)).toThrow(RangeError);
  });

  it('fige un taux qui redonne le même montant', () => {
    // Le taux stocké dans la dépense doit reproduire la conversion faite le
    // jour de la saisie, sans quoi les comptes bougeraient tout seuls.
    const taux = referenceRate(4.3148);
    expect(Math.round(10_000 * taux)).toBe(toReferenceCents(10_000, 4.3148));
  });
});

describe('affichage', () => {
  it('montre le taux dans le sens où la BCE le publie', () => {
    expect(describeRate('PLN', 4.3148)).toBe('1 € = 4,315 zł');
  });

  it('arrondit les devises à gros chiffres', () => {
    expect(describeRate('HUF', 394.28)).toBe('1 € = 394 Ft');
  });

  it('n’invente pas de centimes aux devises qui n’en ont pas', () => {
    expect(formatCents(123_400, 'ISK')).not.toContain(',00');
    expect(formatCents(1250, 'EUR')).toContain('12,50');
  });
});
