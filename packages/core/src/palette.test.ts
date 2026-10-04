import { describe, expect, it } from 'vitest';
import {
  ACCENTS_PROPOSES,
  NUANCES,
  contraste,
  hexVersOklch,
  lireHex,
  oklchVersHex,
  paletteDepuis,
  texteSur,
} from './palette.js';

describe('lecture des couleurs', () => {
  it('accepte les trois écritures courantes', () => {
    expect(lireHex('#fff')).toEqual({ r: 1, g: 1, b: 1 });
    expect(lireHex('#FFFFFF')).toEqual({ r: 1, g: 1, b: 1 });
    expect(lireHex('  0a84ff  ')).not.toBeNull();
  });

  it('refuse ce qui n’est pas une couleur', () => {
    for (const entree of ['', '#12', 'rouge', '#gggggg', '#12345']) {
      expect(lireHex(entree)).toBeNull();
    }
  });
});

describe('aller-retour OKLab', () => {
  it('retrouve la couleur de départ', () => {
    for (const hex of ['#0a84ff', '#1c8c9b', '#e2564a', '#000000', '#ffffff', '#7f7f7f']) {
      const oklch = hexVersOklch(hex);
      expect(oklch).not.toBeNull();
      expect(oklchVersHex(oklch!)).toBe(hex);
    }
  });

  it('donne au gris une intensité nulle', () => {
    expect(hexVersOklch('#808080')!.c).toBeLessThan(0.001);
  });

  it('classe les clartés comme l’œil le fait', () => {
    // En HSL, un jaune vif et un bleu vif sont tous deux « à 50 % » ; en OKLab
    // le jaune est bien plus clair, ce qui est ce qu'on voit.
    const jaune = hexVersOklch('#ffd400')!;
    const bleu = hexVersOklch('#0a3fff')!;
    expect(jaune.l).toBeGreaterThan(bleu.l + 0.3);
  });
});

describe('palette dérivée', () => {
  it('rend dix nuances de plus en plus sombres', () => {
    const palette = paletteDepuis('#0a84ff');
    expect(palette).not.toBeNull();
    const clartes = NUANCES.map((n) => hexVersOklch(palette![n])!.l);
    for (let i = 1; i < clartes.length; i += 1) {
      expect(clartes[i]!).toBeLessThan(clartes[i - 1]!);
    }
  });

  it('reste proche du bleu d’origine, dont la courbe est tirée', () => {
    const palette = paletteDepuis('#0a84ff')!;
    // La nuance 500 doit ressembler à la couleur demandée sans la copier au
    // pixel : elle est assombrie juste assez pour porter du texte blanc.
    expect(contraste(palette[500], '#0a84ff')).toBeLessThan(1.3);
    expect(hexVersOklch(palette[500])!.l).toBeLessThan(hexVersOklch('#0a84ff')!.l);
  });

  it('garde la teinte demandée sur toute la palette', () => {
    const palette = paletteDepuis('#c2418f')!;
    // La nuance 50 est si claire que sa teinte n'a plus de sens perceptif :
    // on ne la met pas à l'épreuve d'une tolérance de deux degrés.
    const teintes = NUANCES.filter((n) => n !== 50).map((n) => hexVersOklch(palette[n])!.h);
    for (const teinte of teintes) {
      expect(Math.abs(teinte - hexVersOklch('#c2418f')!.h)).toBeLessThan(2);
    }
  });

  it('transforme une couleur sans teinte en échelle de gris utilisable', () => {
    const palette = paletteDepuis('#767676')!;
    expect(contraste(palette[50], palette[900])).toBeGreaterThan(7);
  });

  it('refuse une couleur illisible plutôt que d’en inventer une', () => {
    expect(paletteDepuis('pas une couleur')).toBeNull();
  });
});

describe('lisibilité', () => {
  it('porte du texte blanc lisible, quelle que soit la couleur demandée', () => {
    // Y compris des couleurs que personne ne devrait choisir : c'est là que la
    // règle compte. Un bouton doit rester lisible même si son fond est un jaune
    // fluo — la palette l'assombrit jusqu'à ce qu'il le soit.
    for (const couleur of [
      ...ACCENTS_PROPOSES.map((a) => a.couleur),
      '#ffff00',
      '#00ff00',
      '#ffffff',
      '#000000',
      '#ff00ff',
    ]) {
      const fond = paletteDepuis(couleur)![500];
      expect(texteSur(fond)).toBe('#ffffff');
      expect(contraste(fond, '#ffffff')).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('garde les fonds clairs lisibles sous leur texte foncé', () => {
    // Les nuances 50 et 100 servent de fond aux pastilles, avec du 700 dessus.
    for (const { couleur } of ACCENTS_PROPOSES) {
      const palette = paletteDepuis(couleur)!;
      expect(contraste(palette[50], palette[700])).toBeGreaterThanOrEqual(4.5);
      expect(contraste(palette[100], palette[700])).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('met du noir sur un fond clair reçu d’ailleurs', () => {
    // Cette branche ne sert plus aux couleurs de la palette, qui sont toutes
    // assez sombres — mais bien à une couleur quelconque, d'où qu'elle vienne.
    expect(texteSur('#ffd400')).toBe('#0b1220');
    expect(texteSur('#0a3fff')).toBe('#ffffff');
  });
});
