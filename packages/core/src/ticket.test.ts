import { describe, expect, it } from 'vitest';
import { lireLeTicket, montantsDeLaLigne } from './ticket.js';

describe('lire un ticket de caisse', () => {
  it('un supermarché français : le net à payer, pas la TVA ni le rendu', () => {
    const texte = `CARREFOUR CITY
12 rue de Rivoli 75004 Paris
Tel 01 23 45 67 89
Le 28/09/2026 a 19:42
PAIN DE MIE        2,15
TOMATES 1,2KG      3,58
EAU 6X1,5L         2,94
2 x 1,45           2,90
SOUS-TOTAL        11,57
TOTAL TTC         11,57 €
TVA 5,5%           0,60
CB EMV            11,57
RENDU              0,00
MERCI DE VOTRE VISITE`;
    expect(lireLeTicket(texte)).toEqual({
      montantCents: 1157,
      devise: 'EUR',
      date: '2026-09-28',
      commerce: 'Carrefour City',
      categorie: 'food',
    });
  });

  it('un restaurant : total sur la ligne suivante, pourboire à part', () => {
    const texte = `Le Petit Bistrot
Table 12 - 3 couverts
Menu du jour x3     54,00
Vin rouge           18,50
Café x3              7,50
TOTAL
80,00
Total HT            72,73
TVA 10%              7,27
Date: 2026-10-03 21:15`;
    const lecture = lireLeTicket(texte);
    expect(lecture.montantCents).toBe(8000);
    expect(lecture.date).toBe('2026-10-03');
    expect(lecture.commerce).toBe('Le Petit Bistrot');
    expect(lecture.categorie).toBe('food');
  });

  it('en Espagne : « TOTAL A PAGAR » et une date à points', () => {
    const texte = `MERCADONA S.A.
C/ Mayor 4, Madrid
FACTURA SIMPLIFICADA
03.11.26 12:05
AGUA MINERAL     0,65
JAMON SERRANO    4,20
TOTAL A PAGAR    4,85 EUR
TARJETA          4,85
IVA 10%          0,44`;
    const lecture = lireLeTicket(texte);
    expect(lecture.montantCents).toBe(485);
    expect(lecture.date).toBe('2026-11-03');
    expect(lecture.devise).toBe('EUR');
    expect(lecture.categorie).toBe('food');
  });

  it('au Royaume-Uni : livres sterling, montant à point décimal', () => {
    const texte = `Pret A Manger
Victoria Station
Coffee            £2.95
Sandwich          £4.50
Balance due       £7.45
Card              £7.45
VAT included      £1.24
15/10/2026`;
    const lecture = lireLeTicket(texte);
    expect(lecture.montantCents).toBe(745);
    expect(lecture.devise).toBe('GBP');
    expect(lecture.date).toBe('2026-10-15');
  });

  it('un musée, un taxi, un hôtel : la catégorie suit le ticket', () => {
    expect(lireLeTicket('MUSEE DU LOUVRE\nBillet plein tarif 22,00\nTOTAL 22,00').categorie).toBe('activities');
    expect(lireLeTicket('TAXI G7\nCourse 34,60\nTOTAL 34,60 EUR').categorie).toBe('transport');
    expect(lireLeTicket('HOTEL DES ARTS\n2 nuitees 180,00\nTaxe de sejour 4,40\nTotal 184,40').categorie).toBe(
      'accommodation',
    );
  });

  it('un texte mal lu : un O pour un zéro, un total mal orthographié', () => {
    const lecture = lireLeTicket('BOULANGERIE PAUL\nBaguette 1,2O\nCroissant x2 2,6O\nT0TAL 3,8O');
    expect(lecture.montantCents).toBe(380);
  });

  it('sans mot « total », le plus gros montant l’emporte', () => {
    expect(lireLeTicket('Kiosque\nJournal 2,80\nChewing-gum 1,20\n4,00').montantCents).toBe(400);
  });

  it('ne tranche pas quand le ticket ne dit rien', () => {
    expect(lireLeTicket('')).toEqual({
      montantCents: null,
      devise: null,
      date: null,
      commerce: null,
      categorie: null,
    });
    // Deux devises : un prix converti, on laisse choisir.
    expect(lireLeTicket('Duty free\nTotal 25,00 EUR\n21,50 GBP').devise).toBeNull();
  });
});

describe('les montants d’une ligne', () => {
  it('exige les centimes, et ignore dates, téléphones et pourcentages', () => {
    expect(montantsDeLaLigne('TOTAL 1 234,50')).toEqual([123_450]);
    expect(montantsDeLaLigne('12€50')).toEqual([1250]);
    expect(montantsDeLaLigne('Le 30.09.26 a 12:30')).toEqual([]);
    expect(montantsDeLaLigne('Tel 01.23.45.67.89')).toEqual([]);
    expect(montantsDeLaLigne('TVA 5,50%')).toEqual([]);
    expect(montantsDeLaLigne('Caisse 12 ticket 4521')).toEqual([]);
  });
});
