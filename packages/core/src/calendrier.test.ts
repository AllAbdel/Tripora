import { describe, expect, it } from 'vitest';
import { calendrierDuVoyage, decalageDuFuseau, echapper, plier } from './calendrier.js';

const MAINTENANT = new Date('2026-09-23T10:00:00Z');

/** Les lignes logiques d'un fichier, dépliées comme un calendrier les lit. */
function deplier(fichier: string): string[] {
  return fichier.replace(/\r\n /gu, '').split('\r\n').filter(Boolean);
}

describe('export du programme en iCalendar', () => {
  const bali = calendrierDuVoyage({
    titre: 'Bali entre potes',
    fuseau: 'Asia/Makassar',
    maintenant: MAINTENANT,
    evenements: [
      { id: 'a1', titre: 'Le kecak au temple d’Uluwatu', date: '2026-07-10', debut: '18:00', fin: '19:30' },
      { id: 'a2', titre: 'Arrivée', date: '2026-07-10' },
    ],
  });
  const lignes = deplier(bali);

  it('produit un calendrier bien formé, en CRLF', () => {
    expect(lignes[0]).toBe('BEGIN:VCALENDAR');
    expect(lignes.at(-1)).toBe('END:VCALENDAR');
    expect(bali.endsWith('\r\n')).toBe(true);
    expect(bali.replace(/\r\n/gu, '')).not.toContain('\n');
    expect(lignes.filter((ligne) => ligne === 'BEGIN:VEVENT')).toHaveLength(2);
  });

  it('écrit les heures dans le fuseau de la destination, et le définit', () => {
    expect(lignes).toContain('DTSTART;TZID=Asia/Makassar:20260710T180000');
    expect(lignes).toContain('DTEND;TZID=Asia/Makassar:20260710T193000');
    expect(lignes).toContain('TZID:Asia/Makassar');
    expect(lignes).toContain('TZOFFSETTO:+0800');
  });

  it('fait d’un créneau sans heure une journée entière', () => {
    expect(lignes).toContain('DTSTART;VALUE=DATE:20260710');
    // La fin d'une journée entière est exclusive : le lendemain.
    expect(lignes).toContain('DTEND;VALUE=DATE:20260711');
  });

  it('donne un identifiant stable à chaque événement', () => {
    expect(lignes).toContain('UID:a1@tripora');
    expect(lignes).toContain('DTSTAMP:20260923T100000Z');
  });

  it('suit un changement d’heure en plein séjour', () => {
    // Lisbonne repasse à l'heure d'hiver dans la nuit du 24 au 25 octobre 2026.
    const lisbonne = deplier(
      calendrierDuVoyage({
        titre: 'Lisbonne',
        fuseau: 'Europe/Lisbon',
        maintenant: MAINTENANT,
        evenements: [
          { id: 'l1', titre: 'Alfama', date: '2026-10-22', debut: '10:00' },
          { id: 'l2', titre: 'Belém', date: '2026-10-28', debut: '10:00' },
        ],
      }),
    );
    const decalages = lisbonne.filter((ligne) => ligne.startsWith('TZOFFSETTO'));
    expect(decalages).toEqual(['TZOFFSETTO:+0100', 'TZOFFSETTO:+0000']);
    expect(lisbonne).toContain('DTSTART:20261025T000000');
  });

  it('calcule le décalage réel d’un fuseau', () => {
    expect(decalageDuFuseau('Asia/Makassar', '2026-07-10')).toBe(480);
    expect(decalageDuFuseau('America/New_York', '2026-07-10')).toBe(-240);
    expect(decalageDuFuseau('Asia/Kathmandu', '2026-07-10')).toBe(345);
  });

  it('retombe sur des heures flottantes sans fuseau reconnu', () => {
    const flottant = deplier(
      calendrierDuVoyage({
        titre: 'Ailleurs',
        fuseau: 'Pas/Un_Fuseau',
        maintenant: MAINTENANT,
        evenements: [{ id: 'x', titre: 'Visite', date: '2026-07-10', debut: '09:00' }],
      }),
    );
    expect(flottant).toContain('DTSTART:20260710T090000');
    expect(flottant.some((ligne) => ligne.startsWith('BEGIN:VTIMEZONE'))).toBe(false);
  });

  it('ignore une date illisible, et répare une fin avant le début', () => {
    const lignesReparees = deplier(
      calendrierDuVoyage({
        titre: 'T',
        maintenant: MAINTENANT,
        evenements: [
          { id: 'mauvais', titre: 'Sans date', date: 'bientôt', debut: '09:00' },
          { id: 'bon', titre: 'Bar', date: '2026-07-10', debut: '23:30', fin: '22:00' },
        ],
      }),
    );
    expect(lignesReparees.filter((ligne) => ligne === 'BEGIN:VEVENT')).toHaveLength(1);
    // Une heure par défaut, qui déborde sur le lendemain.
    expect(lignesReparees).toContain('DTEND:20260711T003000');
  });
});

describe('le texte, tel que le format l’exige', () => {
  it('échappe ce que le format réserve', () => {
    expect(echapper('Riz, poisson; et\\ sauce\nà volonté')).toBe(
      'Riz\\, poisson\\; et\\\\ sauce\\nà volonté',
    );
  });

  it('plie en lignes de 75 octets au plus, sans couper un caractère', () => {
    const longue = `DESCRIPTION:${'Pâtes à l’encre de seiche, écrevisses '.repeat(6)}`;
    const pliee = plier(longue);
    const encodeur = new TextEncoder();
    for (const physique of pliee.split('\r\n')) {
      expect(encodeur.encode(physique).length).toBeLessThanOrEqual(75);
    }
    expect(pliee.replace(/\r\n /gu, '')).toBe(longue);
  });
});
