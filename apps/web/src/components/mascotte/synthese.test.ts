import { describe, expect, it } from 'vitest';
import { programmerLaPartition } from './synthese';
import type { Son } from './partitions';

/**
 * Un faux contexte audio : il n'émet rien, il note quand chaque source part.
 * Assez pour vérifier que chaque son se fabrique sans erreur, à l'heure dite,
 * et que les notes déjà passées sont sautées.
 */
function fauxContexte(maintenant = 0) {
  const departs: number[] = [];
  const parametre = () => ({ value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {} });
  const noeud = <T extends object>(proprietes: T) => ({
    ...proprietes,
    connect<U>(cible: U): U {
      return cible;
    },
  });
  const audio = {
    currentTime: maintenant,
    sampleRate: 8000,
    createBuffer: (_canaux: number, longueur: number, taux: number) => ({
      duration: longueur / taux,
      getChannelData: () => new Float32Array(longueur),
    }),
    createBufferSource: () =>
      noeud({ buffer: null as unknown, start: (quand: number) => departs.push(quand) }),
    createBiquadFilter: () => noeud({ type: '', frequency: parametre(), Q: parametre() }),
    createGain: () => noeud({ gain: parametre() }),
    createOscillator: () =>
      noeud({ type: '', frequency: parametre(), start: (quand: number) => departs.push(quand), stop() {} }),
  };
  return { audio: audio as unknown as BaseAudioContext, departs };
}

const SONS: Son[] = ['apparition', 'repere', 'validation', 'depart', 'signal', 'erreur'];

describe('la synthèse des sons', () => {
  it.each(SONS)('fabrique « %s » sans erreur, à l’heure dite', (son) => {
    const { audio, departs } = fauxContexte();
    const sortie = {} as AudioNode;
    expect(programmerLaPartition(audio, sortie, [{ temps: 250, son }], 2)).toBe(1);
    expect(departs.length).toBeGreaterThan(0);
    // Tout part au moment de la note (un accord égrène ses notes juste après).
    for (const depart of departs) {
      expect(depart).toBeGreaterThanOrEqual(2.25);
      expect(depart).toBeLessThan(2.5);
    }
  });

  it('saute les notes déjà passées : un son en retard sur son geste sonnerait faux', () => {
    const { audio } = fauxContexte(1.2);
    const partition = [
      { temps: 0, son: 'repere' as const },
      { temps: 100, son: 'repere' as const },
      { temps: 400, son: 'apparition' as const },
    ];
    expect(programmerLaPartition(audio, {} as AudioNode, partition, 1.05)).toBe(1);
  });
});
