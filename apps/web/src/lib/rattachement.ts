/**
 * Ce qu'on dit quand un compte invité ne peut pas devenir un vrai compte.
 *
 * Rattacher Google ou une adresse e-mail au compte invité le rend permanent,
 * sous le même identifiant : rien ne bouge pour le groupe. Deux refus sont
 * attendus, et ils méritent mieux que le message anglais du serveur :
 *
 * - l'adresse ou le compte Google a **déjà** un compte Tripora. Les deux
 *   comptes ne se fusionnent pas : il faut le dire franchement, avec la
 *   seule issue qui ne perd rien ;
 * - le rattachement à Google n'est pas encore autorisé côté Supabase (un
 *   réglage du tableau de bord, « liaison manuelle »).
 */

/** `null` si ce n'est pas un refus propre au rattachement. */
export function messageDeRattachement(cause: unknown): string | null {
  const brut = cause instanceof Error ? cause.message : typeof cause === 'string' ? cause : '';
  const message = brut.toLowerCase();

  if (message.includes('already been registered') || message.includes('email_exists') || message.includes('already registered')) {
    return 'Cette adresse a déjà un compte Tripora. Les deux comptes ne peuvent pas être réunis : gardez celui-ci, ou connectez-vous avec cette adresse et demandez à l’organisateur de vous réinviter.';
  }
  if (message.includes('identity is already linked') || message.includes('identity_already_exists') || message.includes('already linked')) {
    return 'Ce compte Google a déjà un compte Tripora. Les deux comptes ne peuvent pas être réunis : gardez celui-ci, ou rattachez une autre adresse.';
  }
  if (message.includes('manual linking') || message.includes('manual_linking_disabled')) {
    return 'Le rattachement à Google n’est pas encore ouvert sur Tripora. Utilisez votre adresse e-mail.';
  }
  return null;
}
