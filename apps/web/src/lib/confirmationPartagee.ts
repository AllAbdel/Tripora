/**
 * Un e-mail de confirmation partagé vers Tripora, en transit entre l'écran
 * de partage et le formulaire de réservation du voyage choisi.
 *
 * Le texte ne passe pas par l'adresse de la page (il peut peser plusieurs
 * kilo-octets, et finirait dans l'historique) : il attend dans le stockage
 * de l'onglet, le temps d'un changement d'écran, puis il est effacé.
 */

const CLE = 'tripora.confirmation-partagee';
const LONGUEUR_MAX = 20_000;

/** Le texte partagé en entier (sujet compris), là où le partage de liens s'arrête à 3 000 caractères. */
export function texteCompletDuPartage(parametres: URLSearchParams): string {
  return [parametres.get('titre'), parametres.get('texte')]
    .filter((partie): partie is string => Boolean(partie?.trim()))
    .join('\n')
    .slice(0, LONGUEUR_MAX);
}

export function confierLaConfirmation(texte: string): void {
  try {
    sessionStorage.setItem(CLE, texte.slice(0, LONGUEUR_MAX));
  } catch {
    // Stockage refusé : le formulaire s'ouvrira vide, l'e-mail se recolle.
  }
}

export function lireLaConfirmationConfiee(): string | null {
  try {
    return sessionStorage.getItem(CLE);
  } catch {
    return null;
  }
}

export function oublierLaConfirmationConfiee(): void {
  try {
    sessionStorage.removeItem(CLE);
  } catch {
    // Rien à oublier.
  }
}
