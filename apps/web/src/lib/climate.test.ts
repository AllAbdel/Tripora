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
    const normales: NormalesParVille = { izmir: SERIE };
    const source = sourceClimat(normales, 7)!;
    expect(source(ville('izmir'))?.avgHighC).toBe(7);
    expect(source(ville('izmir'))?.month).toBe(7);
  });

  it('ne dit rien pour une ville non relevée, plutôt que d’inventer', () => {
    // Le moteur retombe alors sur ses normales embarquées, puis sur
    // `bestMonths`. Renvoyer un objet vide le ferait noter sur du zéro.
    const source = sourceClimat({ izmir: SERIE }, 7)!;
    expect(source(ville('kyoto'))).toBeUndefined();
  });

  it('ne s’active pas sans mois visé ni sans aucune normale', () => {
    // Sans période fixée il n'y a pas de climat à noter, et une source vide
    // écraserait les normales embarquées par des « rien ».
    expect(sourceClimat({ izmir: SERIE }, undefined)).toBeUndefined();
    expect(sourceClimat({}, 7)).toBeUndefined();
  });

  it('survit à l’aller-retour JSON du cache persisté', () => {
    // Le bug qui a motivé ce test : les normales étaient une `Map`, le cache
    // de requêtes est écrit en JSON pour l’usage hors ligne, et
    // `JSON.stringify(new Map())` donne `{}`. Au rechargement suivant,
    // `.size` valait `undefined`, le garde-fou « aucune normale » ne se
    // déclenchait donc plus, et le moteur appelait `.get()` sur un objet nu.
    //
    // Toute donnée qui passe par une requête doit traverser JSON sans rien
    // perdre. Ce test le vérifie pour la forme autant que pour le contenu.
    const apresCache = JSON.parse(JSON.stringify({ izmir: SERIE })) as NormalesParVille;
    const source = sourceClimat(apresCache, 7);
    expect(source).toBeDefined();
    expect(source!(ville('izmir'))?.avgHighC).toBe(7);

    // Et une source vide reste reconnue comme vide après le même aller-retour.
    expect(sourceClimat(JSON.parse(JSON.stringify({})) as NormalesParVille, 7)).toBeUndefined();
  });
});
