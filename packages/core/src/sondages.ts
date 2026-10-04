/**
 * Les sondages du groupe : quelles dates, quel logement, où dîner ce soir.
 *
 * Tripora faisait voter sur la destination et les activités ; tout le reste
 * repartait dans la messagerie, où un vote se perd entre deux photos. Un
 * sondage, ce sont des options — un texte, un lien, des dates — et des voix.
 */

import { periodeLisible } from './presentDuVoyage.js';
import { trouverFournisseurParLien } from './reservations.js';

export type GenreDeSondage = 'texte' | 'dates' | 'liens';

export interface OptionDeSondage {
  id: string;
  libelle: string;
  /** Le logement, le restaurant : toujours en https. */
  lien?: string | null;
  /** Des dates : du 12 au 15, `AAAA-MM-JJ`. */
  du?: string | null;
  au?: string | null;
  position: number;
  ajouteePar?: string | null;
}

export interface VoteDeSondage {
  optionId: string;
  userId: string;
}

export interface Sondage {
  id: string;
  tripId: string;
  question: string;
  genre: GenreDeSondage;
  choixMultiple: boolean;
  clos: boolean;
  creePar?: string | null;
  creeLe: string;
  options: OptionDeSondage[];
  votes: VoteDeSondage[];
}

/** Une option, avec ses voix. */
export interface OptionDepouillee {
  option: OptionDeSondage;
  voix: number;
  votants: string[];
  /** Ai-je voté pour elle ? */
  moi: boolean;
  /** Sa part des votants, entre 0 et 1. */
  part: number;
  /** En tête, ex aequo compris — et seulement si quelqu'un a voté. */
  enTete: boolean;
}

export interface Depouillement {
  options: OptionDepouillee[];
  /** Combien de personnes ont voté, pas combien de voix : à choix multiple, ce n'est pas pareil. */
  votants: number;
  aVote: boolean;
}

/**
 * Le décompte d'un sondage, dans l'ordre où les options ont été proposées.
 *
 * On ne trie pas par voix : l'option qu'on regardait ne doit pas changer de
 * place sous le doigt au moment où quelqu'un d'autre vote.
 */
export function depouiller(sondage: Sondage, moi?: string | null): Depouillement {
  const personnes = new Set(sondage.votes.map((vote) => vote.userId));
  const parOption = new Map<string, string[]>();
  for (const vote of sondage.votes) {
    parOption.set(vote.optionId, [...(parOption.get(vote.optionId) ?? []), vote.userId]);
  }
  const max = Math.max(0, ...[...parOption.values()].map((votants) => votants.length));

  const options = [...sondage.options]
    .sort((a, b) => a.position - b.position)
    .map((option) => {
      const votants = parOption.get(option.id) ?? [];
      return {
        option,
        voix: votants.length,
        votants,
        moi: Boolean(moi && votants.includes(moi)),
        part: personnes.size > 0 ? votants.length / personnes.size : 0,
        enTete: max > 0 && votants.length === max,
      };
    });

  return { options, votants: personnes.size, aVote: Boolean(moi && personnes.has(moi)) };
}

/** Les sondages ouverts où je n'ai pas encore voté : ce qui m'attend. */
export function sondagesEnAttente(sondages: readonly Sondage[], moi: string | null | undefined): number {
  if (!moi) return 0;
  return sondages.filter((sondage) => !sondage.clos && !sondage.votes.some((vote) => vote.userId === moi)).length;
}

/* -------------------------------------------------------------- Création -- */

export interface ModeleDeSondage {
  id: string;
  titre: string;
  question: string;
  genre: GenreDeSondage;
  /**
   * Pour des dates, on coche toutes celles qui arrangent : c'est une question
   * de disponibilités, pas un choix unique.
   */
  choixMultiple: boolean;
}

export const MODELES_DE_SONDAGE: readonly ModeleDeSondage[] = [
  { id: 'dates', titre: 'Les dates', question: 'Quelles dates vous arrangent ?', genre: 'dates', choixMultiple: true },
  { id: 'logement', titre: 'Le logement', question: 'Quel logement on prend ?', genre: 'liens', choixMultiple: false },
  { id: 'diner', titre: 'Le dîner', question: 'On dîne où ce soir ?', genre: 'texte', choixMultiple: false },
  { id: 'libre', titre: 'Autre chose', question: '', genre: 'texte', choixMultiple: false },
];

export interface NouvelleOption {
  libelle: string;
  lien?: string | null;
  du?: string | null;
  au?: string | null;
}

const DATE = /^\d{4}-\d{2}-\d{2}$/u;

/**
 * Le libellé d'une option : celui qu'on a écrit ; sinon, pour des dates, la
 * période (« du 12 au 15 juillet ») ; pour un lien collé seul, le site
 * (« Sur Airbnb ») ; sinon rien.
 */
export function libelleDeLOption(option: NouvelleOption): string {
  const ecrit = option.libelle.trim();
  if (ecrit) return ecrit;
  if (option.du && DATE.test(option.du)) {
    const periode = periodeLisible(option.du, option.au && DATE.test(option.au) ? option.au : option.du);
    return periode.charAt(0).toUpperCase() + periode.slice(1);
  }
  const lien = option.lien?.trim();
  if (!lien) return '';
  const fournisseur = trouverFournisseurParLien(lien);
  if (fournisseur) return `Sur ${fournisseur.nom}`;
  try {
    return new URL(lien).hostname.replace(/^www\./u, '');
  } catch {
    return '';
  }
}

/**
 * Ce qui empêche d'enregistrer, en une phrase, ou `null`.
 *
 * Les mêmes règles que la base, dites avant d'envoyer : une question, deux
 * options au moins, des dates dans l'ordre, des liens en https.
 */
export function problemeDuSondage(question: string, genre: GenreDeSondage, options: readonly NouvelleOption[]): string | null {
  if (!question.trim()) return 'Posez la question.';
  if (question.trim().length > 200) return 'La question dépasse 200 caractères.';
  const remplies = options.filter((option) => libelleDeLOption(option) || option.du);
  if (remplies.length < 2) return 'Il faut au moins deux options.';
  if (remplies.length > 12) return 'Douze options au plus.';
  for (const option of remplies) {
    const probleme = problemeDeLOption(genre, option);
    if (probleme) return probleme;
  }
  return null;
}

export function problemeDeLOption(genre: GenreDeSondage, option: NouvelleOption): string | null {
  if (genre === 'dates') {
    if (!option.du || !DATE.test(option.du)) return 'Chaque option de dates a besoin d’un premier jour.';
    if (option.au && (!DATE.test(option.au) || option.au < option.du)) return 'Les dates d’une option sont à l’envers.';
  }
  const lien = option.lien?.trim();
  if (lien && !/^https:\/\/\S+\.\S+/u.test(lien)) return 'Un lien doit commencer par https://';
  if (genre === 'liens' && !lien && !option.libelle.trim()) return 'Chaque logement a besoin d’un lien ou d’un nom.';
  if (libelleDeLOption(option).length > 200) return 'Une option dépasse 200 caractères.';
  return null;
}
