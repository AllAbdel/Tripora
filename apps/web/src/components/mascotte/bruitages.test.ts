import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const programmer = vi.hoisted(() => vi.fn());
vi.mock('./synthese', () => ({ programmerLaPartition: programmer }));

/** Un contexte audio réduit à ce que `bruiter` touche lui-même. */
class FauxContexte {
  static dernier: FauxContexte | null = null;
  state: AudioContextState = 'running';
  currentTime = 3;
  destination = {};
  pistes: { gain: { value: number; setTargetAtTime: ReturnType<typeof vi.fn> }; disconnect: ReturnType<typeof vi.fn> }[] = [];
  resume = vi.fn(() => Promise.resolve());
  constructor() {
    FauxContexte.dernier = this;
  }
  createGain() {
    const piste = { gain: { value: 1, setTargetAtTime: vi.fn() }, connect: vi.fn(), disconnect: vi.fn() };
    this.pistes.push(piste);
    return piste;
  }
}

function activation(active: boolean) {
  Object.defineProperty(navigator, 'userActivation', { value: { hasBeenActive: active }, configurable: true });
}

/**
 * Des modules neufs à chaque test : le contexte audio est gardé d'un appel à
 * l'autre, et le réglage vit dans le store. On reprend donc les deux avec.
 */
async function chargerBruitages() {
  vi.resetModules();
  const bruitages = await import('./bruitages');
  const { useTheme } = await import('@/stores/theme');
  const { PARTITIONS } = await import('./partitions');
  useTheme.setState({ bruitagesPlumio: true, retours: 'vibrations' });
  return { ...bruitages, useTheme, PARTITIONS };
}

beforeEach(() => {
  vi.stubGlobal('AudioContext', FauxContexte);
  FauxContexte.dernier = null;
  programmer.mockReset();
  activation(true);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('les bruitages de Plumio', () => {
  it('jouent la partition du geste, calée sur son début', async () => {
    const { bruiter, PARTITIONS } = await chargerBruitages();
    bruiter('picore');
    expect(programmer).toHaveBeenCalledTimes(1);
    const [, piste, partition, zero] = programmer.mock.calls[0]!;
    expect(partition).toBe(PARTITIONS.picore);
    expect(piste.gain.value).toBeLessThanOrEqual(0.5);
    expect(zero).toBeCloseTo(3, 1);
  });

  it('se taisent quand on les a coupés, ou que les retours sont sur « Rien »', async () => {
    const { bruiter, bruitagesPermis, useTheme } = await chargerBruitages();
    useTheme.setState({ bruitagesPlumio: false });
    expect(bruitagesPermis()).toBe(false);
    useTheme.setState({ bruitagesPlumio: true, retours: 'silencieux' });
    expect(bruitagesPermis()).toBe(false);
    bruiter('salue');
    expect(programmer).not.toHaveBeenCalled();
  });

  it('attendent que la personne ait touché la page : le navigateur refuserait', async () => {
    const { bruiter } = await chargerBruitages();
    activation(false);
    bruiter('arrive');
    expect(programmer).not.toHaveBeenCalled();
    expect(FauxContexte.dernier).toBeNull();
  });

  it('se taisent quand on a demandé moins de mouvement : le son accompagne le geste', async () => {
    const { bruitagesPermis } = await chargerBruitages();
    vi.stubGlobal('matchMedia', (requete: string) => ({ matches: requete.includes('reduced-motion') }));
    expect(bruitagesPermis()).toBe(false);
  });

  it('ne partent pas en retard : un contexte qui démarre trop tard, on renonce', async () => {
    vi.useFakeTimers({ toFake: ['performance'] });
    const { bruiter } = await chargerBruitages();
    let demarrer: () => void = () => undefined;
    class ContexteLent extends FauxContexte {
      override state: AudioContextState = 'suspended';
      override resume = vi.fn(() => new Promise<void>((resoudre) => (demarrer = resoudre)));
    }
    vi.stubGlobal('AudioContext', ContexteLent);
    bruiter('parle');
    vi.advanceTimersByTime(500);
    demarrer();
    await Promise.resolve();
    await Promise.resolve();
    expect(programmer).not.toHaveBeenCalled();
  });

  it('s’arrêtent avec le geste interrompu, en fondu', async () => {
    vi.useFakeTimers();
    const { bruiter } = await chargerBruitages();
    const couper = bruiter('salue');
    const piste = FauxContexte.dernier!.pistes[0]!;
    couper();
    expect(piste.gain.setTargetAtTime).toHaveBeenCalledWith(0, 3, expect.any(Number));
    vi.advanceTimersByTime(200);
    expect(piste.disconnect).toHaveBeenCalled();
  });

  it('préparent le son au premier appui (Safari), une fois, et seulement s’ils sont actifs', async () => {
    const { preparerAuPremierGeste } = await chargerBruitages();
    preparerAuPremierGeste();
    preparerAuPremierGeste();
    expect(FauxContexte.dernier).toBeNull();
    window.dispatchEvent(new Event('pointerdown'));
    const premier = FauxContexte.dernier;
    expect(premier).not.toBeNull();
    window.dispatchEvent(new Event('pointerdown'));
    expect(FauxContexte.dernier).toBe(premier);
  });

  it('ne préparent rien quand on les a coupés', async () => {
    const { preparerAuPremierGeste, useTheme } = await chargerBruitages();
    useTheme.setState({ bruitagesPlumio: false });
    preparerAuPremierGeste();
    window.dispatchEvent(new Event('keydown'));
    expect(FauxContexte.dernier).toBeNull();
  });

  it('ne font rien pour un moment sans partition', async () => {
    const { bruiter } = await chargerBruitages();
    expect(() => bruiter('joue:attend')()).not.toThrow();
    expect(programmer).not.toHaveBeenCalled();
  });
});
