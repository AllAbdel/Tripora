import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { signaler, vibrationDisponible } from './feedback';

/**
 * On ne teste pas le son : le rendre vérifiable demanderait de simuler toute
 * l'API Web Audio pour constater qu'un oscillateur a bien démarré, ce qui
 * n'apprend rien. Ce qui compte et se vérifie, c'est la règle : qui vibre,
 * quand, et surtout quand on ne fait rien.
 */
describe('retours physiques', () => {
  const vibrer = vi.fn();

  beforeEach(() => {
    vibrer.mockClear();
    Object.defineProperty(navigator, 'vibrate', { value: vibrer, configurable: true });
    // jsdom n'implémente pas matchMedia : sans cette doublure, toute lecture
    // de la préférence de mouvement échouerait.
    vi.stubGlobal(
      'matchMedia',
      vi.fn().mockReturnValue({ matches: false, addEventListener() {}, removeEventListener() {} }),
    );
  });

  afterEach(() => vi.unstubAllGlobals());

  it('ne fait rien en mode silencieux', () => {
    signaler('reussite', 'silencieux');
    expect(vibrer).not.toHaveBeenCalled();
  });

  it('vibre sans jouer de son en mode vibrations', () => {
    signaler('tape', 'vibrations');
    expect(vibrer).toHaveBeenCalledOnce();
  });

  it('donne un motif différent selon ce qui vient de se passer', () => {
    signaler('tape', 'vibrations');
    signaler('echec', 'vibrations');
    const [premier] = vibrer.mock.calls[0] as [number | number[]];
    const [second] = vibrer.mock.calls[1] as [number | number[]];
    expect(premier).not.toEqual(second);
  });

  it('respecte la préférence de mouvement réduit', () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn().mockReturnValue({ matches: true, addEventListener() {}, removeEventListener() {} }),
    );
    signaler('reussite', 'complet');
    expect(vibrer).not.toHaveBeenCalled();
  });

  it('ne jette pas quand l’appareil refuse de vibrer', () => {
    vibrer.mockImplementation(() => {
      throw new Error('geste utilisateur requis');
    });
    expect(() => signaler('tape', 'vibrations')).not.toThrow();
  });

  it('sait dire si l’appareil peut vibrer', () => {
    expect(vibrationDisponible()).toBe(true);
    Object.defineProperty(navigator, 'vibrate', { value: undefined, configurable: true });
    expect(vibrationDisponible()).toBe(false);
  });
});
