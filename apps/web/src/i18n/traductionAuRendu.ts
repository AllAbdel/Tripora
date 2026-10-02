import { resoudre, useLangue } from '@/stores/langue';
import type { Langue } from './langues';

/**
 * La traduction au rendu : l'anglais pour tout ce que `useT()` ne couvre pas.
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
 * Ce qui n'est jamais touché : les champs de saisie, et tout ce qui est marqué
 * `translate="no"` (les noms, les messages, ce que les gens écrivent eux-mêmes).
 *
 * Le dictionnaire ne se charge que pour sa langue : un francophone ne
 * télécharge pas l'anglais (une soixantaine de kilo-octets). Pendant ce
 * chargement, l'écran reste en français, puis se traduit d'un coup.
 *
 * Une phrase absente du dictionnaire reste en français, comme avec `useT()`.
 * Pour trouver celles qui manquent : `pnpm --filter @tripora/web traductions:recolte`
 * parcourt l'application en anglais et liste chaque texte resté en français.
 */

/** Un traducteur de morceau, donné aux motifs qui composent leur phrase. */
type Traducteur = (francais: string) => string | null;
type Remplacement = string | ((t: Traducteur, ...groupes: string[]) => string | null);
type Motif = readonly [RegExp, Remplacement];
interface Dictionnaire {
  phrases: Readonly<Record<string, string>>;
  motifs: readonly Motif[];
}

const CHARGEURS: Partial<Record<Langue, () => Promise<Dictionnaire>>> = {
  en: () => import('./phrases-en').then((module) => ({ phrases: module.PHRASES_EN, motifs: module.MOTIFS_EN })),
};
const DICTIONNAIRES: Partial<Record<Langue, Dictionnaire>> = {};

/** Charge le dictionnaire d'une langue ; faux si cette langue n'en a pas. */
export async function chargerLeDictionnaire(langue: Langue): Promise<boolean> {
  if (DICTIONNAIRES[langue]) return true;
  const chargeur = CHARGEURS[langue];
  if (!chargeur) return false;
  DICTIONNAIRES[langue] = await chargeur();
  return true;
}

const ATTRIBUTS = ['placeholder', 'aria-label', 'title', 'alt'] as const;
const EXCLUS = '[translate="no"],script,style,textarea,code,pre,[contenteditable="true"]';

export const normaliser = (texte: string) => texte.replace(/\s+/gu, ' ').trim();

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

function traduireCle(dictionnaire: Dictionnaire, cle: string): string | null {
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

function traiterTexte(noeud: Text) {
  if (exclu(noeud.parentElement)) return;
  const valeur = noeud.nodeValue ?? '';
  const etat = etatsDesTextes.get(noeud);
  if (etat && valeur === etat.traduit) return;
  const traduction = traduireTexte(langue, valeur);
  if (traduction === null) {
    noter(valeur);
    return;
  }
  if (traduction === valeur) return;
  etatsDesTextes.set(noeud, { original: valeur, traduit: traduction });
  touches.add(new WeakRef(noeud));
  noeud.nodeValue = traduction;
}

function traiterAttributs(element: Element) {
  if (exclu(element)) return;
  for (const nom of ATTRIBUTS) {
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
  if (DICTIONNAIRES[langue]) {
    parcourir(document.documentElement);
    return;
  }
  chargerLeDictionnaire(nouvelle)
    .then((charge) => {
      // La langue a pu changer pendant le chargement.
      if (charge && langue === nouvelle) parcourir(document.documentElement);
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
      else m.addedNodes.forEach(parcourir);
    }
  });
  observateur.observe(document.documentElement, {
    subtree: true,
    childList: true,
    characterData: true,
    attributes: true,
    attributeFilter: [...ATTRIBUTS],
  });
  appliquer(resoudre(useLangue.getState().preference));
  useLangue.subscribe((etat) => appliquer(resoudre(etat.preference)));
  (window as unknown as { __phrasesManquantes?: () => [string, number][] }).__phrasesManquantes = () =>
    [...manquantes.entries()].sort((a, b) => b[1] - a[1]);
}
