import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CarteFantome, ListeFantome } from './Squelette';

/**
 * Une silhouette de chargement est vue, jamais lue. Ce qui se teste n'est donc
 * pas son dessin mais son silence : elle doit annoncer l'attente une fois, et
 * ne rien dire de plus — sinon un lecteur d'écran énumère des blocs vides.
 */
describe('silhouettes de chargement', () => {
  it('annonce l’attente une seule fois', () => {
    render(<ListeFantome combien={3} />);
    const zone = screen.getByLabelText('Chargement');
    expect(zone).toHaveAttribute('aria-busy', 'true');
    // Les formes elles-mêmes sont muettes : rien d'autre ne porte de nom.
    expect(screen.queryAllByRole('img')).toHaveLength(0);
    expect(screen.queryAllByRole('status')).toHaveLength(0);
  });

  it('pose autant de silhouettes que demandé', () => {
    const { container } = render(<ListeFantome combien={4} />);
    expect(container.querySelectorAll('[aria-busy] > *')).toHaveLength(4);
  });

  it('donne à chaque silhouette la forme d’une vraie carte', () => {
    // Une pastille, un titre, un sous-titre, une note, puis les lignes de
    // texte : c'est la structure d'une carte de destination. Une silhouette qui
    // ne ressemble pas au contenu qui arrive fait sauter l'écran à l'arrivée,
    // ce qu'elle était censée éviter.
    const { container } = render(<CarteFantome lignes={2} />);
    // Pastille, titre, sous-titre, note, puis les deux lignes de texte.
    expect(container.querySelectorAll('.squelette')).toHaveLength(6);
  });
});
