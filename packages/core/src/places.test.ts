import { describe, expect, it } from 'vitest';
import { classifyPoi, groupPoisByCategory, rankPois, type Poi } from './places.js';

function lieu(overrides: Partial<Poi> & Pick<Poi, 'id' | 'name'>): Poi {
  return {
    lat: 0,
    lng: 0,
    category: 'musee',
    axis: 'culture',
    label: 'Musée',
    ...overrides,
  };
}

describe('lecture des étiquettes OpenStreetMap', () => {
  it('reconnaît les grandes familles de lieux', () => {
    expect(classifyPoi({ tourism: 'museum' })?.axis).toBe('culture');
    expect(classifyPoi({ historic: 'castle' })?.category).toBe('monument');
    expect(classifyPoi({ leisure: 'park' })?.axis).toBe('nature');
    expect(classifyPoi({ natural: 'beach' })?.axis).toBe('relax');
    expect(classifyPoi({ amenity: 'marketplace' })?.axis).toBe('shopping');
    expect(classifyPoi({ tourism: 'viewpoint' })?.category).toBe('panorama');
  });

  it('écarte ce qu’aucune règle ne reconnaît plutôt que de le ranger au hasard', () => {
    expect(classifyPoi({ amenity: 'parking' })).toBeUndefined();
    expect(classifyPoi({ highway: 'bus_stop' })).toBeUndefined();
    expect(classifyPoi({})).toBeUndefined();
  });

  it('n’essaie pas de classer les restaurants et les bars', () => {
    // Décision assumée : OSM en connaît des milliers par ville, sans note ni
    // prix fiables. Les proposer reviendrait à recommander au hasard.
    expect(classifyPoi({ amenity: 'restaurant' })).toBeUndefined();
    expect(classifyPoi({ amenity: 'bar' })).toBeUndefined();
    expect(classifyPoi({ amenity: 'nightclub' })).toBeUndefined();
  });

  it('refuse un arbre, même étiqueté « attraction »', () => {
    // Vu sur Lisbonne : OSM marque les arbres remarquables tourism=attraction,
    // et leur lien Wikipédia mène à l'espèce botanique. Le figuier arrivait
    // donc dans la liste des visites avec la fiche « Ficus macrophylla ».
    expect(classifyPoi({ natural: 'tree', tourism: 'attraction' })).toBeUndefined();
    expect(classifyPoi({ natural: 'shrub' })).toBeUndefined();
  });

  it('préfère l’étiquette précise au fourre-tout « attraction »', () => {
    // Beaucoup de musées portent les deux. Le musée doit gagner.
    expect(classifyPoi({ tourism: 'museum', historic: 'castle' })?.category).toBe('musee');
    expect(classifyPoi({ tourism: 'attraction', historic: 'castle' })?.category).toBe('monument');
    expect(classifyPoi({ tourism: 'attraction' })?.label).toBe('À voir');
  });
});

describe('classement des lieux', () => {
  it('fait remonter ce qui correspond aux envies du groupe', () => {
    const liste = [
      lieu({ id: 'a', name: 'Centre commercial', axis: 'shopping', category: 'boutique', label: 'Centre commercial' }),
      lieu({ id: 'b', name: 'Musée national', axis: 'culture' }),
    ];
    expect(rankPois(liste, { culture: 1, shopping: 0 })[0]?.id).toBe('b');
    expect(rankPois(liste, { culture: 0, shopping: 1 })[0]?.id).toBe('a');
  });

  it('à envie égale, préfère un lieu documenté', () => {
    const liste = [
      lieu({ id: 'nu', name: 'Zzz sans fiche' }),
      lieu({ id: 'riche', name: 'Aaa avec fiche', extract: 'Un texte.', imageUrl: 'https://x/y.jpg' }),
    ];
    expect(rankPois(liste, { culture: 1 }).map((l) => l.id)).toEqual(['riche', 'nu']);
  });

  it('reste stable : même liste, même ordre', () => {
    const liste = [lieu({ id: 'b', name: 'Bbb' }), lieu({ id: 'a', name: 'Aaa' })];
    expect(rankPois(liste)).toEqual(rankPois(liste));
    expect(rankPois(liste).map((l) => l.id)).toEqual(['a', 'b']);
  });

  it('ne modifie pas la liste qu’on lui donne', () => {
    const liste = [lieu({ id: 'b', name: 'Bbb' }), lieu({ id: 'a', name: 'Aaa' })];
    rankPois(liste);
    expect(liste.map((l) => l.id)).toEqual(['b', 'a']);
  });

  it('traite une envie non exprimée comme tiède, pas comme un refus', () => {
    const liste = [
      lieu({ id: 'inconnu', name: 'Aaa', axis: 'nature', category: 'parc', label: 'Parc ou jardin' }),
      lieu({ id: 'refuse', name: 'Bbb', axis: 'shopping', category: 'boutique', label: 'Centre commercial' }),
    ];
    // shopping explicitement à 0, nature non exprimée : la nature passe devant.
    expect(rankPois(liste, { shopping: 0 })[0]?.id).toBe('inconnu');
  });
});

describe('regroupement par catégorie', () => {
  it('rassemble sans réordonner à l’intérieur d’un groupe', () => {
    const groupes = groupPoisByCategory([
      lieu({ id: '1', name: 'Musée A' }),
      lieu({ id: '2', name: 'Parc', category: 'parc', axis: 'nature', label: 'Parc ou jardin' }),
      lieu({ id: '3', name: 'Musée B' }),
    ]);
    expect(groupes.map((g) => g.category)).toEqual(['musee', 'parc']);
    expect(groupes[0]?.places.map((l) => l.id)).toEqual(['1', '3']);
    expect(groupes[0]?.label).toBe('Musée');
  });

  it('ne rend rien pour une liste vide', () => {
    expect(groupPoisByCategory([])).toEqual([]);
  });
});
