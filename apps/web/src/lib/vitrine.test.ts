import { describe, expect, it } from 'vitest';
import { findDestination } from '@tripora/core';
import { activitesDe } from '@tripora/core/activites';
import { destinationsDuMois, niveauDePrix, VITRINE } from './vitrine';

describe('la vitrine de l’accueil', () => {
  it('ne cite que des destinations qui ont une page publique fournie', () => {
    // Sur le site, chaque carte mène à /destinations/<id> : une page qui
    // n'existe pas serait une 404 sur la page d'accueil.
    for (const id of VITRINE) {
      expect(findDestination(id), id).toBeDefined();
      expect(activitesDe(id).length, id).toBeGreaterThanOrEqual(3);
    }
  });

  it('a de quoi remplir chaque mois de l’année, sans deux fois le même pays', () => {
    for (let mois = 1; mois <= 12; mois += 1) {
      const choisies = destinationsDuMois(mois);
      expect(choisies.length, `mois ${mois}`).toBe(6);
      expect(new Set(choisies.map((d) => d.countryCode)).size, `mois ${mois}`).toBe(6);
      for (const destination of choisies) {
        expect(destination.bestMonths, destination.id).toContain(mois);
      }
    }
  });

  it('résume le budget sur place en trois niveaux', () => {
    expect(niveauDePrix({ costIndex: 0.4 })).toBe('€');
    expect(niveauDePrix({ costIndex: 1 })).toBe('€€');
    expect(niveauDePrix({ costIndex: 1.6 })).toBe('€€€');
  });
});
