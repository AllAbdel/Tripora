import { describe, expect, it, afterEach } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { useEnLigne } from './useEnLigne';

function Temoin() {
  return <p>{useEnLigne() ? 'en ligne' : 'hors ligne'}</p>;
}

/** Remplace `navigator.onLine`, en lecture seule par défaut. */
function simuler(enLigne: boolean) {
  Object.defineProperty(navigator, 'onLine', { value: enLigne, configurable: true });
  act(() => {
    window.dispatchEvent(new Event(enLigne ? 'online' : 'offline'));
  });
}

afterEach(() => simuler(true));

describe('détection du réseau', () => {
  it('suit les bascules dans les deux sens', () => {
    render(<Temoin />);
    expect(screen.getByText('en ligne')).toBeInTheDocument();

    simuler(false);
    expect(screen.getByText('hors ligne')).toBeInTheDocument();

    simuler(true);
    expect(screen.getByText('en ligne')).toBeInTheDocument();
  });

  it('lit l’état réel dès le premier rendu, sans attendre un événement', () => {
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });
    render(<Temoin />);
    expect(screen.getByText('hors ligne')).toBeInTheDocument();
  });
});
