import { describe, expect, it } from 'vitest';
import {
  lireLeClimat,
  preparerLaValise,
  typeDePrise,
  type ProfilValise,
  type RubriqueRemplie,
} from './packing.js';
import { findDestination } from './catalog/destinations.js';
import { normalizeWeights } from './preferences.js';
import type { TripConstraints } from './types.js';

function contraintes(surcharge: Partial<TripConstraints> = {}): TripConstraints {
  return {
    participants: 2,
    origin: { name: 'Paris', country: 'France', lat: 48.8566, lng: 2.3522 },
    durationDays: 6,
    dateMode: 'month',
    month: 7,
    budgetMode: 'max_per_person',
    budgetPerPersonCents: 60_000,
    comfortLevel: 'budget',
    groupType: 'friends',
    ...surcharge,
  };
}

/** Tous les articles, toutes rubriques confondues. */
function tout(rubriques: RubriqueRemplie[]) {
  return rubriques.flatMap((rubrique) => rubrique.articles);
}
function ids(rubriques: RubriqueRemplie[]) {
  return tout(rubriques).map((article) => article.id);
}
function article(rubriques: RubriqueRemplie[], id: string) {
  return tout(rubriques).find((entree) => entree.id === id);
}

const ISTANBUL = findDestination('istanbul')!;
const REYKJAVIK = findDestination('reykjavik') ?? findDestination('oslo')!;

describe('lecture du climat', () => {
  it('classe sur la température du jour, pas sur la moyenne', () => {
    expect(lireLeClimat({ month: 7, avgHighC: 34, avgLowC: 22, rainyDays: 0 })?.temps).toBe(
      'caniculaire',
    );
    expect(lireLeClimat({ month: 1, avgHighC: 3, avgLowC: -6, rainyDays: 5 })?.temps).toBe(
      'glacial',
    );
  });

  it('repère l’amplitude, qui est l’erreur la plus courante', () => {
    // 28 °C à Marrakech, et 10 °C la nuit : on regarde le premier chiffre et
    // on grelotte au dîner.
    const lecture = lireLeClimat({ month: 4, avgHighC: 28, avgLowC: 10, rainyDays: 2 })!;
    expect(lecture.temps).toBe('chaud');
    expect(lecture.amplitude).toBe(18);
  });

  it('n’invente rien sans normales', () => {
    expect(lireLeClimat(undefined)).toBeNull();
  });
});

describe('quantités', () => {
  it('ne fait pas emporter un pantalon par jour', () => {
    const valise = preparerLaValise({
      destination: ISTANBUL,
      constraints: contraintes({ durationDays: 14 }),
    });
    expect(article(valise, 'pantalons')?.quantite ?? 0).toBeLessThanOrEqual(4);
    // Les sous-vêtements, eux, ne se reportent pas : la marge est plus large.
    expect(article(valise, 'sous-vetements')!.quantite!).toBeGreaterThanOrEqual(6);
  });

  it('resserre tout quand une lessive est possible', () => {
    const sans = preparerLaValise({ destination: ISTANBUL, constraints: contraintes() });
    const avec = preparerLaValise({
      destination: ISTANBUL,
      constraints: contraintes(),
      profil: { besoins: [], lessivePossible: true, cabineSeulement: false },
    });
    expect(article(avec, 'sous-vetements')!.quantite!).toBeLessThan(
      article(sans, 'sous-vetements')!.quantite!,
    );
  });

  it('ajoute le sachet des liquides en cabine seule, et pas autrement', () => {
    const cabine: ProfilValise = { besoins: [], lessivePossible: false, cabineSeulement: true };
    expect(
      ids(preparerLaValise({ destination: ISTANBUL, constraints: contraintes(), profil: cabine })),
    ).toContain('sachet-liquides');
    expect(ids(preparerLaValise({ destination: ISTANBUL, constraints: contraintes() }))).not.toContain(
      'sachet-liquides',
    );
  });
});

describe('adaptation au climat', () => {
  it('propose des shorts et de la crème solaire en été à Istanbul', () => {
    const valise = ids(
      preparerLaValise({ destination: ISTANBUL, constraints: contraintes({ month: 7 }) }),
    );
    expect(valise).toContain('shorts');
    expect(valise).toContain('creme-solaire');
    expect(valise).not.toContain('manteau');
  });

  it('propose un manteau et des sous-couches en hiver', () => {
    const valise = ids(
      preparerLaValise({ destination: ISTANBUL, constraints: contraintes({ month: 1 }) }),
    );
    expect(valise).toContain('manteau');
    expect(valise).toContain('bonnet-gants');
    expect(valise).not.toContain('shorts');
  });

  it('prévoit le soir frais même quand le jour est chaud', () => {
    // C'est tout l'intérêt de regarder l'amplitude : une ville à 30 °C le jour
    // et 16 °C la nuit demande un pantalon, pas seulement des shorts.
    const valise = preparerLaValise({
      destination: ISTANBUL,
      constraints: contraintes({ month: 7 }),
    });
    const pantalons = article(valise, 'pantalons');
    if (pantalons) expect(pantalons.pourquoi).toMatch(/amplitude|frais|soir/i);
  });

  it('reste utilisable sans normales, en le disant', () => {
    const valise = preparerLaValise({
      destination: ISTANBUL,
      // Fenêtre sans mois déterminable : aucune normale n'est lisible.
      constraints: contraintes({ dateMode: 'exact', month: undefined }),
    });
    expect(ids(valise)).toContain('hauts-polyvalents');
    expect(article(valise, 'hauts-polyvalents')!.pourquoi).toMatch(/aucune normale/i);
  });
});

describe('adaptation aux envies', () => {
  it('sort les chaussures de randonnée quand le groupe a coché nature', () => {
    const valise = ids(
      preparerLaValise({
        destination: REYKJAVIK,
        constraints: contraintes(),
        envies: normalizeWeights({ nature: 1 }),
      }),
    );
    expect(valise).toContain('chaussures-rando');
    expect(valise).toContain('lampe-frontale');
  });

  it('ne sort rien de spécial sans envie marquée', () => {
    const valise = ids(preparerLaValise({ destination: REYKJAVIK, constraints: contraintes() }));
    expect(valise).not.toContain('chaussures-rando');
  });

  it('rappelle les épaules couvertes quand la culture compte', () => {
    const valise = ids(
      preparerLaValise({
        destination: ISTANBUL,
        constraints: contraintes(),
        envies: normalizeWeights({ culture: 1 }),
      }),
    );
    expect(valise).toContain('tenue-lieux-de-culte');
  });
});

describe('besoins personnels', () => {
  it('ne propose rien qui n’ait été coché', () => {
    const valise = ids(preparerLaValise({ destination: ISTANBUL, constraints: contraintes() }));
    // Aucune supposition à partir d'une identité : sans case cochée, rien.
    expect(valise).not.toContain('soutiens-gorge');
    expect(valise).not.toContain('protections');
    expect(valise).not.toContain('rasage');
  });

  it('ajoute exactement ce qui a été coché', () => {
    const valise = ids(
      preparerLaValise({
        destination: ISTANBUL,
        constraints: contraintes(),
        profil: {
          besoins: ['soutien-gorge', 'protections-periodiques', 'traitement-quotidien'],
          lessivePossible: false,
          cabineSeulement: false,
        },
      }),
    );
    expect(valise).toContain('soutiens-gorge');
    expect(valise).toContain('protections');
    expect(valise).toContain('traitement');
    expect(valise).not.toContain('rasage');
  });
});

describe('papiers et électricité', () => {
  it('ne demande pas de passeport pour un voyage intérieur', () => {
    const lyon = findDestination('lyon')!;
    const valise = preparerLaValise({ destination: lyon, constraints: contraintes() });
    expect(article(valise, 'piece-identite')!.label).toBe('Carte d’identité');
    expect(ids(valise)).not.toContain('visa');
    expect(ids(valise)).not.toContain('adaptateur');
  });

  it('nomme le type de prise là où il est connu', () => {
    expect(typeDePrise('gb')).toBe('G');
    expect(typeDePrise('JP')).toBe('A/B');
    // Là où ce serait un pari, on ne dit rien plutôt que de se tromper.
    expect(typeDePrise('ZZ')).toBeUndefined();
  });
});

describe('forme de la liste', () => {
  it('donne une raison à chaque article, sans exception', () => {
    const valise = tout(
      preparerLaValise({
        destination: ISTANBUL,
        constraints: contraintes(),
        envies: normalizeWeights({ nature: 1, culture: 1 }),
        profil: { besoins: ['lentilles'], lessivePossible: true, cabineSeulement: true },
      }),
    );
    expect(valise.length).toBeGreaterThan(20);
    for (const entree of valise) {
      expect(entree.pourquoi.length).toBeGreaterThan(5);
      expect(entree.label.length).toBeGreaterThan(2);
    }
  });

  it('ne propose jamais deux fois le même article', () => {
    const valise = ids(
      preparerLaValise({
        destination: ISTANBUL,
        constraints: contraintes({ month: 1 }),
        envies: normalizeWeights({ nature: 1, relax: 1, nightlife: 1, culture: 1 }),
      }),
    );
    expect(new Set(valise).size).toBe(valise.length);
  });

  it('marque ce qu’un seul du groupe peut emporter', () => {
    const valise = tout(preparerLaValise({ destination: ISTANBUL, constraints: contraintes() }));
    const partages = valise.filter((entree) => entree.partageable).map((entree) => entree.id);
    expect(partages).toContain('pharmacie');
    expect(partages).toContain('adaptateur');
    // Ce qui se porte à même la peau ne se partage pas.
    expect(partages).not.toContain('sous-vetements');
  });

  it('garde le marqueur « essentiel » rare, et sur ce qui ne s’achète pas', () => {
    // Quand tout est essentiel, plus rien ne l'est : le marqueur ne vaut que
    // s'il reste exceptionnel. Il ne désigne que ce dont l'oubli ne se répare
    // pas sur place — des papiers, une ordonnance, une correction de vue.
    const valise = tout(
      preparerLaValise({
        destination: ISTANBUL,
        constraints: contraintes({ month: 1 }),
        envies: normalizeWeights({ nature: 1, culture: 1 }),
        profil: {
          besoins: ['lentilles', 'traitement-quotidien'],
          lessivePossible: false,
          cabineSeulement: true,
        },
      }),
    );
    const essentiels = valise.filter((entree) => entree.essentiel).map((entree) => entree.id);

    expect(essentiels).toContain('piece-identite');
    expect(essentiels).toContain('lentilles');
    expect(essentiels).toContain('traitement');
    // Tout ça s'achète en dix minutes dans n'importe quelle ville.
    for (const achetable of ['brosse-a-dents', 'chargeur', 'adaptateur', 'creme-solaire', 'manteau']) {
      expect(essentiels).not.toContain(achetable);
    }
    expect(essentiels.length).toBeLessThanOrEqual(valise.length / 4);
  });

  it('ne laisse aucune rubrique vide', () => {
    const rubriques = preparerLaValise({ destination: ISTANBUL, constraints: contraintes() });
    expect(rubriques.every((rubrique) => rubrique.articles.length > 0)).toBe(true);
  });
});
