import { sanitizeDraft, type TripDraft as AiDraft } from '@tripora/core';
import { supabase } from './supabase';

/**
 * Accès à la fonction serveur `ai`.
 *
 * Trois principes tenus ici comme ailleurs :
 *
 *  - **rien n'échoue bruyamment.** Un fournisseur saturé, une clé absente, une
 *    coupure réseau : l'appelant reçoit un état, pas une exception. Les écrans
 *    masquent la fonctionnalité au lieu d'afficher une erreur ;
 *  - **la sortie du modèle n'entre nulle part sans passer par `sanitizeDraft`**,
 *    qui vit dans le moteur et est testé ;
 *  - **rien de personnel ne sort.** Ce module n'envoie que la phrase écrite par
 *    la personne et les faits déjà calculés — jamais un nom, jamais un e-mail.
 */

export type EtatIA =
  | { statut: 'ok'; brouillon: AiDraft; fournisseur?: string }
  | { statut: 'ok'; texte: string; fournisseur?: string }
  | { statut: 'non-configure' }
  | { statut: 'quota'; limite?: number }
  | { statut: 'indisponible' }
  /**
   * La fonction n'a pas répondu du tout : réseau coupé, ou navigateur qui
   * refuse l'appel avant de l'envoyer. C'est un état distinct de
   * « non-configure », et la distinction a coûté deux semaines.
   *
   * Pendant tout ce temps, une règle de partage d'origine incomplète côté
   * serveur faisait échouer chaque appel dans le navigateur. Ce module
   * ramenait ces échecs à `null`, les écrans lisaient « pas de clé » et
   * masquaient l'assistant sans un mot. Le serveur, lui, était parfaitement
   * configuré. Une panne muette ressemblait exactement à une fonctionnalité
   * non branchée.
   */
  | { statut: 'injoignable' }
  | { statut: 'incompris' };

interface ReponseBrute {
  configured?: boolean;
  providers?: unknown;
  draft?: unknown;
  text?: unknown;
  provider?: string;
  quotaExceeded?: boolean;
  limit?: number;
  unavailable?: boolean;
  failed?: boolean;
}

/** Ce qu'un appel peut donner : une réponse, ou une raison de ne pas en avoir. */
type Appel =
  | { ok: true; donnees: ReponseBrute }
  /** Mode local assumé : il n'y a pas de serveur à joindre. */
  | { ok: false; raison: 'sans-serveur' }
  /** Il y a un serveur, et il n'a rien répondu. */
  | { ok: false; raison: 'injoignable' };

async function appeler(task: string, input: unknown): Promise<Appel> {
  if (!supabase) return { ok: false, raison: 'sans-serveur' };
  try {
    const { data, error } = await supabase.functions.invoke('ai', { body: { task, input } });
    // Une réponse d'erreur *de la fonction* reste une réponse : le serveur est
    // joignable, c'est l'appel qui a échoué. On ne les confond pas, sinon on
    // se remet à prendre une panne de réseau pour une clé manquante.
    if (error || !data) return { ok: false, raison: 'injoignable' };
    return { ok: true, donnees: data as ReponseBrute };
  } catch {
    return { ok: false, raison: 'injoignable' };
  }
}

/** Traduit un appel manqué en état, en gardant la raison. */
function manque(appel: Extract<Appel, { ok: false }>): EtatIA {
  return appel.raison === 'sans-serveur'
    ? { statut: 'non-configure' }
    : { statut: 'injoignable' };
}

/**
 * L'état du serveur, demandé sans rien lui coûter.
 *
 * La tâche `status` ne consomme ni quota ni modèle : elle dit seulement quels
 * fournisseurs sont branchés. C'est donc la sonde la moins chère pour savoir
 * si les fonctions serveur répondent *du tout* — et comme une règle de
 * partage d'origine casse toutes les fonctions à la fois, savoir que
 * celle-ci répond suffit à savoir que les autres le peuvent.
 */
export type EtatDuServeur =
  /** Les fonctions répondent, et l'assistant est branché. */
  | { statut: 'ok'; fournisseurs: readonly string[] }
  /** Les fonctions répondent, mais aucune clé d'IA n'est renseignée. */
  | { statut: 'non-configure' }
  /** Aucun serveur n'est relié : Tripora tourne en local, et c'est voulu. */
  | { statut: 'sans-serveur' }
  /** Il y a un serveur, et il ne répond pas. */
  | { statut: 'injoignable' };

export async function etatDuServeur(): Promise<EtatDuServeur> {
  const appel = await appeler('status', null);
  if (!appel.ok) {
    return appel.raison === 'sans-serveur'
      ? { statut: 'sans-serveur' }
      : { statut: 'injoignable' };
  }
  if (appel.donnees.configured !== true) return { statut: 'non-configure' };
  const bruts = appel.donnees.providers;
  return {
    statut: 'ok',
    fournisseurs: Array.isArray(bruts) ? bruts.filter((f): f is string => typeof f === 'string') : [],
  };
}

/** Vrai quand l'assistant peut répondre : tout ce qu'un écran a besoin de savoir. */
export async function iaDisponible(): Promise<boolean> {
  return (await etatDuServeur()).statut === 'ok';
}

/**
 * Une phrase libre devient un brouillon de formulaire.
 *
 * Le résultat n'est jamais appliqué tout seul : l'écran le montre, la personne
 * garde ou corrige. C'est la seule façon honnête de laisser un modèle toucher
 * à un formulaire.
 */
export async function comprendrePhrase(phrase: string): Promise<EtatIA> {
  const appel = await appeler('parse', phrase);
  if (!appel.ok) return manque(appel);
  const reponse = appel.donnees;
  if (reponse.configured === false) return { statut: 'non-configure' };
  if (reponse.quotaExceeded) {
    return reponse.limit === undefined
      ? { statut: 'quota' }
      : { statut: 'quota', limite: reponse.limit };
  }
  if (reponse.unavailable || reponse.failed || reponse.draft === undefined) {
    return { statut: 'indisponible' };
  }

  const brouillon = sanitizeDraft(reponse.draft);
  if (Object.keys(brouillon).length === 0) return { statut: 'incompris' };
  return reponse.provider === undefined
    ? { statut: 'ok', brouillon }
    : { statut: 'ok', brouillon, fournisseur: reponse.provider };
}

/** Une note déjà calculée devient un paragraphe. Les chiffres sont les nôtres. */
export async function rediger(faits: string): Promise<EtatIA> {
  const appel = await appeler('explain', faits);
  if (!appel.ok) return manque(appel);
  const reponse = appel.donnees;
  if (reponse.configured === false) return { statut: 'non-configure' };
  if (reponse.quotaExceeded) {
    return reponse.limit === undefined
      ? { statut: 'quota' }
      : { statut: 'quota', limite: reponse.limit };
  }
  if (typeof reponse.text !== 'string' || reponse.text.length === 0) {
    return { statut: 'indisponible' };
  }
  return reponse.provider === undefined
    ? { statut: 'ok', texte: reponse.text }
    : { statut: 'ok', texte: reponse.text, fournisseur: reponse.provider };
}

/**
 * Une question du groupe sur son propre voyage.
 *
 * Le dossier de faits et la consigne viennent du moteur, où ils sont testés :
 * l'écran n'a pas à décider ce que le modèle a le droit de savoir. Rien de ce
 * qui revient ne modifie quoi que ce soit — l'assistant lit et répond, il
 * n'agit pas.
 */
export async function demander(question: string, briefing: string, systeme: string): Promise<EtatIA> {
  const appel = await appeler('ask', { question, briefing, systeme });
  if (!appel.ok) return manque(appel);
  const reponse = appel.donnees;
  if (reponse.configured === false) return { statut: 'non-configure' };
  if (reponse.quotaExceeded) {
    return reponse.limit === undefined
      ? { statut: 'quota' }
      : { statut: 'quota', limite: reponse.limit };
  }
  if (typeof reponse.text !== 'string' || reponse.text.length === 0) {
    return { statut: 'indisponible' };
  }
  return reponse.provider === undefined
    ? { statut: 'ok', texte: reponse.text }
    : { statut: 'ok', texte: reponse.text, fournisseur: reponse.provider };
}

/** Message court et non culpabilisant, à afficher tel quel. */
export function messageIA(etat: EtatIA): string {
  switch (etat.statut) {
    case 'quota':
      return etat.limite === undefined
        ? 'Vous avez atteint votre nombre de demandes du jour. Tout le reste fonctionne normalement.'
        : `Vous avez atteint vos ${etat.limite} demandes du jour. Tout le reste fonctionne normalement.`;
    case 'indisponible':
      return 'L’assistant ne répond pas pour l’instant. Remplissez les champs à la main, ça marche aussi bien.';
    case 'incompris':
      return 'Je n’ai rien reconnu dans cette phrase. Essayez avec le nombre de personnes, la durée, le mois ou le budget.';
    case 'non-configure':
      return 'L’assistant n’est pas branché sur ce serveur.';
    case 'injoignable':
      return 'Le serveur ne répond pas. Voyez « État des services » dans votre profil.';
    default:
      return '';
  }
}
