import { describe, expect, it } from 'vitest';
import { jourDeLaPhoto, priseDeVuePlausible, problemeDeLegende, regrouperParJour, type PhotoDuVoyage } from './journal.js';

function photo(id: string, priseLe: string | null, ajouteLe = '2026-06-20T10:00:00Z'): PhotoDuVoyage {
  return {
    id,
    tripId: 'v1',
    chemin: `v1/${id}.jpg`,
    cheminMini: `v1/${id}.mini.jpg`,
    legende: null,
    priseLe,
    largeur: 1600,
    hauteur: 1200,
    taille: 300_000,
    ajoutePar: 'moi',
    ajouteLe,
  };
}

describe('le jour d’une photo', () => {
  it('suit l’heure du lieu du voyage', () => {
    // 23 h à Bali (UTC+8) : encore le 12, alors qu'il est 17 h à Paris.
    const soirABali = photo('a', '2026-06-12T15:00:00Z');
    expect(jourDeLaPhoto(soirABali, 'Asia/Makassar')).toBe('2026-06-12');
    // 1 h du matin à Bali : déjà le 13.
    expect(jourDeLaPhoto(photo('b', '2026-06-12T17:00:00Z'), 'Asia/Makassar')).toBe('2026-06-13');
  });

  it('prend la date du dépôt quand la prise de vue est inconnue', () => {
    expect(jourDeLaPhoto(photo('c', null, '2026-06-20T10:00:00Z'), 'Europe/Paris')).toBe('2026-06-20');
  });
});

describe('le journal par jour', () => {
  const photos = [
    photo('3', '2026-06-13T09:00:00Z'),
    photo('1', '2026-06-11T08:00:00Z'),
    photo('2', '2026-06-11T18:00:00Z'),
    photo('0', '2026-06-09T12:00:00Z'),
  ];

  it('numérote les jours du séjour, dans l’ordre du voyage', () => {
    const jours = regrouperParJour(photos, { debut: '2026-06-10', fin: '2026-06-15', fuseau: 'Europe/Paris' });
    expect(jours.map((jour) => jour.jour)).toEqual(['2026-06-09', '2026-06-11', '2026-06-13']);
    expect(jours[1]!.titre).toMatch(/^Jour 2 · jeudi 11 juin/u);
    expect(jours[2]!.titre).toMatch(/^Jour 4 · samedi 13 juin/u);
    // La veille du départ n'a pas de numéro.
    expect(jours[0]!.titre).toMatch(/^Mardi 9 juin/u);
    // Dans la journée, du matin au soir.
    expect(jours[1]!.photos.map((p) => p.id)).toEqual(['1', '2']);
  });

  it('sans dates de voyage, la date seule', () => {
    const jours = regrouperParJour(photos, { fuseau: 'Europe/Paris' });
    expect(jours.every((jour) => !jour.titre.startsWith('Jour'))).toBe(true);
  });
});

describe('ce qu’on garde d’un fichier', () => {
  const maintenant = Date.parse('2026-10-02T12:00:00Z');

  it('une date de prise de vue plausible seulement', () => {
    expect(priseDeVuePlausible(Date.parse('2026-09-28T19:00:00Z'), maintenant)).toBe('2026-09-28T19:00:00.000Z');
    expect(priseDeVuePlausible(Date.parse('2027-01-01T00:00:00Z'), maintenant)).toBeNull();
    expect(priseDeVuePlausible(0, maintenant)).toBeNull();
    expect(priseDeVuePlausible(undefined, maintenant)).toBeNull();
  });

  it('une légende courte', () => {
    expect(problemeDeLegende('Plage de Balangan')).toBeNull();
    expect(problemeDeLegende('x'.repeat(281))).toMatch(/280/u);
  });
});
