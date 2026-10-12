import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { PARTITIONS, type MomentDePlumio } from './partitions';

/**
 * Les partitions suivent la feuille d'animation : un son qui tombe après la
 * fin de son geste, ou à côté du coup d'aile qu'il accompagne, sonne faux.
 * Les durées sont lues dans `animations.css` elle-même, pour qu'un geste
 * raccourci là-bas fasse échouer ce test plutôt que de déborder sans bruit.
 */
const FEUILLE = readFileSync(join(process.cwd(), '../../design/mascotte/animations.css'), 'utf8');

/** La plus longue animation posée par une classe `.plumio--<nom>`, en millisecondes. */
function dureeDans(classe: string): number {
  const regles = [...FEUILLE.matchAll(new RegExp(`\\.plumio--${classe}\\b[^{]*\\{([^}]*)\\}`, 'gu'))];
  const durees = regles.flatMap(([, corps]) =>
    [...corps!.matchAll(/(\d+)ms(?:\s+[a-z-]+(?:\([^)]*\))?)?(?:\s+(\d+)ms)?/gu)].map(
      ([, duree, delai]) => Number(duree) + Number(delai ?? 0),
    ),
  );
  return Math.max(...durees);
}

const GESTES: [MomentDePlumio, string][] = [
  ['arrive', 'arrive'],
  ['salue', 'salue'],
  ['parle', 'parle'],
  ['se-tourne', 'se-tourne'],
  ['tapote', 'tapote'],
  ['picore', 'picore'],
  ['sautille', 'sautille'],
  ['content', 'content'],
  ['atterrit', 'atterrit'],
  ['sort', 'sort'],
];

describe('les partitions de Plumio', () => {
  it.each(GESTES)('%s a sa partition, et elle tient dans la durée du geste', (moment, classe) => {
    const partition = PARTITIONS[moment];
    expect(partition?.length).toBeGreaterThan(0);
    const duree = dureeDans(classe);
    expect(duree).toBeGreaterThan(300);
    for (const note of partition!) {
      expect(note.temps, `${moment} : ${note.son} à ${note.temps} ms`).toBeGreaterThanOrEqual(0);
      expect(note.temps, `${moment} : ${note.son} à ${note.temps} ms, pour ${duree} ms`).toBeLessThan(duree);
    }
  });

  it('les trois coups de bec tombent sur les trois frappes de la tête (14, 44 et 74 %)', () => {
    const duree = dureeDans('picore');
    const becs = PARTITIONS.picore!.filter((note) => note.son === 'bec').map((note) => note.temps / duree);
    expect(becs).toHaveLength(3);
    [0.14, 0.44, 0.74].forEach((frappe, rang) => expect(Math.abs(becs[rang]! - frappe)).toBeLessThan(0.03));
  });

  it('il bat des ailes en descendant, et se pose quand il touche le sol (66 %)', () => {
    const arrivee = PARTITIONS.arrive!;
    const pose = arrivee.find((note) => note.son === 'atterrit')!;
    expect(Math.abs(pose.temps / dureeDans('arrive') - 0.66)).toBeLessThan(0.03);
    expect(arrivee.filter((note) => note.son === 'battement' && note.temps < pose.temps).length).toBeGreaterThanOrEqual(4);
  });

  it('reste un petit oiseau : jamais plus de deux sons à la fois', () => {
    for (const [moment, partition] of Object.entries(PARTITIONS)) {
      for (const note of partition!) {
        const ensemble = partition!.filter((autre) => Math.abs(autre.temps - note.temps) < 40);
        expect(ensemble.length, `${moment} vers ${note.temps} ms`).toBeLessThanOrEqual(2);
      }
    }
  });

  it('des forces et des hauteurs raisonnables', () => {
    for (const partition of Object.values(PARTITIONS)) {
      for (const note of partition!) {
        expect(note.force ?? 1).toBeGreaterThan(0);
        expect(note.force ?? 1).toBeLessThanOrEqual(1);
        expect(note.hauteur ?? 1).toBeGreaterThan(0.5);
        expect(note.hauteur ?? 1).toBeLessThan(2);
      }
    }
  });
});
