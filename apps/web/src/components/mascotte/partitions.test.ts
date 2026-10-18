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

/** Les moments qui sonnent, et la classe d'animation qui en donne la durée. */
const GESTES: [MomentDePlumio, string][] = [
  ['arrive', 'arrive'],
  ['tapote', 'tapote'],
  ['picore', 'picore'],
  ['content', 'content'],
  ['atterrit', 'atterrit'],
  ['sort', 'sort'],
];

describe('les partitions du guide', () => {
  it.each(GESTES)('%s a sa note, et elle tient dans la durée du geste', (moment, classe) => {
    const partition = PARTITIONS[moment];
    expect(partition?.length).toBeGreaterThan(0);
    const duree = dureeDans(classe);
    expect(duree).toBeGreaterThan(300);
    for (const note of partition!) {
      expect(note.temps, `${moment} : ${note.son} à ${note.temps} ms`).toBeGreaterThanOrEqual(0);
      expect(note.temps, `${moment} : ${note.son} à ${note.temps} ms, pour ${duree} ms`).toBeLessThan(duree);
    }
  });

  it('l’apparition tombe quand il se pose (66 % de l’arrivée), pas pendant la descente', () => {
    const [pose] = PARTITIONS.arrive!;
    expect(pose!.son).toBe('apparition');
    expect(Math.abs(pose!.temps / dureeDans('arrive') - 0.66)).toBeLessThan(0.03);
  });

  it('reste sobre : un seul son par moment, et rien quand il parle, sautille ou salue', () => {
    for (const [moment, partition] of Object.entries(PARTITIONS)) {
      expect(partition!.length, moment).toBe(1);
    }
    for (const muet of ['parle', 'sautille', 'salue', 'se-tourne', 'joue:reflechit', 'joue:accueil'] as const) {
      expect(PARTITIONS[muet], muet).toBeUndefined();
    }
  });

  it('des intensités raisonnables', () => {
    for (const partition of Object.values(PARTITIONS)) {
      for (const note of partition!) {
        expect(note.force ?? 1).toBeGreaterThan(0);
        expect(note.force ?? 1).toBeLessThanOrEqual(1);
      }
    }
  });
});
