import { describe, expect, it } from 'vitest';
import { estEnVue, LARGEUR_MAX, MARGE, placerLaBulle } from './placementDeLaBulle';

const TELEPHONE = { largeur: 390, hauteur: 844 };
const ORDINATEUR = { largeur: 1280, hauteur: 800 };

describe('où poser la bulle de la visite', () => {
  it('au milieu quand il n’y a rien à désigner', () => {
    expect(placerLaBulle(null, TELEPHONE)).toEqual({ mode: 'centre', largeur: LARGEUR_MAX });
    // Sur un petit téléphone, la marge l'emporte.
    expect(placerLaBulle(null, { largeur: 320, hauteur: 640 })).toEqual({ mode: 'centre', largeur: 320 - 2 * MARGE });
  });

  it('sous l’élément quand la place le permet, la pointe en face de lui', () => {
    // Le bouton « Nouveau », en haut à droite de la liste des voyages.
    const placement = placerLaBulle({ top: 24, left: 264, width: 106, height: 40 }, TELEPHONE);
    expect(placement.mode).toBe('dessous');
    if (placement.mode !== 'dessous') return;
    expect(placement.top).toBe(24 + 40 + 14);
    // Collée au bord droit sans déborder…
    expect(placement.left + placement.largeur).toBe(TELEPHONE.largeur - MARGE);
    // … et la pointe sous le centre du bouton.
    expect(placement.left + placement.pointe).toBe(264 + 53);
    expect(placement.geste).toBe('haut');
  });

  it('au-dessus quand l’élément est en bas de l’écran', () => {
    // « Ajouter une dépense », sous le budget prévu.
    const placement = placerLaBulle({ top: 600, left: 20, width: 350, height: 56 }, TELEPHONE);
    expect(placement.mode).toBe('dessus');
    if (placement.mode !== 'dessus') return;
    expect(placement.bottom).toBe(TELEPHONE.hauteur - 600 + 14);
    expect(placement.geste).toBe('bas');
    expect(placement.maxHauteur).toBe(600 - 14 - MARGE);
  });

  it('ancrée en bas quand l’élément occupe presque tout l’écran', () => {
    const placement = placerLaBulle({ top: 60, left: 0, width: 390, height: 720 }, TELEPHONE);
    expect(placement.mode).toBe('ancree');
  });

  it('ne dépasse pas sa largeur sur un grand écran, et reste centrée sur l’élément', () => {
    const placement = placerLaBulle({ top: 370, left: 376, width: 784, height: 52 }, ORDINATEUR);
    expect(placement.largeur).toBe(LARGEUR_MAX);
    if (placement.mode !== 'dessous' && placement.mode !== 'dessus') throw new Error(placement.mode);
    expect(placement.left + placement.largeur / 2).toBe(376 + 784 / 2);
  });

  it('garde la pointe loin des coins arrondis, même pour un élément collé au bord', () => {
    const placement = placerLaBulle({ top: 100, left: 0, width: 12, height: 12 }, TELEPHONE);
    if (placement.mode !== 'dessous') throw new Error(placement.mode);
    expect(placement.left).toBe(MARGE);
    expect(placement.pointe).toBeGreaterThanOrEqual(22);
  });

  it('sait si un élément est entièrement à l’écran', () => {
    expect(estEnVue({ top: 10, left: 0, width: 10, height: 10 }, TELEPHONE)).toBe(true);
    expect(estEnVue({ top: -5, left: 0, width: 10, height: 10 }, TELEPHONE)).toBe(false);
    expect(estEnVue({ top: 840, left: 0, width: 10, height: 10 }, TELEPHONE)).toBe(false);
  });
});
