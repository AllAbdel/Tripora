import { describe, expect, it } from 'vitest';
import { LANGUES } from './langues';
import { normaliser, type ModuleDeDictionnaire } from './traductionAuRendu';

/**
 * Les règles communes à tous les dictionnaires de la traduction au rendu
 * (`phrases-<code>.ts`) : un fichier ajouté pour une nouvelle langue est
 * vérifié ici sans rien écrire de plus.
 */
const MODULES = import.meta.glob<ModuleDeDictionnaire>(['./phrases-*.ts', '!./phrases-*.test.ts'], { eager: true });

describe.each(Object.entries(MODULES))('le dictionnaire %s', (chemin, module) => {
  const code = /phrases-([a-z]{2,3})\.ts$/u.exec(chemin)?.[1];

  it('porte le code d’une langue de Tripora, autre que le français', () => {
    expect(LANGUES.map((fiche) => fiche.code)).toContain(code);
    expect(code).not.toBe('fr');
  });

  it('exporte PHRASES et MOTIFS', () => {
    expect(typeof module.PHRASES).toBe('object');
    expect(Array.isArray(module.MOTIFS)).toBe(true);
  });

  it('n’a ni traduction vide, ni clé que la recherche ne retrouverait pas', () => {
    for (const [francais, traduction] of Object.entries(module.PHRASES)) {
      expect(traduction.trim(), francais).not.toBe('');
      // La clé est cherchée espaces resserrés : « Bonjour  vous » ne serait jamais trouvé.
      expect(normaliser(francais), francais).toBe(francais.replace(/[\u00a0\u202f]/gu, ' '));
    }
  });

  it('a des motifs ancrés au début et à la fin de la phrase', () => {
    for (const [motif] of module.MOTIFS) {
      expect(motif.source.startsWith('^') && motif.source.endsWith('$'), motif.source).toBe(true);
      expect(motif.flags, motif.source).toContain('u');
    }
  });
});
