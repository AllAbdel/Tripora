import { beforeEach, describe, expect, it } from 'vitest';
import {
  CLE_GUIDE_VU,
  CLE_REPRISE_DE_LA_VISITE,
  guideDejaVu,
  lireLaReprise,
  retenirLaReprise,
  useGuide,
} from './guide';

beforeEach(() => {
  localStorage.clear();
  useGuide.setState({ ouvert: false, decide: false, depart: {} });
});

describe('le souvenir de la visite guidée', () => {
  it('reprend une visite interrompue dans la journée, pas au-delà', () => {
    const le = Date.UTC(2026, 9, 7, 9);
    retenirLaReprise({ etat: 'en-cours', arret: 'coffre', voyageId: 'v1', le });
    expect(lireLaReprise(le + 60 * 60 * 1000)).toEqual({ etat: 'en-cours', arret: 'coffre', voyageId: 'v1', le });
    expect(lireLaReprise(le + 25 * 60 * 60 * 1000)).toBeNull();
    // Périmée, elle est effacée.
    expect(localStorage.getItem(CLE_REPRISE_DE_LA_VISITE)).toBeNull();
  });

  it('attend un premier voyage pendant une semaine', () => {
    const le = Date.UTC(2026, 9, 7, 9);
    retenirLaReprise({ etat: 'attend-un-voyage', le });
    expect(lireLaReprise(le + 6 * 24 * 60 * 60 * 1000)?.etat).toBe('attend-un-voyage');
    expect(lireLaReprise(le + 8 * 24 * 60 * 60 * 1000)).toBeNull();
  });

  it('ignore un souvenir illisible', () => {
    localStorage.setItem(CLE_REPRISE_DE_LA_VISITE, '{pas du json');
    expect(lireLaReprise()).toBeNull();
  });

  it('mettre la visite en attente compte comme vue : elle ne s’imposera plus', () => {
    useGuide.getState().reprendre({ voyageId: 'v1' });
    useGuide.getState().attendreUnVoyage();
    expect(useGuide.getState().ouvert).toBe(false);
    expect(guideDejaVu()).toBe(true);
    expect(lireLaReprise()?.etat).toBe('attend-un-voyage');
  });

  it('« Revoir le guide » repart du début, et le fermer oublie où on en était', () => {
    retenirLaReprise({ etat: 'en-cours', arret: 'coffre', voyageId: 'v1', le: Date.now() });
    useGuide.getState().ouvrir();
    expect(useGuide.getState().depart).toEqual({});
    expect(lireLaReprise()).toBeNull();

    retenirLaReprise({ etat: 'en-cours', arret: 'depenses', voyageId: 'v1', le: Date.now() });
    useGuide.getState().fermer();
    expect(lireLaReprise()).toBeNull();
    expect(localStorage.getItem(CLE_GUIDE_VU)).toBe('2');
  });

  it('remontre le guide une fois à qui n’a vu que l’ancien diaporama', () => {
    localStorage.setItem(CLE_GUIDE_VU, '1');
    expect(guideDejaVu()).toBe(false);
  });
});
