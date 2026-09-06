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
  | { statut: 'incompris' };

interface ReponseBrute {
  configured?: boolean;
  draft?: unknown;
  text?: unknown;
  provider?: string;
  quotaExceeded?: boolean;
  limit?: number;
  unavailable?: boolean;
  failed?: boolean;
}

async function appeler(task: string, input: unknown): Promise<ReponseBrute | null> {
  if (!supabase) return null;
  try {
    const { data, error } = await supabase.functions.invoke('ai', { body: { task, input } });
    if (error || !data) return null;
    return data as ReponseBrute;
  } catch {
    return null;
  }
}

/** Les fournisseurs configurés côté serveur, sans consommer de quota. */
export async function iaDisponible(): Promise<boolean> {
  const reponse = await appeler('status', null);
  return Boolean(reponse?.configured);
}

/**
 * Une phrase libre devient un brouillon de formulaire.
 *
 * Le résultat n'est jamais appliqué tout seul : l'écran le montre, la personne
 * garde ou corrige. C'est la seule façon honnête de laisser un modèle toucher
 * à un formulaire.
 */
export async function comprendrePhrase(phrase: string): Promise<EtatIA> {
  const reponse = await appeler('parse', phrase);
  if (!reponse) return { statut: 'indisponible' };
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
  const reponse = await appeler('explain', faits);
  if (!reponse) return { statut: 'indisponible' };
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
    default:
      return '';
  }
}
