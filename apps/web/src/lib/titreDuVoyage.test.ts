import { describe, expect, it } from 'vitest';
import { estUnTitrePropose, titreDuVoyage } from './titreDuVoyage';

describe('le titre d’un voyage', () => {
  it('suit la destination arrêtée quand c’est Tripora qui l’a composé', () => {
    // Le cas vu sur un téléphone : Lisbonne, puis Bordeaux arrêtée.
    expect(titreDuVoyage('Lisbonne à 1', { destinationId: 'bordeaux', participants: 1 })).toBe('Bordeaux à 1');
    expect(estUnTitrePropose('Lisbonne à 1')).toBe(true);
  });

  it('suit aussi la taille du groupe', () => {
    expect(titreDuVoyage('Lisbonne à 1', { destinationId: 'lisbonne', participants: 4 })).toBe('Lisbonne à 4');
    // Sans destination arrêtée, le lieu proposé reste.
    expect(titreDuVoyage('Lisbonne à 2', { destinationId: null, participants: 3 })).toBe('Lisbonne à 3');
  });

  it('ne touche pas à un titre écrit par la personne', () => {
    for (const titre of ['Week-end entre filles', 'EVG de Max', 'Nous à 4', '4 jours en juillet', 'Lisbonne, enfin']) {
      expect(titreDuVoyage(titre, { destinationId: 'bordeaux', participants: 2 })).toBe(titre);
      expect(estUnTitrePropose(titre)).toBe(false);
    }
  });
});
