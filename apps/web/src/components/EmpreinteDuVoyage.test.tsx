import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { findDestination } from '@tripora/core';
import { EmpreinteDuVoyage } from './EmpreinteDuVoyage';

describe('l’empreinte du trajet', () => {
  it('compare les modes, du plus sobre au plus lourd, et dit ce que l’avion pèse', () => {
    const barcelone = findDestination('barcelone')!;
    render(
      <EmpreinteDuVoyage
        depart={{ name: 'Paris', lat: 48.8566, lng: 2.3522, country: 'France' }}
        destination={barcelone}
        participants={4}
      />,
    );
    const lignes = screen.getAllByRole('listitem').map((ligne) => ligne.textContent ?? '');
    expect(lignes[lignes.length - 1]).toMatch(/^Avion/);
    expect(screen.getByText(/plutôt qu’en avion/)).toBeInTheDocument();
    expect(screen.getByText(/des 2 tonnes par an/)).toBeInTheDocument();
    // Hors de France : la moyenne européenne, pas le TGV.
    expect(screen.getByText('Moyenne du rail européen (AEE)')).toBeInTheDocument();
  });
});
