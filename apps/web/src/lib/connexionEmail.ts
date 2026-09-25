/**
 * La connexion par e-mail, sans mot de passe.
 *
 * On donne son adresse, on reçoit un code, on le recopie. Un code plutôt qu'un
 * lien magique, parce qu'un lien ouvre le navigateur du téléphone : dans
 * l'application mobile, il mènerait sur le site au lieu de revenir dans
 * l'app, et sur le site il faudrait l'ouvrir dans le navigateur même qui l'a
 * demandé (la preuve PKCE y est restée). Six chiffres se recopient partout.
 *
 * Ici, rien que des fonctions pures : ce qu'on accepte comme adresse et comme
 * code, et ce qu'on dit quand le serveur refuse. Les messages de Supabase sont
 * en anglais et parlent à des développeurs ; ceux-ci parlent à quelqu'un qui
 * veut simplement entrer.
 */

/** L'adresse telle qu'on l'envoie : sans espaces autour, en minuscules. */
export function normaliserEmail(saisie: string): string {
  return saisie.trim().toLowerCase();
}

/**
 * Une adresse plausible. Volontairement large : la seule vraie vérification,
 * c'est le code qui arrive. Refuser une adresse valide parce qu'elle a une
 * forme inhabituelle serait pire que d'en laisser passer une fausse.
 */
export function emailPlausible(saisie: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/u.test(normaliserEmail(saisie));
}

/**
 * Les chiffres du code, et eux seuls. Un code collé depuis l'e-mail arrive
 * souvent avec un espace au milieu (« 123 456 ») ou un retour à la ligne.
 */
export function chiffresDuCode(saisie: string): string {
  return saisie.replace(/\D/gu, '').slice(0, 10);
}

/**
 * Supabase envoie six chiffres par défaut, jusqu'à dix si le projet le
 * règle ainsi. On accepte l'intervalle plutôt que de figer six ici et de
 * refuser des codes valides le jour où le réglage change.
 */
export function codeComplet(chiffres: string): boolean {
  return /^\d{6,10}$/u.test(chiffres);
}

/** Le délai à respecter avant de redemander un code, si le serveur le donne. */
export function secondesAAttendre(message: string): number | null {
  const trouve = /after (\d+) seconds?/iu.exec(message);
  return trouve ? Number(trouve[1]) : null;
}

/**
 * Ce qu'on dit quand ça ne marche pas.
 *
 * `etape` distingue l'envoi du code de sa vérification : « invalide » n'a pas
 * le même sens dans les deux cas.
 */
export function messageDErreurEmail(cause: unknown, etape: 'envoi' | 'verification'): string {
  const brut = cause instanceof Error ? cause.message : typeof cause === 'string' ? cause : '';
  const message = brut.toLowerCase();

  const attente = secondesAAttendre(brut);
  if (attente !== null) {
    return `Un code vient d’être envoyé. Patientez ${attente} seconde${attente > 1 ? 's' : ''} avant d’en redemander un.`;
  }
  if (message.includes('rate limit') || message.includes('too many')) {
    return 'Trop de codes envoyés en peu de temps. Réessayez dans une heure, ou continuez avec Google.';
  }
  if (message.includes('signups not allowed') || message.includes('user not found')) {
    // `shouldCreateUser: false` : l'adresse n'a pas encore de compte.
    return 'Aucun compte Tripora n’utilise cette adresse. Choisissez « Créer un compte ».';
  }
  if (message.includes('not authorized') || message.includes('error sending')) {
    // Le serveur d'e-mails de Supabase, laissé par défaut, n'écrit qu'aux
    // membres de l'équipe du projet. Tant qu'un vrai serveur d'envoi n'est
    // pas branché, l'e-mail ne part pas.
    return 'L’envoi d’e-mails n’est pas encore ouvert sur Tripora. Continuez avec Google en attendant.';
  }
  if (message.includes('email') && message.includes('invalid')) {
    return 'Cette adresse e-mail ne semble pas valide.';
  }
  if (etape === 'verification' && (message.includes('expired') || message.includes('invalid'))) {
    return 'Code incorrect ou expiré. Vérifiez les chiffres, ou demandez-en un nouveau.';
  }
  if (message.includes('fetch') || message.includes('network')) {
    return 'Pas de connexion au serveur. Vérifiez le réseau et réessayez.';
  }
  return etape === 'envoi'
    ? 'Le code n’a pas pu être envoyé. Réessayez dans un instant.'
    : 'Le code n’a pas pu être vérifié. Réessayez dans un instant.';
}
