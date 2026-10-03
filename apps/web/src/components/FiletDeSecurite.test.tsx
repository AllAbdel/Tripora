import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { FiletDeSecurite } from './FiletDeSecurite';

function Casse(): never {
  throw new Error('Écran cassé');
}

describe('le filet de sécurité', () => {
  it('remplace un écran qui plante par une sortie, au lieu d’une page blanche', () => {
    // React journalise l'erreur rattrapée : on la tait pour garder la sortie lisible.
    const console_ = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    render(
      <FiletDeSecurite>
        <Casse />
      </FiletDeSecurite>,
    );
    expect(screen.getByRole('heading', { name: 'Cet écran a rencontré un problème' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Recharger' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Revenir à mes voyages' })).toBeInTheDocument();
    console_.mockRestore();
  });

  it('laisse passer un écran qui marche', () => {
    render(
      <FiletDeSecurite>
        <p>Tout va bien</p>
      </FiletDeSecurite>,
    );
    expect(screen.getByText('Tout va bien')).toBeInTheDocument();
  });
});
