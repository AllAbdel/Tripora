/**
 * Ce que les alertes de prix ajoutent aux notifications : le seuil qui décide
 * d'en envoyer une. La signature et l'envoi vivent dans `_shared/push.ts`,
 * partagés avec les notifications du groupe.
 */

export {
  base64url,
  creerClesVapid,
  jetonVapid,
  reveiller,
  type ClesVapid,
  type ResultatDEnvoi,
} from '../_shared/push.ts';

/**
 * Faut-il prévenir ? Une baisse d'au moins 10 % et d'au moins 15 € par
 * rapport au dernier prix signalé (ou au premier relevé).
 *
 * Les deux seuils se complètent : 10 % d'un vol à 60 € ne valent pas une
 * notification, et 15 € sur un long-courrier à 900 € non plus.
 */
export function baisseASignaler(reference: number | null, nouveau: number): boolean {
  if (reference === null || nouveau <= 0) return false;
  return nouveau <= reference * 0.9 && reference - nouveau >= 1500;
}
