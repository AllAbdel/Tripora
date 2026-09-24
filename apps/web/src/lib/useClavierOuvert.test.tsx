import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ouvreLeClavier, useClavierOuvert } from './useClavierOuvert';

function champ(html: string): Element {
  const hote = document.createElement('div');
  hote.innerHTML = html;
  return hote.firstElementChild!;
}

describe('les champs qui ouvrent le clavier', () => {
  it('du texte, oui', () => {
    expect(ouvreLeClavier(champ('<input type="text">'))).toBe(true);
    expect(ouvreLeClavier(champ('<input type="number">'))).toBe(true);
    expect(ouvreLeClavier(champ('<textarea></textarea>'))).toBe(true);
  });

  it('une case, une date ou un champ en lecture seule, non', () => {
    expect(ouvreLeClavier(champ('<input type="checkbox">'))).toBe(false);
    expect(ouvreLeClavier(champ('<input type="date">'))).toBe(false);
    expect(ouvreLeClavier(champ('<input type="text" readonly>'))).toBe(false);
    expect(ouvreLeClavier(champ('<button>Envoyer</button>'))).toBe(false);
    expect(ouvreLeClavier(null)).toBe(false);
  });
});

function Temoin() {
  return <p>{useClavierOuvert() ? 'clavier' : 'onglets'}</p>;
}

describe('le clavier ouvert', () => {
  afterEach(() => vi.unstubAllGlobals());

  function ecranTactile(tactile: boolean) {
    vi.stubGlobal('matchMedia', (requete: string) => ({
      matches: requete === '(pointer: coarse)' ? tactile : false,
      addEventListener: () => {},
      removeEventListener: () => {},
    }));
  }

  it('suit le focus d’un champ de texte sur un écran tactile', () => {
    ecranTactile(true);
    render(
      <>
        <Temoin />
        <input aria-label="Nom" />
      </>,
    );
    expect(screen.getByText('onglets')).toBeInTheDocument();
    act(() => screen.getByLabelText('Nom').focus());
    expect(screen.getByText('clavier')).toBeInTheDocument();
  });

  it('ne change rien à la souris', () => {
    ecranTactile(false);
    render(
      <>
        <Temoin />
        <input aria-label="Nom" />
      </>,
    );
    act(() => screen.getByLabelText('Nom').focus());
    expect(screen.getByText('onglets')).toBeInTheDocument();
  });
});
