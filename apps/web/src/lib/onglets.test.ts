import { describe, expect, it } from 'vitest';
import { ongletActif, sectionsDuVoyage, voyageDeLAdresse } from './onglets';

/**
 * L'onglet actif de la barre de navigation.
 *
 * `/carte` et `/budget` se prolongent à l'intérieur d'un voyage précis
 * (`/voyages/v1/carte`) pour retomber sur le seul voyage qui existe. Avant ce
 * correctif, cette adresse commence par `/voyages/`, et la barre gardait
 * « Voyages » allumé quoi qu'on ouvre : taper sur Carte ou sur Budget ne
 * déplaçait jamais le surlignage.
 */
describe('onglet actif de la barre de navigation', () => {
  it('Carte reste actif une fois prolongé dans un voyage précis', () => {
    expect(ongletActif('/carte', '/voyages/v1/carte')).toBe(true);
    expect(ongletActif('/voyages', '/voyages/v1/carte')).toBe(false);
  });

  it('Budget reste actif une fois prolongé dans un voyage précis', () => {
    expect(ongletActif('/budget', '/voyages/v1/budget')).toBe(true);
    expect(ongletActif('/voyages', '/voyages/v1/budget')).toBe(false);
  });

  it('Voyages reste actif sur les autres écrans d’un voyage', () => {
    expect(ongletActif('/voyages', '/voyages/v1')).toBe(true);
    expect(ongletActif('/voyages', '/voyages/v1/itineraire')).toBe(true);
    expect(ongletActif('/voyages', '/voyages/nouveau')).toBe(true);
    expect(ongletActif('/carte', '/voyages/v1/itineraire')).toBe(false);
    expect(ongletActif('/budget', '/voyages/v1/itineraire')).toBe(false);
  });

  it('reconnaît l’adresse nue de chaque onglet', () => {
    expect(ongletActif('/voyages', '/voyages')).toBe(true);
    expect(ongletActif('/carte', '/carte')).toBe(true);
    expect(ongletActif('/budget', '/budget')).toBe(true);
    expect(ongletActif('/profil', '/profil')).toBe(true);
  });

  it('ne mélange pas les onglets entre eux', () => {
    expect(ongletActif('/carte', '/budget')).toBe(false);
    expect(ongletActif('/budget', '/carte')).toBe(false);
    expect(ongletActif('/profil', '/voyages/v1')).toBe(false);
  });
});

describe('le voyage ouvert, pour la barre latérale', () => {
  it('se lit sur toutes les adresses d’un voyage', () => {
    expect(voyageDeLAdresse('/voyages/v1')).toBe('v1');
    expect(voyageDeLAdresse('/voyages/v1/itineraire')).toBe('v1');
    expect(voyageDeLAdresse('/voyages/a%20b/carte')).toBe('a b');
  });

  it('ne prend pas l’assistant de création, ni les autres écrans, pour un voyage', () => {
    expect(voyageDeLAdresse('/voyages/nouveau')).toBeNull();
    expect(voyageDeLAdresse('/voyages')).toBeNull();
    expect(voyageDeLAdresse('/carte')).toBeNull();
  });

  it('ne propose ce qui suppose une destination qu’une fois celle-ci arrêtée', () => {
    const avant = sectionsDuVoyage('v1', false).map((section) => section.titre);
    const apres = sectionsDuVoyage('v1', true).map((section) => section.titre);
    expect(avant).not.toContain('Itinéraire');
    expect(avant).not.toContain('Ma valise');
    expect(apres).toContain('Itinéraire');
    expect(apres[0]).toBe('Aperçu');
    expect(sectionsDuVoyage('v1', true)[0]?.to).toBe('/voyages/v1');
  });
});
