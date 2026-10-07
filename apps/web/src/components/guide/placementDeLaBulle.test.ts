import { describe, expect, it } from 'vitest';
import { estEnVue, LARGEUR_DE_BULLE, MARGE, placerLaBulle, TAILLE_DE_PLUMIO } from './placementDeLaBulle';

const TELEPHONE = { largeur: 390, hauteur: 844 };
const ORDINATEUR = { largeur: 1280, hauteur: 800 };

describe('où poser la bulle de la visite, et Plumio dessus', () => {
  it('au milieu quand il n’y a rien à désigner, Plumio qui explique', () => {
    const placement = placerLaBulle(null, TELEPHONE);
    expect(placement).toMatchObject({ mode: 'centre', largeur: LARGEUR_DE_BULLE.telephone });
    expect(placement.plumio.pose).toBe('explique');
    // Sur un petit téléphone, la marge l'emporte.
    expect(placerLaBulle(null, { largeur: 300, hauteur: 640 }).largeur).toBe(300 - 2 * MARGE);
  });

  it('sous l’élément, à la hauteur de Plumio, qui lève l’aile vers lui', () => {
    // Le bouton « Nouveau », en haut à droite de la liste des voyages.
    const placement = placerLaBulle({ top: 24, left: 264, width: 106, height: 40 }, TELEPHONE);
    if (placement.mode !== 'dessous') throw new Error(placement.mode);
    // Plumio se tient entre les deux : il ne cache jamais l'élément.
    expect(placement.top).toBe(24 + 40 + 58);
    expect(placement.top! - (24 + 40)).toBeGreaterThanOrEqual(TAILLE_DE_PLUMIO.telephone - 6);
    // Collée au bord droit sans déborder, la pointe sous le centre du bouton.
    expect(placement.left + placement.largeur).toBe(TELEPHONE.largeur - MARGE);
    expect(placement.left + placement.pointe).toBe(264 + 53);
    // Plumio juste avant la pointe, sur la bulle.
    expect(placement.plumio).toMatchObject({ pose: 'pointer-haut', taille: 64 });
    expect(placement.plumio.left + placement.plumio.taille).toBe(placement.pointe - 6);
  });

  it('au-dessus quand l’élément est en bas de l’écran, Plumio au coin', () => {
    // « Ajouter une dépense », sous le budget prévu.
    const placement = placerLaBulle({ top: 600, left: 20, width: 350, height: 56 }, TELEPHONE);
    if (placement.mode !== 'dessus') throw new Error(placement.mode);
    expect(placement.bottom).toBe(TELEPHONE.hauteur - 600 + 22);
    expect(placement.plumio.pose).toBe('pointer-bas');
    // Il déborde un peu de la bulle, l'aile vers l'élément.
    expect(placement.plumio.left + placement.plumio.taille).toBe(placement.largeur + 18);
    // Sa place est comptée : la bulle et lui tiennent au-dessus de l'élément.
    expect(placement.maxHauteur).toBe(600 - 22 - MARGE - (64 - 4));
  });

  it('ancrée en bas quand l’élément occupe presque tout l’écran', () => {
    expect(placerLaBulle({ top: 60, left: 0, width: 390, height: 720 }, TELEPHONE).mode).toBe('ancree');
  });

  it('sur un ordinateur, à côté de l’élément, Plumio tourné vers lui', () => {
    const carte = { top: 300, left: 380, width: 400, height: 120 };
    const placement = placerLaBulle(carte, ORDINATEUR);
    if (placement.mode !== 'cote') throw new Error(placement.mode);
    expect(placement.largeur).toBe(LARGEUR_DE_BULLE.ordinateur);
    expect(placement.left).toBe(380 + 400 + 26);
    expect(placement.cote).toBe('gauche');
    expect(placement.plumio).toMatchObject({ pose: 'pointer-gauche', taille: 80, left: 12 });
  });

  it('en arabe, à côté du début de la ligne : la gauche de l’écran', () => {
    const carte = { top: 300, left: 500, width: 400, height: 120 };
    const placement = placerLaBulle(carte, ORDINATEUR, { rtl: true });
    if (placement.mode !== 'cote') throw new Error(placement.mode);
    expect(placement.left + placement.largeur).toBe(500 - 26);
    expect(placement.cote).toBe('droite');
    // Retourné en arabe, il prend la pose « à gauche » pour montrer la droite de l'écran.
    expect(placement.plumio.pose).toBe('pointer-gauche');
    expect(placement.plumio.left).toBe(placement.largeur - 12 - 80);
  });

  it('sur un ordinateur, dessous quand rien ne tient à côté', () => {
    // Le bouton « Nouveau », collé au bord droit.
    const placement = placerLaBulle({ top: 40, left: 1150, width: 110, height: 40 }, ORDINATEUR);
    expect(placement.mode).toBe('dessous');
    if (placement.mode === 'dessous') expect(placement.top).toBe(40 + 40 + 86);
  });

  it('garde la pointe loin des coins arrondis, même pour un élément collé au bord', () => {
    const placement = placerLaBulle({ top: 100, left: 0, width: 12, height: 12 }, TELEPHONE);
    if (placement.mode !== 'dessous') throw new Error(placement.mode);
    expect(placement.left).toBe(MARGE);
    expect(placement.pointe).toBeGreaterThanOrEqual(22);
    // Et Plumio reste sur la bulle.
    expect(placement.plumio.left).toBeGreaterThanOrEqual(0);
  });

  it('sait si un élément est entièrement à l’écran', () => {
    expect(estEnVue({ top: 10, left: 0, width: 10, height: 10 }, TELEPHONE)).toBe(true);
    expect(estEnVue({ top: -5, left: 0, width: 10, height: 10 }, TELEPHONE)).toBe(false);
    expect(estEnVue({ top: 840, left: 0, width: 10, height: 10 }, TELEPHONE)).toBe(false);
  });
});
