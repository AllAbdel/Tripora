import { PREFERENCE_AXES, type PreferenceAxis } from '../preferences.js';
import type { ComfortLevel, GroupType } from '../types.js';

/**
 * Ce qu'on accepte de retenir d'une phrase interprétée par une IA.
 *
 * Le modèle lit « on part à cinq depuis Lyon une semaine en octobre, 400 €
 * max » et propose un remplissage de formulaire. Rien de ce qu'il renvoie
 * n'est cru sur parole : chaque champ est reconnu, converti, borné, et tout ce
 * qui sort du cadre est jeté sans bruit.
 *
 * C'est le seul endroit où une sortie d'IA entre dans les données de Tripora,
 * et elle n'y entre que comme *brouillon* : l'écran l'affiche, la personne
 * corrige, et rien n'est calculé avant qu'elle ait validé. Un modèle qui
 * hallucine « 400 jours » fait au pire perdre trois secondes.
 */
export interface TripDraft {
  participants?: number;
  durationDays?: number;
  month?: number;
  budgetPerPersonCents?: number;
  comfortLevel?: ComfortLevel;
  groupType?: GroupType;
  /** Nom de ville tel que dit ; c'est au catalogue de le reconnaître ou non. */
  destination?: string;
  origin?: string;
  weights?: Partial<Record<PreferenceAxis, number>>;
}

const COMFORT: readonly string[] = ['budget', 'standard', 'comfort'];
const GROUPS: readonly string[] = ['friends', 'couple', 'family', 'solo'];

/** Bornes volontairement larges : on écarte l'absurde, pas l'inhabituel. */
const BORNES = {
  participants: [1, 30],
  durationDays: [1, 60],
  month: [1, 12],
  // 10 € à 50 000 € par personne.
  budgetPerPersonCents: [1_000, 5_000_000],
} as const;

export function sanitizeDraft(brut: unknown): TripDraft {
  if (typeof brut !== 'object' || brut === null || Array.isArray(brut)) return {};
  const source = brut as Record<string, unknown>;
  const propre: TripDraft = {};

  for (const champ of ['participants', 'durationDays', 'month', 'budgetPerPersonCents'] as const) {
    const [min, max] = BORNES[champ];
    const valeur = entierBorne(source[champ], min, max);
    if (valeur !== undefined) propre[champ] = valeur;
  }

  if (typeof source.comfortLevel === 'string' && COMFORT.includes(source.comfortLevel)) {
    propre.comfortLevel = source.comfortLevel as ComfortLevel;
  }
  if (typeof source.groupType === 'string' && GROUPS.includes(source.groupType)) {
    propre.groupType = source.groupType as GroupType;
  }

  const destination = nomDeVille(source.destination);
  if (destination) propre.destination = destination;
  const origin = nomDeVille(source.origin);
  if (origin) propre.origin = origin;

  const weights = poids(source.weights);
  if (weights) propre.weights = weights;

  return propre;
}

/** Vrai si le brouillon apporte quelque chose : sinon, autant ne rien afficher. */
export function draftIsEmpty(draft: TripDraft): boolean {
  return Object.keys(draft).length === 0;
}

function entierBorne(valeur: unknown, min: number, max: number): number | undefined {
  const nombre = typeof valeur === 'string' ? Number(valeur.replace(',', '.')) : valeur;
  if (typeof nombre !== 'number' || !Number.isFinite(nombre)) return undefined;
  const arrondi = Math.round(nombre);
  return arrondi >= min && arrondi <= max ? arrondi : undefined;
}

function nomDeVille(valeur: unknown): string | undefined {
  if (typeof valeur !== 'string') return undefined;
  // Une ligne, pas de balise, pas de longueur déraisonnable : ce nom finira
  // dans un champ de recherche, pas dans du HTML, mais autant ne rien laisser
  // passer d'inattendu.
  const nettoye = valeur.replace(/[<>\n\r\t]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60);
  return nettoye.length >= 2 ? nettoye : undefined;
}

/**
 * Les poids, ramenés sur l'échelle de 0 à 1 que Tripora utilise partout.
 *
 * Un détail observé en conditions réelles : à consigne identique, certains
 * modèles répondent « food: 0.8 » et d'autres « food: 8 », sur une échelle de
 * dix qu'on ne leur a pas demandée. Tout écraser à 1 rendrait « 8 » et « 9 »
 * indiscernables et effacerait le classement que la personne avait exprimé.
 * Quand une valeur dépasse 1, on en déduit donc l'échelle et on divise par le
 * maximum : les proportions survivent, ce qui est l'information utile.
 */
function poids(valeur: unknown): Partial<Record<PreferenceAxis, number>> | undefined {
  if (typeof valeur !== 'object' || valeur === null || Array.isArray(valeur)) return undefined;
  const source = valeur as Record<string, unknown>;

  const bruts = new Map<PreferenceAxis, number>();
  for (const axe of PREFERENCE_AXES) {
    const nombre = typeof source[axe] === 'string' ? Number(source[axe]) : source[axe];
    if (typeof nombre !== 'number' || !Number.isFinite(nombre)) continue;
    bruts.set(axe, Math.max(0, nombre));
  }
  if (bruts.size === 0) return undefined;

  const maximum = Math.max(...bruts.values());
  const echelle = maximum > 1 ? maximum : 1;

  const propre: Partial<Record<PreferenceAxis, number>> = {};
  for (const [axe, brut] of bruts) {
    propre[axe] = Math.min(1, Math.round((brut / echelle) * 100) / 100);
  }
  return propre;
}
