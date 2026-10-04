/**
 * Le moteur de la traduction au rendu, sans navigateur : chercher une phrase
 * française dans un dictionnaire, puis dans ses motifs.
 *
 * À part pour servir aussi aux scripts (`scripts/extraire-les-textes.ts`) et
 * aux tests, qui n'ont ni DOM ni Vite.
 */

/** Un traducteur de morceau, donné aux motifs qui composent leur phrase. */
export type Traducteur = (francais: string) => string | null;
export type Remplacement = string | ((t: Traducteur, ...groupes: string[]) => string | null);
export type Motif = readonly [RegExp, Remplacement];
export interface Dictionnaire {
  phrases: Readonly<Record<string, string>>;
  motifs: readonly Motif[];
}
/** Ce qu'exporte chaque `phrases-<code>.ts`. */
export interface ModuleDeDictionnaire {
  PHRASES: Readonly<Record<string, string>>;
  MOTIFS: readonly Motif[];
  /**
   * Le carnet d'activités dans la langue, s'il est traduit : chargé à part,
   * après l'interface, parce qu'il pèse plus lourd qu'elle et ne sert qu'une
   * fois un voyage ouvert. Ses phrases complètent `PHRASES` sans la remplacer.
   */
  CARNET?: () => Promise<Readonly<Record<string, string>>>;
}

/** La clé d'une phrase : ses espaces (insécables compris) resserrés. */
export const normaliser = (texte: string) => texte.replace(/\s+/gu, ' ').trim();

/** La traduction d'une phrase déjà normalisée, ou `null`. */
export function traduireCle(dictionnaire: Dictionnaire, cle: string): string | null {
  const exacte = dictionnaire.phrases[cle];
  if (exacte !== undefined) return exacte;
  const morceau: Traducteur = (francais) => dictionnaire.phrases[normaliser(francais)] ?? null;
  for (const [motif, remplacement] of dictionnaire.motifs) {
    const trouve = motif.exec(cle);
    if (!trouve) continue;
    if (typeof remplacement === 'string') return cle.replace(motif, remplacement);
    // Une fonction peut renoncer (null) : le motif suivant a sa chance.
    const compose = remplacement(morceau, ...trouve.slice(1).map((g) => g ?? ''));
    if (compose !== null) return compose;
  }
  return null;
}
