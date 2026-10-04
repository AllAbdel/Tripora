import { resoudre, useLangue } from '@/stores/langue';
import type { Langue } from './langues';
import { normaliser, traduireCle, type Dictionnaire, type ModuleDeDictionnaire } from './moteur';

export { normaliser };
export type { ModuleDeDictionnaire, Motif } from './moteur';

/**
 * La traduction au rendu : toutes les langues, pour tout ce que `useT()` ne couvre pas.
 *
 * `useT()` et ses clés typées traduisent ce qu'on lit en premier (navigation,
 * actions, écrans d'entrée). Le reste de l'application — plus de huit cents
 * phrases réparties dans une centaine de composants, plus celles que le moteur
 * compose (explications des propositions, titres des journées) — restait en
 * français. Les passer une à une en clés aurait touché chaque composant trois
 * fois (le texte, la clé, la traduction) pour un résultat identique à l'écran.
 *
 * Ici, le français reste la source, dans le code, là où il est écrit. Une fois
 * l'interface rendue, chaque texte affiché est cherché dans un dictionnaire
 * dont la clé est la phrase française elle-même (`phrases-en.ts`) — puis dans
 * une liste de motifs pour les phrases qui portent un nombre ou un nom. Seule
 * la valeur du nœud texte change : React garde ses nœuds, et quand il réécrit
 * un texte (une donnée qui change), le nouveau français est traduit à son tour.
 *
 * Une phrase écrite en morceaux dans le JSX (`{n} idée{s} à {ville}`) donne
 * plusieurs nœuds texte voisins : ils sont recollés et traduits comme une
 * seule phrase (la traduction va dans le premier, les autres se vident).
 * Sans traduction de la phrase entière, chaque morceau est essayé seul.
 *
 * Ce qui n'est jamais touché : les champs de saisie, et tout ce qui est marqué
 * `translate="no"` (les noms, les messages, ce que les gens écrivent eux-mêmes).
 *
 * **Ajouter une langue** : un fichier `phrases-<code>.ts` à côté de
 * `phrases-en.ts`, qui exporte `PHRASES` et `MOTIFS` ; il est trouvé et chargé
 * tout seul. Le guide : `docs/TRADUCTIONS.md`.
 *
 * Le dictionnaire ne se charge que pour sa langue : un francophone ne
 * télécharge pas l'anglais (une soixantaine de kilo-octets). Pendant ce
 * chargement, l'écran reste en français, puis se traduit d'un coup.
 *
 * Une phrase absente du dictionnaire reste en français, comme avec `useT()`.
 * Pour trouver celles qui manquent : `LANGUE=es pnpm --filter @tripora/web traductions:recolte`
 * parcourt l'application dans la langue et liste chaque texte resté en français.
 */

/** Chaque `phrases-<code>.ts` du dossier, chargé à la demande quand sa langue devient active. */
const MODULES = import.meta.glob<ModuleDeDictionnaire>(['./phrases-*.ts', '!./phrases-*.test.ts']);
const CHARGEURS: Partial<Record<string, () => Promise<ModuleDeDictionnaire>>> = Object.fromEntries(
  Object.entries(MODULES).map(([chemin, charger]) => [/phrases-([a-z]{2,3})\.ts$/u.exec(chemin)?.[1] ?? chemin, charger]),
);
const DICTIONNAIRES: Partial<Record<Langue, Dictionnaire>> = {};
const CHARGEURS_DE_CARNET: Partial<Record<Langue, NonNullable<ModuleDeDictionnaire['CARNET']>>> = {};
const CARNETS: Partial<Record<Langue, Promise<boolean>>> = {};

/** Les langues qui ont un dictionnaire de traduction au rendu (le français n'en a pas besoin). */
export const LANGUES_TRADUITES = Object.keys(CHARGEURS).sort();

/** Charge le dictionnaire d'une langue ; faux si cette langue n'en a pas. */
export async function chargerLeDictionnaire(langue: Langue): Promise<boolean> {
  if (DICTIONNAIRES[langue]) return true;
  const chargeur = CHARGEURS[langue];
  if (!chargeur) return false;
  const module = await chargeur();
  DICTIONNAIRES[langue] = { phrases: module.PHRASES, motifs: module.MOTIFS };
  if (module.CARNET) CHARGEURS_DE_CARNET[langue] = module.CARNET;
  return true;
}

/**
 * Le carnet d'activités d'une langue, ajouté au dictionnaire après
 * l'interface ; vrai s'il vient d'être (ou était déjà) ajouté. Hors ligne et
 * sans le fichier en cache, faux : on réessaiera au prochain changement.
 */
export function chargerLeCarnet(langue: Langue): Promise<boolean> {
  CARNETS[langue] ??= chargerLeDictionnaire(langue)
    .then(async (charge) => {
      const charger = CHARGEURS_DE_CARNET[langue];
      if (!charge || !charger) return false;
      const carnet = await charger();
      const dictionnaire = DICTIONNAIRES[langue]!;
      // Ce que l'interface traduit déjà garde sa traduction.
      DICTIONNAIRES[langue] = { ...dictionnaire, phrases: { ...carnet, ...dictionnaire.phrases } };
      return true;
    })
    .catch(() => {
      delete CARNETS[langue];
      return false;
    });
  return CARNETS[langue];
}

const ATTRIBUTS = ['placeholder', 'aria-label', 'title', 'alt'] as const;
/** La description de la page, que les moteurs affichent sous son titre dans leurs résultats. */
const DESCRIPTION = 'meta[name="description"]';
const EXCLUS = '[translate="no"],script,style,textarea,code,pre,[contenteditable="true"]';


/** La traduction d'un texte, en gardant ses espaces de bord ; `null` si on ne la connaît pas. */
export function traduireTexte(langue: Langue, texte: string): string | null {
  const dictionnaire = DICTIONNAIRES[langue];
  if (!dictionnaire) return null;
  const cle = normaliser(texte);
  if (!cle || !/\p{L}/u.test(cle)) return null;
  const traduction = traduireCle(dictionnaire, cle);
  if (traduction === null) return null;
  const debut = /^\s*/u.exec(texte)?.[0] ?? '';
  const fin = /\s*$/u.exec(texte)?.[0] ?? '';
  return debut + traduction + fin;
}

/**
 * Pour un texte que la page n'affiche pas comme texte (une image dessinée) :
 * sa traduction dans la langue active, ou le français tel quel.
 */
export function traduireDansLaLangueActive(texte: string): string {
  return traduireTexte(resoudre(useLangue.getState().preference), texte) ?? texte;
}

interface Etat {
  original: string;
  traduit: string;
}

const etatsDesTextes = new WeakMap<Text, Etat>();
const etatsDesAttributs = new WeakMap<Element, Map<string, Etat>>();
const touches = new Set<WeakRef<Text | Element>>();
const manquantes = new Map<string, number>();
let langue: Langue = 'fr';
let recolte = false;

function exclu(element: Element | null): boolean {
  return !element || element.closest(EXCLUS) !== null;
}

function noter(texte: string) {
  if (!recolte) return;
  const cle = normaliser(texte);
  if (cle && /\p{L}{2}/u.test(cle)) manquantes.set(cle, (manquantes.get(cle) ?? 0) + 1);
}

/** Le français d'un nœud : sa valeur, ou l'original si c'est notre traduction qui s'affiche. */
function originalDe(noeud: Text): string {
  const valeur = noeud.nodeValue ?? '';
  const etat = etatsDesTextes.get(noeud);
  return etat && valeur === etat.traduit ? etat.original : valeur;
}

function ecrire(noeud: Text, original: string, traduit: string) {
  etatsDesTextes.set(noeud, { original, traduit });
  touches.add(new WeakRef(noeud));
  // N'écrire que ce qui change : notre propre écriture redéclenche l'observateur.
  if (noeud.nodeValue !== traduit) noeud.nodeValue = traduit;
}

/** Les nœuds texte voisins du nœud : ceux qu'une phrase en morceaux du JSX laisse côte à côte. */
function voisinage(noeud: Text): Text[] {
  let premier: Node = noeud;
  while (premier.previousSibling?.nodeType === Node.TEXT_NODE) premier = premier.previousSibling;
  const groupe: Text[] = [];
  for (let n: Node | null = premier; n?.nodeType === Node.TEXT_NODE; n = n.nextSibling) groupe.push(n as Text);
  return groupe;
}

/** Un nœud seul ; vrai s'il est traduit (ou n'a rien à traduire). */
function traiterSeul(noeud: Text, signaler: boolean): boolean {
  const original = originalDe(noeud);
  const etat = etatsDesTextes.get(noeud);
  const traduction = traduireTexte(langue, original);
  if (traduction === null) {
    // Une traduction de groupe affichée ici n'a plus lieu d'être : le français revient.
    if (etat) {
      etatsDesTextes.delete(noeud);
      if (noeud.nodeValue !== original) noeud.nodeValue = original;
    }
    if (signaler) noter(original);
    return !/\p{L}{2}/u.test(original);
  }
  if (traduction !== original || etat) ecrire(noeud, original, traduction);
  return true;
}

function traiterTexte(noeud: Text) {
  if (exclu(noeud.parentElement)) return;
  const groupe = voisinage(noeud);
  if (groupe.length === 1) {
    traiterSeul(noeud, true);
    return;
  }
  const originaux = groupe.map(originalDe);
  const phrase = originaux.join('');
  const traduction = traduireTexte(langue, phrase);
  if (traduction !== null) {
    groupe.forEach((n, i) => ecrire(n, originaux[i]!, i === 0 ? traduction : ''));
    return;
  }
  // Pas de traduction pour la phrase entière : chaque morceau tente sa chance,
  // et c'est la phrase entière qu'on signale à la récolte.
  const tous = groupe.map((n) => traiterSeul(n, false)).every(Boolean);
  if (!tous) noter(phrase);
}

function traiterAttributs(element: Element) {
  if (exclu(element)) return;
  for (const nom of element.matches(DESCRIPTION) ? ['content'] : ATTRIBUTS) {
    const valeur = element.getAttribute(nom);
    if (!valeur) continue;
    const etats = etatsDesAttributs.get(element) ?? new Map<string, Etat>();
    if (etats.get(nom)?.traduit === valeur) continue;
    const traduction = traduireTexte(langue, valeur);
    if (traduction === null) {
      noter(valeur);
      continue;
    }
    if (traduction === valeur) continue;
    etats.set(nom, { original: valeur, traduit: traduction });
    etatsDesAttributs.set(element, etats);
    touches.add(new WeakRef(element));
    element.setAttribute(nom, traduction);
  }
}

function parcourir(racine: Node) {
  if (racine.nodeType === Node.TEXT_NODE) {
    traiterTexte(racine as Text);
    return;
  }
  if (racine.nodeType !== Node.ELEMENT_NODE && racine.nodeType !== Node.DOCUMENT_NODE) return;
  if (racine.nodeType === Node.ELEMENT_NODE) traiterAttributs(racine as Element);
  const marcheur = document.createTreeWalker(racine, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
  for (let n = marcheur.nextNode(); n; n = marcheur.nextNode()) {
    if (n.nodeType === Node.TEXT_NODE) traiterTexte(n as Text);
    else traiterAttributs(n as Element);
  }
}

/** Retour au français : chaque texte touché retrouve sa version d'origine, s'il n'a pas changé depuis. */
function restaurer() {
  for (const ref of touches) {
    const n = ref.deref();
    if (!n) continue;
    if (n.nodeType === Node.TEXT_NODE) {
      const etat = etatsDesTextes.get(n as Text);
      if (etat && (n as Text).nodeValue === etat.traduit) (n as Text).nodeValue = etat.original;
      etatsDesTextes.delete(n as Text);
    } else {
      const etats = etatsDesAttributs.get(n as Element);
      etats?.forEach((etat, nom) => {
        if ((n as Element).getAttribute(nom) === etat.traduit) (n as Element).setAttribute(nom, etat.original);
      });
      etatsDesAttributs.delete(n as Element);
    }
  }
  touches.clear();
}

let observateur: MutationObserver | null = null;

function appliquer(nouvelle: Langue) {
  if (nouvelle === langue) return;
  restaurer();
  langue = nouvelle;
  // La langue a pu changer pendant un chargement : on ne parcourt que pour elle.
  const reparcourir = (ajoute: boolean) => {
    if (ajoute && langue === nouvelle) parcourir(document.documentElement);
  };
  const carnet = () => void chargerLeCarnet(nouvelle).then(reparcourir);
  if (DICTIONNAIRES[langue]) {
    parcourir(document.documentElement);
    carnet();
    return;
  }
  chargerLeDictionnaire(nouvelle)
    .then((charge) => {
      reparcourir(charge);
      if (charge) carnet();
    })
    // Hors ligne sans le fichier en cache : l'écran reste en français.
    .catch(() => {});
}

/**
 * Branche la traduction au rendu sur le document. Inerte tant que la langue
 * active n'a pas de dictionnaire (le français, et les langues pas encore faites).
 */
export function demarrerLaTraductionAuRendu() {
  if (observateur || typeof MutationObserver === 'undefined') return;
  try {
    recolte = localStorage.getItem('tripora.recolte-traductions') === '1';
  } catch {
    recolte = false;
  }
  observateur = new MutationObserver((mutations) => {
    if (!DICTIONNAIRES[langue]) return;
    for (const m of mutations) {
      if (m.type === 'characterData') traiterTexte(m.target as Text);
      else if (m.type === 'attributes') traiterAttributs(m.target as Element);
      else {
        m.addedNodes.forEach(parcourir);
        // Un morceau retiré d'une phrase (« idée{s} » au singulier) : la phrase se retraduit.
        if ([...m.removedNodes].some((n) => n.nodeType === Node.TEXT_NODE)) {
          const texte = [...m.target.childNodes].find((n) => n.nodeType === Node.TEXT_NODE);
          if (texte) traiterTexte(texte as Text);
        }
      }
    }
  });
  observateur.observe(document.documentElement, {
    subtree: true,
    childList: true,
    characterData: true,
    attributes: true,
    attributeFilter: [...ATTRIBUTS, 'content'],
  });
  appliquer(resoudre(useLangue.getState().preference));
  useLangue.subscribe((etat) => appliquer(resoudre(etat.preference)));
  (window as unknown as { __phrasesManquantes?: () => [string, number][] }).__phrasesManquantes = () =>
    [...manquantes.entries()].sort((a, b) => b[1] - a[1]);
}
