import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

function fichiers(racine: string): string[] {
  return readdirSync(racine, { withFileTypes: true }).flatMap((entree) => {
    const chemin = join(racine, entree.name);
    if (entree.isDirectory()) return fichiers(chemin);
    return /\.tsx?$/.test(entree.name) && !entree.name.includes('.test.') ? [chemin] : [];
  });
}

/**
 * Le défaut que ce test existe pour empêcher : une classe `text-gold-600`
 * alors que la palette ne définit que 300, 500 et 700. Tailwind 4 ne génère
 * rien pour une nuance absente, sans erreur ni avertissement — l'élément
 * garde la couleur héritée, ou aucun fond. Trente-quatre classes étaient dans
 * ce cas, dont la barre « dépassé » du budget, restée invisible.
 *
 * Les couleurs de Tailwind (red, amber, emerald…) ont toutes leurs nuances ;
 * seules les teintes propres à Tripora sont vérifiées.
 */
describe('palette', () => {
  it('ne cite aucune nuance absente du thème', () => {
    const src = join(process.cwd(), 'src');
    const theme = readFileSync(join(src, 'index.css'), 'utf8');
    const definies = new Set([...theme.matchAll(/--color-([a-z]+-\d+):/g)].map((m) => m[1]));

    const absentes = new Set<string>();
    for (const chemin of fichiers(src)) {
      const texte = readFileSync(chemin, 'utf8');
      for (const [, nuance] of texte.matchAll(/-((?:brand|lagoon|ink|paper|gold)-\d+)\b/g)) {
        if (!definies.has(nuance)) absentes.add(`${nuance} (${chemin.slice(src.length + 1)})`);
      }
    }
    expect([...absentes], 'nuances utilisées mais non définies dans index.css').toEqual([]);
  });
});
