import { describe, expect, it } from 'vitest';
import type { Destination } from '@tripora/core';
import { sourceClimat, type NormalesParVille } from './climate';

function ville(id: string, discovered = false): Destination {
  return {
    id,
    name: id,
    country: 'Test',
    countryCode: 'FR',
    lat: 43,
    lng: 5,
    iata: ['XXX'],
    tags: {
      culture: 0, nature: 0, food: 0, nightlife: 0,
      relax: 0, adventure: 0, shopping: 0, offbeat: 0,
    },
    costIndex: 1,
    poiRichness: 0.5,
    bestMonths: [6],
    ...(discovered ? { discovered: true } : {}),
  };
}

/** Douze triplets où le maximum vaut le numéro du mois : facile à vérifier. */
const SERIE = Array.from({ length: 36 }, (_, index) => Math.floor(index / 3) + 1);

describe('normales relevées, injectées dans le classement', () => {
  it('rend le mois demandé pour les villes relevées', () => {
    const normales: NormalesParVille = new Map([['izmir', SERIE]]);
    const source = sourceClimat(normales, 7)!;
    expect(source(ville('izmir'))?.avgHighC).toBe(7);
    expect(source(ville('izmir'))?.month).toBe(7);
  });

  it('ne dit rien pour une ville non relevée, plutôt que d’inventer', () => {
    // Le moteur retombe alors sur ses normales embarquées, puis sur
    // `bestMonths`. Renvoyer un objet vide le ferait noter sur du zéro.
    const source = sourceClimat(new Map([['izmir', SERIE]]), 7)!;
    expect(source(ville('kyoto'))).toBeUndefined();
  });

  it('ne s’active pas sans mois visé ni sans aucune normale', () => {
    // Sans période fixée il n'y a pas de climat à noter, et une source vide
    // écraserait les normales embarquées par des « rien ».
    expect(sourceClimat(new Map([['izmir', SERIE]]), undefined)).toBeUndefined();
    expect(sourceClimat(new Map(), 7)).toBeUndefined();
  });
});
