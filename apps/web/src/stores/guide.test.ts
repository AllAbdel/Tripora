import { beforeEach, describe, expect, it } from 'vitest';
import { CLE_GUIDE_VU, guideDejaVu, useGuide, VERSION_DU_GUIDE } from './guide';

beforeEach(() => {
  localStorage.clear();
  useGuide.setState({ phase: null, decide: false });
});

describe('le guide : l’accueil de Plumio, puis la visite', () => {
  it('s’ouvre par l’accueil, puis passe à la visite', () => {
    useGuide.getState().ouvrir();
    expect(useGuide.getState().phase).toBe('accueil');
    useGuide.getState().commencerLaVisite();
    expect(useGuide.getState().phase).toBe('visite');
    // Pas encore vu : la visite n'est pas finie.
    expect(guideDejaVu()).toBe(false);
  });

  it('est vu une fois passé ou terminé, et le reste après une nouvelle version seulement', () => {
    useGuide.getState().ouvrir();
    useGuide.getState().fermer();
    expect(useGuide.getState().phase).toBeNull();
    expect(localStorage.getItem(CLE_GUIDE_VU)).toBe(String(VERSION_DU_GUIDE));
    expect(guideDejaVu()).toBe(true);
    // Vu dans sa version précédente (le diaporama, la première visite) : on le remontre.
    localStorage.setItem(CLE_GUIDE_VU, String(VERSION_DU_GUIDE - 1));
    expect(guideDejaVu()).toBe(false);
  });
});
