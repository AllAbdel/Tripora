import { describe, expect, it } from 'vitest';
import { continentDe } from './continents.js';
import { niveauPour, passeport, type VoyageDuPasseport } from './passeport.js';

const PARIS = { lat: 48.8566, lng: 2.3522 };

function voyage(modif: Partial<VoyageDuPasseport> & { id: string }): VoyageDuPasseport {
  return {
    titre: modif.id,
    codePays: 'PT',
    pays: 'Portugal',
    ville: 'Lisbonne',
    destination: { lat: 38.7223, lng: -9.1393 },
    origine: PARIS,
    debut: '2026-05-01',
    fin: '2026-05-04',
    participants: 4,
    organisateur: false,
    ...modif,
  };
}

const AUJOURDHUI = '2026-09-24';

describe('les continents', () => {
  it('suivent une convention de voyageur', () => {
    expect(continentDe('FR')).toBe('europe');
    expect(continentDe('tr')).toBe('europe');
    expect(continentDe('JP')).toBe('asie');
    expect(continentDe('RE')).toBe('afrique');
    expect(continentDe('MX')).toBe('amerique-du-nord');
    expect(continentDe('PF')).toBe('oceanie');
    expect(continentDe('ZZ')).toBeUndefined();
    expect(continentDe(null)).toBeUndefined();
  });
});

describe('ce qui compte dans le passeport', () => {
  it('un voyage daté, commencé, à la destination retenue', () => {
    const p = passeport(
      [
        voyage({ id: 'fait' }),
        voyage({ id: 'en-cours', debut: '2026-09-20', fin: '2026-09-30', codePays: 'ES', pays: 'Espagne' }),
        voyage({ id: 'sans-destination', codePays: null }),
        voyage({ id: 'sans-dates', debut: null, fin: null, codePays: 'IT' }),
        voyage({ id: 'a-venir', debut: '2026-10-10', fin: '2026-10-12', codePays: 'IT' }),
      ],
      AUJOURDHUI,
    );
    expect(p.faits.map((v) => v.id)).toEqual(['en-cours', 'fait']);
    expect(p.pays.map((pays) => pays.code).sort()).toEqual(['ES', 'PT']);
    expect(p.prochain).toMatchObject({ voyage: { id: 'a-venir' }, dansJours: 16 });
  });

  it('compte les pays une fois, les jours et les kilomètres à chaque voyage', () => {
    const p = passeport(
      [voyage({ id: 'a' }), voyage({ id: 'b', debut: '2026-06-01', fin: '2026-06-01' })],
      AUJOURDHUI,
    );
    expect(p.pays).toEqual([{ code: 'PT', nom: 'Portugal', fois: 2 }]);
    expect(p.jours).toBe(5);
    // Paris–Lisbonne ≈ 1 450 km, aller et retour, deux fois.
    expect(p.kilometres).toBeGreaterThan(5600);
    expect(p.kilometres).toBeLessThan(6000);
  });

  it('n’invente pas de kilomètres sans ville de départ', () => {
    expect(passeport([voyage({ id: 'a', origine: null })], AUJOURDHUI).kilometres).toBe(0);
  });

  it('vide, il reste un point de départ', () => {
    const p = passeport([], AUJOURDHUI);
    expect(p.faits).toEqual([]);
    expect(p.niveau).toEqual({ nom: 'Voyageur en herbe', seuil: 0, suivant: { nom: 'Explorateur', manque: 1 } });
    expect(p.tampons.every((tampon) => !tampon.obtenu)).toBe(true);
  });
});

describe('les tampons', () => {
  const obtenus = (voyages: VoyageDuPasseport[]) =>
    passeport(voyages, AUJOURDHUI)
      .tampons.filter((tampon) => tampon.obtenu)
      .map((tampon) => tampon.id);

  it('le premier départ, et le week-end éclair — trois jours, pas quatre', () => {
    expect(obtenus([voyage({ id: 'a', fin: '2026-05-03' })])).toEqual(['premier-depart', 'week-end-eclair']);
    expect(obtenus([voyage({ id: 'a', fin: '2026-05-04' })])).toEqual(['premier-depart']);
  });

  it('long-courrier, grande tablée, organisateur, au long cours', () => {
    const tokyo = voyage({
      id: 'tokyo',
      codePays: 'JP',
      pays: 'Japon',
      destination: { lat: 35.6762, lng: 139.6503 },
      debut: '2026-04-01',
      fin: '2026-04-15',
      participants: 6,
      organisateur: true,
    });
    expect(obtenus([tokyo])).toEqual(
      expect.arrayContaining(['long-courrier', 'grande-tablee', 'organisateur', 'au-long-cours']),
    );
    expect(obtenus([tokyo])).not.toContain('week-end-eclair');
  });

  it('dit où l’on en est d’un tampon qui se compte', () => {
    const p = passeport(
      [voyage({ id: 'a' }), voyage({ id: 'b', codePays: 'ES', pays: 'Espagne' }), voyage({ id: 'c', codePays: 'MA', pays: 'Maroc' })],
      AUJOURDHUI,
    );
    const cinqPays = p.tampons.find((tampon) => tampon.id === 'cinq-pays')!;
    expect(cinqPays).toMatchObject({ obtenu: false, progression: { fait: 3, objectif: 5 } });
    expect(p.tampons.find((tampon) => tampon.id === 'deux-continents')!.obtenu).toBe(true);
  });
});

describe('les rangs', () => {
  it('montent avec le nombre de pays, et disent ce qui manque', () => {
    expect(niveauPour(1).nom).toBe('Explorateur');
    expect(niveauPour(4)).toEqual({ nom: 'Baroudeur', seuil: 3, suivant: { nom: 'Grand voyageur', manque: 2 } });
    expect(niveauPour(30)).toEqual({ nom: 'Légende', seuil: 25 });
  });
});
