import { describe, expect, it } from 'vitest';
import {
  lienDAppel,
  lienDeLAdresse,
  lienWhatsApp,
  numeroAppelable,
  problemeDeLInfo,
  qrDuWifi,
  resumerLeCoffre,
  trierLesInfos,
  type InfoDuVoyage,
} from './coffre.js';

function info(genre: InfoDuVoyage['genre'], creeLe: string, titre = 'x'): InfoDuVoyage {
  return { id: `${genre}-${creeLe}`, tripId: 't', genre, titre, valeur: 'v', complement: null, creeLe };
}

describe('qrDuWifi', () => {
  it('suit le format que reconnaissent les appareils photo', () => {
    expect(qrDuWifi('Casa-Rosa', 'bemvindo2026')).toBe('WIFI:T:WPA;S:Casa-Rosa;P:bemvindo2026;;');
  });

  it('échappe les caractères qui couperaient le texte', () => {
    expect(qrDuWifi('Chez "Léa"; 5G', 'a:b,c\\d')).toBe('WIFI:T:WPA;S:Chez \\"Léa\\"\\; 5G;P:a\\:b\\,c\\\\d;;');
  });

  it('un réseau ouvert n’a pas de mot de passe', () => {
    expect(qrDuWifi('Gare-WiFi', '  ')).toBe('WIFI:T:nopass;S:Gare-WiFi;;');
  });
});

describe('numéros de téléphone', () => {
  it('garde les chiffres et le + international', () => {
    expect(numeroAppelable('+351 912 345 678')).toBe('+351912345678');
    expect(numeroAppelable('06.12.34.56.78')).toBe('0612345678');
    expect(numeroAppelable('0033 6 12 34 56 78')).toBe('+33612345678');
    expect(numeroAppelable('(212) 555-0199')).toBe('2125550199');
  });

  it('refuse ce qui n’est pas un numéro', () => {
    expect(numeroAppelable('appeler Maria')).toBeNull();
    expect(numeroAppelable('12')).toBeNull();
  });

  it('WhatsApp seulement avec l’indicatif du pays', () => {
    expect(lienWhatsApp('+351 912 345 678')).toBe('https://wa.me/351912345678');
    expect(lienWhatsApp('06 12 34 56 78')).toBeNull();
    expect(lienDAppel('06 12 34 56 78')).toBe('tel:0612345678');
  });
});

describe('problemeDeLInfo', () => {
  it('demande ce qui manque, dans les mots du genre', () => {
    expect(problemeDeLInfo({ genre: 'code', titre: '', valeur: '1234' })).toBe('Dites ce que ce code ouvre.');
    expect(problemeDeLInfo({ genre: 'adresse', titre: 'Appart', valeur: ' ' })).toBe('Indiquez l’adresse.');
  });

  it('accepte un wifi sans mot de passe', () => {
    expect(problemeDeLInfo({ genre: 'wifi', titre: 'Gare-WiFi', valeur: '' })).toBeNull();
  });

  it('vérifie le numéro d’un contact', () => {
    expect(problemeDeLInfo({ genre: 'contact', titre: 'Maria', valeur: 'sur WhatsApp' })).toMatch(/numéro/u);
    expect(problemeDeLInfo({ genre: 'contact', titre: 'Maria', valeur: '+351 912 345 678' })).toBeNull();
  });

  it('borne les longueurs', () => {
    expect(problemeDeLInfo({ genre: 'note', titre: 'x'.repeat(81), valeur: 'v' })).toMatch(/80/u);
    expect(problemeDeLInfo({ genre: 'note', titre: 'x', valeur: 'v', complement: 'c'.repeat(301) })).toMatch(/300/u);
  });
});

describe('rangement et résumé', () => {
  it('range par genre, puis dans l’ordre d’ajout', () => {
    const rangees = trierLesInfos([
      info('note', '2026-01-01'),
      info('wifi', '2026-01-03'),
      info('adresse', '2026-01-05'),
      info('code', '2026-01-04'),
      info('code', '2026-01-02'),
    ]);
    expect(rangees.map((i) => i.id)).toEqual([
      'adresse-2026-01-05',
      'code-2026-01-02',
      'code-2026-01-04',
      'wifi-2026-01-03',
      'note-2026-01-01',
    ]);
  });

  it('résume le coffre en une ligne', () => {
    expect(resumerLeCoffre([info('code', 'a'), info('code', 'b'), info('wifi', 'c')], 3)).toBe(
      '2 codes · 1 wifi · 3 documents',
    );
    expect(resumerLeCoffre([info('wifi', 'a'), info('wifi', 'b')])).toBe('2 wifi');
    expect(resumerLeCoffre([], 0)).toBeNull();
  });

  it('ouvre l’adresse dans les cartes', () => {
    expect(lienDeLAdresse(' 12 rua da Rosa, Lisboa ')).toBe(
      'https://www.google.com/maps/search/?api=1&query=12%20rua%20da%20Rosa%2C%20Lisboa',
    );
  });
});
