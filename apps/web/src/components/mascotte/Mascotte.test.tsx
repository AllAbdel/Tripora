import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import { Mascotte } from './Mascotte';
import { chargerLaPose } from './poses';

const couper = vi.hoisted(() => vi.fn());
const bruiter = vi.hoisted(() => vi.fn(() => couper));
vi.mock('./bruitages', () => ({ bruiter, preparerAuPremierGeste: () => undefined }));

/**
 * Chaque geste joué part avec ses bruitages, et les emporte s'il est
 * interrompu : un nouveau geste, une fenêtre qui se ferme.
 */
// Les dessins se chargent à la demande ; déjà chargés, ils s'affichent aussitôt.
beforeAll(async () => {
  await Promise.all((['face', 'oups', 'celebre', 'attend'] as const).map(chargerLaPose));
});

beforeEach(() => {
  bruiter.mockClear();
  couper.mockClear();
});

afterEach(() => vi.useRealTimers());

describe('les bruitages suivent les gestes de Plumio', () => {
  it('un geste piloté fait entendre sa partition ; le suivant coupe le précédent', () => {
    const { rerender } = render(<Mascotte pose="face" taille={100} geste="arrive" fois={1} />);
    expect(bruiter).toHaveBeenLastCalledWith('arrive');
    rerender(<Mascotte pose="face" taille={100} geste="salue" fois={2} />);
    expect(couper).toHaveBeenCalledTimes(1);
    expect(bruiter).toHaveBeenLastCalledWith('salue');
  });

  it('le geste propre d’une pose, à son apparition', () => {
    render(<Mascotte pose="oups" taille={120} joue />);
    expect(bruiter).toHaveBeenCalledWith('joue:oups');
  });

  it('après un atterrissage, le geste de la pose attend qu’il soit posé', () => {
    vi.useFakeTimers();
    render(<Mascotte pose="celebre" taille={96} arrivee joue />);
    expect(bruiter).toHaveBeenCalledWith('atterrit');
    expect(bruiter).not.toHaveBeenCalledWith('joue:celebre');
    vi.advanceTimersByTime(400);
    expect(bruiter).toHaveBeenCalledWith('joue:celebre');
  });

  it('l’envol, et rien au repos', () => {
    const { rerender } = render(<Mascotte pose="attend" taille={44} vie="calme" />);
    expect(bruiter).not.toHaveBeenCalled();
    rerender(<Mascotte pose="attend" taille={44} vie="calme" sortie />);
    expect(bruiter).toHaveBeenCalledWith('sort');
  });

  it('une fenêtre qui se ferme emporte le son en cours', () => {
    const { unmount } = render(<Mascotte pose="face" taille={100} geste="parle" fois={1} />);
    unmount();
    expect(couper).toHaveBeenCalled();
  });

  it('une pose pas encore chargée arrive un instant plus tard, à la place réservée', async () => {
    const { container, findByText } = render(<Mascotte pose="vol" taille={80} />);
    const boite = container.firstElementChild as HTMLElement;
    expect(boite.style.width).toBe('80px');
    await vi.waitFor(() => expect(boite.querySelector('svg')).not.toBeNull());
    void findByText;
  });
});
