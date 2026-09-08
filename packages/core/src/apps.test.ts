import { describe, expect, it } from 'vitest';
import {
  applicationsPour,
  essentielles,
  porteeDeApplication,
  rubriquesPour,
  type ApplicationUtile,
  type CategorieApp,
} from './apps.js';

function app(
  id: string,
  category: CategorieApp,
  priority: number,
  countryCodes: string[] = [],
  destinationIds: string[] = [],
): ApplicationUtile {
  return {
    id,
    name: id,
    category,
    tagline: 'x',
    why: 'y',
    caveat: null,
    iosUrl: null,
    androidUrl: null,
    webUrl: null,
    countryCodes,
    destinationIds,
    priority,
  };
}

const ISTANBULKART = app('istanbulkart', 'transport_local', 95, ['TR'], ['istanbul']);
const BITAKSI = app('bitaksi', 'transport_local', 90, ['TR']);
const SAILY = app('saily', 'connectivite', 90);

const CATALOGUE: ApplicationUtile[] = [
  ISTANBULKART,
  BITAKSI,
  app('bolt', 'transport_local', 85, ['TR', 'FR', 'GR']),
  app('uber', 'transport_local', 75),
  SAILY,
  app('obilet', 'transport_longue', 80, ['TR']),
  app('suica', 'transport_local', 85, ['JP']),
  app('navitime', 'transport_longue', 85, ['JP']),
];

describe('portée d’une application', () => {
  it('ne sort une application de ville que dans cette ville', () => {
    const carte = ISTANBULKART;
    expect(porteeDeApplication(carte, { destinationId: 'istanbul', countryCode: 'TR' })).toBe(
      'ville',
    );
    // Même pays, autre ville : l'İstanbulkart n'aide personne à Antalya, et
    // la proposer donnerait un mauvais conseil sûr de lui.
    expect(porteeDeApplication(carte, { destinationId: 'antalya', countryCode: 'TR' })).toBeNull();
  });

  it('reconnaît le pays quelle que soit la casse du code', () => {
    expect(porteeDeApplication(BITAKSI, { countryCode: 'tr' })).toBe('pays');
  });

  it('sert les applications mondiales même sans destination arrêtée', () => {
    expect(porteeDeApplication(SAILY, {})).toBe('monde');
    expect(porteeDeApplication(BITAKSI, {})).toBeNull();
  });
});

describe('classement', () => {
  it('fait passer le local avant le national, et le national avant le mondial', () => {
    const liste = applicationsPour(CATALOGUE, { destinationId: 'istanbul', countryCode: 'TR' });
    expect(liste.map((a) => a.id)).toEqual([
      'istanbulkart', // ville
      'bitaksi', // pays, 90
      'bolt', // pays, 85
      'obilet', // pays, 80
      'saily', // monde, 90
      'uber', // monde, 75
    ]);
  });

  it('écarte ce qui ne concerne pas la destination', () => {
    const liste = applicationsPour(CATALOGUE, { destinationId: 'tokyo', countryCode: 'JP' });
    expect(liste.map((a) => a.id)).toEqual(['navitime', 'suica', 'saily', 'uber']);
  });

  it('range par rubrique sans laisser de titre vide', () => {
    const rubriques = rubriquesPour(CATALOGUE, { destinationId: 'istanbul', countryCode: 'TR' });
    expect(rubriques.map((r) => r.categorie)).toEqual([
      'connectivite',
      'transport_local',
      'transport_longue',
    ]);
    expect(rubriques.every((r) => r.applications.length > 0)).toBe(true);
  });

  it('plafonne une rubrique tout en disant combien elle en comptait', () => {
    const rubriques = rubriquesPour(CATALOGUE, { countryCode: 'TR' }, 2);
    const transport = rubriques.find((r) => r.categorie === 'transport_local');
    expect(transport?.applications.map((a) => a.id)).toEqual(['bitaksi', 'bolt']);
    expect(transport?.total).toBe(3);
  });
});

describe('parrainage', () => {
  it('ne change strictement rien au classement', () => {
    // Le jour où un lien de parrainage ferait remonter une fiche, tout le
    // catalogue perdrait sa valeur : on ne saurait plus si une recommandation
    // est là parce qu'elle est bonne ou parce qu'elle rapporte. Ce test est la
    // seule chose qui garantisse que ça reste vrai dans six mois.
    const sans = applicationsPour(CATALOGUE, { destinationId: 'istanbul', countryCode: 'TR' });

    const avec = applicationsPour(
      CATALOGUE.map((app) =>
        // On parraine le moins prioritaire du lot : s'il remontait, ça se
        // verrait immédiatement.
        app.id === 'uber'
          ? { ...app, referralUrl: 'https://exemple.test/parrainage', referralNote: 'note' }
          : app,
      ),
      { destinationId: 'istanbul', countryCode: 'TR' },
    );

    expect(avec.map((a) => a.id)).toEqual(sans.map((a) => a.id));
  });

  it('laisse passer une fiche sans parrainage comme avant', () => {
    const liste = applicationsPour(CATALOGUE, { countryCode: 'TR' });
    expect(liste.every((app) => app.referralUrl === undefined)).toBe(true);
  });
});

describe('les essentielles', () => {
  it('ne propose qu’une application par rubrique', () => {
    const tete = essentielles(CATALOGUE, { destinationId: 'istanbul', countryCode: 'TR' }, 5);
    const categories = tete.map((a) => a.category);
    expect(new Set(categories).size).toBe(categories.length);
  });

  it('préfère le local au mondial quand il y en a assez', () => {
    const tete = essentielles(CATALOGUE, { destinationId: 'istanbul', countryCode: 'TR' }, 2);
    expect(tete.map((a) => a.id)).toEqual(['istanbulkart', 'obilet']);
  });

  it('retombe sur le mondial quand la destination n’a rien de local', () => {
    const tete = essentielles(CATALOGUE, { destinationId: 'lisbonne', countryCode: 'PT' }, 3);
    expect(tete.map((a) => a.id)).toEqual(['saily', 'uber']);
  });
});
