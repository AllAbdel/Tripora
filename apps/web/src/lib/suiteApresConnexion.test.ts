import { beforeEach, describe, expect, it } from 'vitest';
import {
  estUneSuiteSure,
  lireLaSuite,
  oublierLaSuite,
  prendreLaSuite,
  retenirLaSuite,
} from './suiteApresConnexion';

describe('la suite après connexion', () => {
  beforeEach(() => sessionStorage.clear());

  it('ramène là où l’on allait, une seule fois', () => {
    retenirLaSuite('/voyages/nouveau?destination=bergen');
    expect(lireLaSuite()).toBe('/voyages/nouveau?destination=bergen');
    expect(prendreLaSuite()).toBe('/voyages/nouveau?destination=bergen');
    expect(prendreLaSuite()).toBeNull();
  });

  it('ne mène jamais hors de l’application', () => {
    // Des adresses qui commencent par une barre, mais qu'un navigateur
    // comprend comme un autre site.
    for (const piege of ['//exemple.com', '/\\exemple.com', 'https://exemple.com', 'javascript:alert(1)', '/ espace']) {
      expect(estUneSuiteSure(piege), piege).toBe(false);
      retenirLaSuite(piege);
      expect(prendreLaSuite(), piege).toBeNull();
    }
    // Et une valeur écrite à la main dans le stockage n'y échappe pas.
    sessionStorage.setItem(
      'tripora.suite-apres-connexion',
      JSON.stringify({ chemin: '//exemple.com', jusqua: Date.now() + 60_000 }),
    );
    expect(prendreLaSuite()).toBeNull();
  });

  it('oublie une connexion abandonnée depuis plus d’une demi-heure', () => {
    retenirLaSuite('/passeport', 0);
    expect(prendreLaSuite(31 * 60 * 1000)).toBeNull();
  });

  it('se laisse oublier, pour qui rejoint un voyage par un code', () => {
    retenirLaSuite('/voyages/nouveau');
    oublierLaSuite();
    expect(prendreLaSuite()).toBeNull();
  });
});
