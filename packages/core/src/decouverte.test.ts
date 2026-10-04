import { describe, expect, it } from 'vitest';
import { classementDuGroupe, paquetADecouvrir, phraseDesEnvies, varier, type IdeeADecouvrir } from './decouverte.js';

const idee = (id: string, axis: IdeeADecouvrir['axis'], prixCents = 0): IdeeADecouvrir => ({ id, nom: id, axis, prixCents });

const IDEES = [
  idee('musee-1', 'culture', 1000),
  idee('musee-2', 'culture', 500),
  idee('volcan', 'nature', 3000),
  idee('rafting', 'adventure', 4500),
  idee('temple', 'culture', 0),
];

describe('le paquet à découvrir', () => {
  it('écarte ce que j’ai déjà jugé, et suit les envies du groupe', () => {
    const paquet = paquetADecouvrir(IDEES, {
      avis: { temple: { pour: 1, contre: 0, moi: 'envie' } },
      envies: { nature: 1, culture: 0.5, adventure: 0.2 },
    });
    expect(paquet.map((i) => i.id)).toEqual(['volcan', 'musee-2', 'rafting', 'musee-1']);
  });

  it('ne garde que l’envie choisie', () => {
    const paquet = paquetADecouvrir(IDEES, { avis: {}, envies: {}, filtre: 'adventure' });
    expect(paquet.map((i) => i.id)).toEqual(['rafting']);
  });

  it('peut repasser ce que j’ai écarté', () => {
    const paquet = paquetADecouvrir(IDEES, {
      avis: { volcan: { pour: 0, contre: 1, moi: 'sans-moi' }, temple: { pour: 1, contre: 0, moi: 'envie' } },
      envies: {},
      revoirLesRefus: true,
    });
    expect(paquet.map((i) => i.id)).toEqual(['volcan']);
  });
});

describe('la variété', () => {
  it('intercale pour éviter deux cartes de la même envie d’affilée', () => {
    const liste = [idee('a', 'culture'), idee('b', 'culture'), idee('c', 'nature'), idee('d', 'culture')];
    expect(varier(liste).map((i) => i.id)).toEqual(['a', 'c', 'b', 'd']);
  });

  it('ne perd ni ne duplique rien', () => {
    const liste = [idee('a', 'culture'), idee('b', 'culture'), idee('c', 'culture')];
    expect(varier(liste).map((i) => i.id)).toEqual(['a', 'b', 'c']);
  });
});

describe('le classement du groupe', () => {
  it('les plus gardées d’abord, sans ce que personne ne veut', () => {
    const classement = classementDuGroupe(IDEES, {
      volcan: { pour: 3, contre: 1, moi: 'envie' },
      rafting: { pour: 3, contre: 0, moi: null },
      temple: { pour: 1, contre: 0, moi: null },
      'musee-1': { pour: 0, contre: 2, moi: 'sans-moi' },
    });
    expect(classement.map((l) => [l.idee.id, l.pour])).toEqual([
      ['rafting', 3],
      ['volcan', 3],
      ['temple', 1],
    ]);
  });
});

describe('combien, jamais qui', () => {
  it('dit le nombre, et soi-même seulement', () => {
    expect(phraseDesEnvies(3, false)).toBe('3 personnes en ont envie');
    expect(phraseDesEnvies(1, false)).toBe('1 personne en a envie');
    expect(phraseDesEnvies(3, true)).toBe('Vous et 2 autres en avez envie');
    expect(phraseDesEnvies(1, true)).toBe('Vous en avez envie');
    expect(phraseDesEnvies(0, false)).toBe('');
  });
});
