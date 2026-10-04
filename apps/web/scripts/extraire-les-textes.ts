/**
 * Tous les textes français du code, et ce qui en est déjà traduit dans une langue.
 *
 * La récolte (`recolter-traductions.mjs`) voit ce qu'affichent quelques écrans
 * de démonstration ; ce script lit le code lui-même — l'application et le
 * cœur — et en sort chaque texte qui s'affiche, y compris les messages
 * d'erreur, les états rares et le carnet de toutes les destinations :
 *
 *   - `texte`   : un texte JSX d'un seul tenant (« Retour au voyage ») ;
 *   - `chaine`  : une chaîne entre guillemets qui ressemble à du français ;
 *   - `phrase`  : une phrase composée, JSX en morceaux ou gabarit `${…}`,
 *                 écrite avec des trous numérotés (« {1} idées à {2} ») :
 *                 à couvrir par un motif, car sa forme finale dépend des données.
 *
 *   LANGUE=es npx tsx scripts/extraire-les-textes.ts > /tmp/a-traduire.json
 *
 * Chaque entrée dit si elle est déjà traduite dans `phrases-<LANGUE>.ts`
 * (`traduit` : vrai, faux, ou `null` pour une phrase à trous, qu'on ne peut
 * vérifier qu'à l'écran). Le résumé, par dossier, sort sur la sortie d'erreur.
 *
 * Ce qui n'est pas extrait, volontairement : les tests, les dictionnaires
 * eux-mêmes, les pages publiques générées (`src/seo/`, un site à part), ce
 * que le cœur envoie à l'IA (`packages/core/src/ai/`, en français par
 * construction) et les listes de mots que les lecteurs de tickets et
 * d'e-mails cherchent (ce sont des motifs de lecture, pas des textes).
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { normaliser, traduireCle, type Dictionnaire, type ModuleDeDictionnaire } from '../src/i18n/moteur';

const ICI = dirname(fileURLToPath(import.meta.url));
const RACINE = resolve(ICI, '../../..');
const LANGUE = process.env.LANGUE ?? 'en';
const DOSSIERS = [resolve(ICI, '../src'), resolve(RACINE, 'packages/core/src')];
const ECARTES = [
  /\.test\.tsx?$/u,
  /\/i18n\/phrases-[a-z]+\.ts$/u,
  /\/i18n\/textes\.ts$/u,
  /\/seo\//u,
  /\/core\/src\/ai\//u,
  /\/core\/src\/(confirmation|ticket|feries-du-monde)\.ts$/u,
  // Les noms de langues s'écrivent dans leur langue ; les noms de devises en
  // français ne servent qu'en français (ailleurs, Intl.DisplayNames).
  /\/i18n\/langues\.ts$/u,
  /\/core\/src\/currency\.ts$/u,
  /\/vite-env\.d\.ts$/u,
];
/** Les attributs JSX dont la valeur s'affiche (ou se lit à voix haute). */
const ATTRIBUTS_LUS = new Set(['placeholder', 'aria-label', 'title', 'alt', 'label', 'aria-description', 'titre', 'texte', 'detail', 'description', 'libelle', 'message', 'vide', 'etiquette', 'terme']);
/** Les propriétés d'objet qui ne sont jamais du texte affiché. */
const PROPRIETES_TECHNIQUES = new Set(['className', 'class', 'style', 'variant', 'size', 'type', 'id', 'key', 'href', 'to', 'src', 'icon', 'name', 'role', 'mode', 'tone']);

interface Entree {
  texte: string;
  fichier: string;
  ligne: number;
  nature: 'texte' | 'chaine' | 'phrase';
  traduit: boolean | null;
}

async function chargerLeDictionnaire(): Promise<Dictionnaire | null> {
  const chemin = resolve(ICI, `../src/i18n/phrases-${LANGUE}.ts`);
  if (!existsSync(chemin)) return null;
  const module = (await import(chemin)) as ModuleDeDictionnaire;
  return { phrases: module.PHRASES, motifs: module.MOTIFS };
}

function fichiers(dossier: string): string[] {
  return readdirSync(dossier).flatMap((nom) => {
    const chemin = join(dossier, nom);
    if (statSync(chemin).isDirectory()) return fichiers(chemin);
    return /\.tsx?$/u.test(nom) && !ECARTES.some((motif) => motif.test(chemin)) ? [chemin] : [];
  });
}

/** Du français, à vue d'œil : des lettres, et une espace ou un accent ; pas des classes CSS ni un chemin. */
function ressembleAuFrancais(texte: string): boolean {
  const propre = texte.trim();
  if (!/\p{Ll}/u.test(propre) || propre.length < 2) return false;
  if (/^(https?:|mailto:|\/|\.\/|@|#|[a-z]+:\/\/)/u.test(propre)) return false;
  // Un tracé SVG, une liste de nombres : plus de chiffres que de lettres.
  if ((propre.match(/[\d.\-\s]/gu)?.length ?? 0) > propre.length * 0.5) return false;
  // Une liste de colonnes pour Supabase (« id, trip_id, created_at ») : du code, pas du texte.
  if (/_/u.test(propre) && /^[\w\s,*().:-]+$/u.test(propre)) return false;
  const mots = propre.split(/\s+/u);
  // « text-sm font-semibold px-4 » : des classes, pas une phrase.
  if (mots.every((mot) => /^[a-z0-9:[\]/.%()!#_,-]+$/u.test(mot)) && mots.some((mot) => /[-:[]/u.test(mot))) return false;
  // Un identifiant seul (« veille-du-depart », « tripora.langue »).
  if (mots.length === 1 && /^[\w.-]+$/u.test(propre) && !/[àâçéèêëîïôûùüÿœ]/iu.test(propre)) return /^\p{Lu}\p{Ll}+$/u.test(propre);
  return /\s/u.test(propre) || /[àâçéèêëîïôûùüÿœ’]/iu.test(propre) || /^\p{Lu}\p{Ll}+$/u.test(propre);
}

function extraire(chemin: string, dictionnaire: Dictionnaire | null, sortie: Entree[]) {
  const source = ts.createSourceFile(chemin, readFileSync(chemin, 'utf8'), ts.ScriptTarget.Latest, true, chemin.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const fichier = relative(RACINE, chemin);
  const traduit = (texte: string) => (dictionnaire ? traduireCle(dictionnaire, normaliser(texte)) !== null : false);
  const noter = (texte: string, noeud: ts.Node, nature: Entree['nature']) => {
    const propre = normaliser(texte);
    if (!ressembleAuFrancais(propre)) return;
    const ligne = source.getLineAndCharacterOfPosition(noeud.getStart()).line + 1;
    sortie.push({ texte: propre, fichier, ligne, nature, traduit: nature === 'phrase' && /\{\d+\}/u.test(propre) ? null : traduit(propre) });
  };

  /** Le texte d'une expression simple (« 'abc' », « `abc` », « ' ' »), ou null. */
  const litteral = (expression: ts.Expression | undefined): string | null =>
    expression && (ts.isStringLiteral(expression) || ts.isNoSubstitutionTemplateLiteral(expression)) ? expression.text : null;

  /** `'a' + 'b'` (une longue phrase coupée en lignes) → « ab », ou null si l'un des morceaux n'est pas une chaîne. */
  const concatenation = (noeud: ts.Expression): string | null => {
    if (ts.isParenthesizedExpression(noeud)) return concatenation(noeud.expression);
    if (ts.isBinaryExpression(noeud) && noeud.operatorToken.kind === ts.SyntaxKind.PlusToken) {
      const gauche = concatenation(noeud.left);
      const droite = concatenation(noeud.right);
      return gauche !== null && droite !== null ? gauche + droite : null;
    }
    return litteral(noeud);
  };

  /** Un gabarit `a ${b} c` → « a {1} c ». */
  const gabarit = (noeud: ts.TemplateExpression): string =>
    noeud.head.text + noeud.templateSpans.map((span, i) => `{${i + 1}}${span.literal.text}`).join('');

  /** Les enfants d'un élément JSX : chaque suite de textes et d'expressions forme une phrase. */
  const enfantsJsx = (enfants: ts.NodeArray<ts.JsxChild>) => {
    let morceaux: string[] = [];
    let trous = 0;
    let textes = 0;
    let debut: ts.Node | null = null;
    const finir = () => {
      if (debut && textes > 0) noter(morceaux.join(''), debut, trous > 0 ? 'phrase' : 'texte');
      morceaux = [];
      trous = 0;
      textes = 0;
      debut = null;
    };
    for (const enfant of enfants) {
      if (ts.isJsxText(enfant)) {
        if (enfant.containsOnlyTriviaWhiteSpaces) continue;
        debut ??= enfant;
        morceaux.push(enfant.text);
        textes += 1;
      } else if (ts.isJsxExpression(enfant)) {
        const texte = litteral(enfant.expression);
        if (texte !== null) {
          debut ??= enfant;
          morceaux.push(texte);
          if (/\p{L}/u.test(texte)) textes += 1;
        } else if (enfant.expression && ts.isTemplateExpression(enfant.expression)) {
          debut ??= enfant;
          morceaux.push(gabarit(enfant.expression));
          textes += 1;
          trous += enfant.expression.templateSpans.length;
        } else if (enfant.expression) {
          debut ??= enfant;
          trous += 1;
          morceaux.push(`{${trous}}`);
        }
      } else {
        // Un élément au milieu : la phrase s'arrête là (la traduction au rendu voit deux morceaux).
        finir();
      }
    }
    finir();
  };

  const visiter = (noeud: ts.Node): void => {
    if (ts.isImportDeclaration(noeud) || ts.isExportDeclaration(noeud)) return;
    if (ts.isJsxElement(noeud)) enfantsJsx(noeud.children);
    if (ts.isJsxFragment(noeud)) enfantsJsx(noeud.children);
    if (ts.isJsxAttribute(noeud)) {
      const nom = noeud.name.getText(source);
      if (!ATTRIBUTS_LUS.has(nom) && !/^aria-/u.test(nom)) return;
      const valeur = noeud.initializer;
      if (valeur && ts.isStringLiteral(valeur)) noter(valeur.text, valeur, 'chaine');
      if (valeur && ts.isJsxExpression(valeur) && valeur.expression) visiter(valeur.expression);
      return;
    }
    if (ts.isPropertyAssignment(noeud) && PROPRIETES_TECHNIQUES.has(noeud.name.getText(source))) return;
    if (ts.isCallExpression(noeud) && /^(cn|classesDeBouton|clsx|require|import|querySelector|getElementById|getItem|setItem|removeItem|matchMedia|test|exec|match|replace|split)$/u.test(noeud.expression.getText(source).split('.').pop() ?? '')) return;
    // Les textes JSX sont relevés par phrases, au niveau de l'élément : pas une seconde fois ici.
    if (ts.isJsxExpression(noeud) && noeud.parent && (ts.isJsxElement(noeud.parent) || ts.isJsxFragment(noeud.parent))) {
      const expression = noeud.expression;
      if (expression && (litteral(expression) !== null || ts.isTemplateExpression(expression))) return;
    }
    // Une phrase coupée en plusieurs lignes avec « + » se relève entière, telle qu'elle s'affiche.
    if (ts.isBinaryExpression(noeud) && noeud.operatorToken.kind === ts.SyntaxKind.PlusToken && !ts.isBinaryExpression(noeud.parent)) {
      const entiere = concatenation(noeud);
      if (entiere !== null) {
        noter(entiere, noeud, 'chaine');
        return;
      }
    }
    if (ts.isStringLiteral(noeud) || ts.isNoSubstitutionTemplateLiteral(noeud)) {
      if (!ts.isJsxAttribute(noeud.parent)) noter(noeud.text, noeud, 'chaine');
      return;
    }
    if (ts.isTemplateExpression(noeud)) {
      noter(gabarit(noeud), noeud, 'phrase');
      return;
    }
    ts.forEachChild(noeud, visiter);
  };
  visiter(source);
}

const dictionnaire = await chargerLeDictionnaire();
const sortie: Entree[] = [];
for (const dossier of DOSSIERS) for (const chemin of fichiers(dossier)) extraire(chemin, dictionnaire, sortie);

// Une même phrase écrite à plusieurs endroits ne compte qu'une fois.
const vus = new Map<string, Entree>();
for (const entree of sortie) if (!vus.has(entree.texte)) vus.set(entree.texte, entree);
const uniques = [...vus.values()];
process.stdout.write(JSON.stringify(uniques, null, 1) + '\n');

const parDossier = new Map<string, { total: number; traduits: number; phrases: number }>();
for (const entree of uniques) {
  const dossier = entree.fichier.split('/').slice(0, entree.fichier.startsWith('packages') ? 4 : 4).join('/');
  const ligne = parDossier.get(dossier) ?? { total: 0, traduits: 0, phrases: 0 };
  ligne.total += 1;
  if (entree.traduit) ligne.traduits += 1;
  if (entree.traduit === null) ligne.phrases += 1;
  parDossier.set(dossier, ligne);
}
const total = uniques.length;
const traduits = uniques.filter((entree) => entree.traduit).length;
const aTrous = uniques.filter((entree) => entree.traduit === null).length;
console.error(`${LANGUE}${dictionnaire ? '' : ' (pas encore de dictionnaire)'} : ${total} textes, ${traduits} traduits, ${aTrous} phrases à trous (à vérifier à l'écran), ${total - traduits - aTrous} à traduire.`);
for (const [dossier, ligne] of [...parDossier.entries()].sort((a, b) => b[1].total - a[1].total)) {
  console.error(`  ${dossier.padEnd(48)} ${String(ligne.traduits).padStart(5)} / ${String(ligne.total - ligne.phrases).padStart(5)}   + ${ligne.phrases} à trous`);
}
