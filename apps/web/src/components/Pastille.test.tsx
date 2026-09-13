import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { Pastille, type NomDePastille } from './Pastille';

/**
 * Les teintes viennent de la planche d'icônes, relevées au pixel sur chaque
 * tuile. Les figer ici évite qu'elles dérivent une par une au fil des retouches
 * jusqu'à ce que la grille ne ressemble plus à rien de commun.
 */
const TEINTES: Partial<Record<NomDePastille, string>> = {
  accueil: 'rgb(38, 144, 227)',
  voyages: 'rgb(52, 190, 146)',
  creer: 'rgb(134, 104, 244)',
  carte: 'rgb(253, 170, 78)',
  itineraire: 'rgb(247, 117, 114)',
  participants: 'rgb(92, 107, 242)',
  votes: 'rgb(241, 106, 120)',
  depenses: 'rgb(95, 190, 85)',
  hebergements: 'rgb(141, 94, 233)',
  transport: 'rgb(33, 145, 225)',
  meteo: 'rgb(33, 192, 174)',
  profil: 'rgb(65, 86, 116)',
};

describe('pastilles', () => {
  it('porte la teinte relevée sur la planche', () => {
    for (const [nom, teinte] of Object.entries(TEINTES)) {
      const { container, unmount } = render(<Pastille nom={nom as NomDePastille} />);
      const boite = container.firstElementChild as HTMLElement;
      expect(boite.style.backgroundColor, nom).toBe(teinte);
      unmount();
    }
  });

  it('reste muette pour les lecteurs d’écran', () => {
    // Le nom de la fonction est toujours écrit à côté : répéter la pastille
    // ferait entendre deux fois la même chose.
    const { container } = render(<Pastille nom="carte" />);
    expect(container.firstElementChild?.getAttribute('aria-hidden')).toBe('true');
  });

  it('dessine un pictogramme, jamais un émoji', () => {
    // Un émoji change de forme selon l'appareil, ignore la couleur demandée et
    // ne suit pas la taille : la règle du projet est qu'il n'y en a aucun.
    const { container } = render(<Pastille nom="depenses" />);
    expect(container.querySelector('svg')).not.toBeNull();
    expect(container.textContent).toBe('');
  });

  it('change de gabarit sans changer de couleur', () => {
    const petite = render(<Pastille nom="meteo" taille="sm" />);
    const grande = render(<Pastille nom="meteo" taille="lg" />);
    const teinte = (r: typeof petite) =>
      (r.container.firstElementChild as HTMLElement).style.backgroundColor;
    expect(teinte(petite)).toBe(teinte(grande));
    expect((petite.container.firstElementChild as HTMLElement).className).not.toBe(
      (grande.container.firstElementChild as HTMLElement).className,
    );
  });
});
