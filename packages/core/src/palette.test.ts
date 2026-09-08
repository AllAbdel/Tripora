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
    // La nuance 500 doit ressembler à la couleur demandée, pas la copier au
    // pixel : elle est replacée sur la courbe commune.
    expect(contraste(palette[500], '#0a84ff')).toBeLessThan(1.35);
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
  it('choisit un texte qui passe le seuil AA sur chaque couleur proposée', () => {
    for (const { couleur } of ACCENTS_PROPOSES) {
      const palette = paletteDepuis(couleur)!;
      const fond = palette[500];
      // 4,5 est le seuil AA du texte courant ; on le vérifie sur la nuance qui
      // sert de fond aux boutons principaux.
      expect(contraste(fond, texteSur(fond))).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('met du noir sur un jaune vif, pas du blanc', () => {
    expect(texteSur('#ffd400')).toBe('#0b1220');
    expect(texteSur('#0a3fff')).toBe('#ffffff');
  });
});
