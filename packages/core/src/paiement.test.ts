import { describe, expect, it } from 'vitest';
import {
  ibanLisible,
  ibanValide,
  liensDePaiement,
  normaliserIban,
  normaliserPaypal,
  normaliserRevolut,
  normaliserWise,
  problemeDesMoyens,
} from './paiement.js';

describe('les identifiants collés, quelle que soit leur forme', () => {
  it('PayPal.me', () => {
    expect(normaliserPaypal('https://www.paypal.me/TomDupont')).toBe('TomDupont');
    expect(normaliserPaypal('paypal.me/tomdupont/25EUR')).toBe('tomdupont');
    expect(normaliserPaypal(' @tomdupont ')).toBe('tomdupont');
  });

  it('Revolut et Wise', () => {
    expect(normaliserRevolut('https://revolut.me/tom.d')).toBe('tom.d');
    expect(normaliserRevolut('@tom.d')).toBe('tom.d');
    expect(normaliserWise('https://wise.com/pay/me/thomasm123')).toBe('thomasm123');
  });
});

describe('l’IBAN', () => {
  it('valide un IBAN réel, avec ou sans espaces', () => {
    expect(ibanValide('FR76 3000 6000 0112 3456 7890 189')).toBe(true);
    expect(ibanValide('DE89370400440532013000')).toBe(true);
    expect(ibanValide('GB82 WEST 1234 5698 7654 32')).toBe(true);
  });

  it('attrape une faute de frappe et une inversion', () => {
    expect(ibanValide('FR76 3000 6000 0112 3456 7890 188')).toBe(false);
    expect(ibanValide('FR76 3000 6000 0112 3456 7809 189')).toBe(false);
    expect(ibanValide('pas un iban')).toBe(false);
  });

  it('s’écrit par groupes de quatre', () => {
    expect(ibanLisible('fr7630006000011234567890189')).toBe('FR76 3000 6000 0112 3456 7890 189');
    expect(normaliserIban('fr76 3000-6000')).toBe('FR7630006000');
  });
});

describe('ce qu’on enregistre', () => {
  it('refuse un IBAN faux, et un IBAN sans titulaire', () => {
    expect(problemeDesMoyens({ iban: 'FR7630006000011234567890188', titulaire: 'Tom' })).toMatch(/faute de frappe/u);
    expect(problemeDesMoyens({ iban: 'FR7630006000011234567890189' })).toMatch(/titulaire/u);
    expect(problemeDesMoyens({ iban: 'FR7630006000011234567890189', titulaire: 'Tom Dupont' })).toBeNull();
    expect(problemeDesMoyens({ paypal: 'https://x' })).toMatch(/PayPal/u);
  });
});

describe('les liens de paiement', () => {
  it('PayPal.me avec le montant, Revolut et Wise sans', () => {
    const liens = liensDePaiement({ paypal: 'tomdupont', revolut: 'tom.d', wise: 'thomasm123' }, 4250);
    expect(liens).toEqual([
      { id: 'paypal', libelle: 'PayPal', url: 'https://paypal.me/tomdupont/42.50EUR', montantInclus: true },
      { id: 'revolut', libelle: 'Revolut', url: 'https://revolut.me/tom.d', montantInclus: false },
      { id: 'wise', libelle: 'Wise', url: 'https://wise.com/pay/me/thomasm123', montantInclus: false },
    ]);
  });

  it('ne construit rien d’un identifiant douteux', () => {
    expect(liensDePaiement({ paypal: 'x/../evil' }, 100)).toEqual([]);
  });
});
